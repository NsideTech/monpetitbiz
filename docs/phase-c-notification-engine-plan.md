# Phase C — Moteur de règles et notifications

*Document créé : Avril 2026*
*Statut : À implémenter*

## Contexte

Phase C du plan d'alignement MonPetitBiz → GESCOM.
Sans ce moteur, GESCOM est une calculatrice. Avec lui, c'est un outil de discipline commerciale.

Durée estimée : 4 semaines, 1 développeur.

**Prérequis complétés :**
- Phase A : `paymentMethod`, soft delete transactions, onboarding fields, `isArchived` stock
- Phase B : `DailyGoal`, synthèse comparative (veille/7j), top produits
- `ScheduleModule.forRoot()` déjà présent dans `AppModule`
- `business.timezone` présent dans l'entité `Business` (défaut `Africa/Dakar`)
- `TwilioWhatsAppService.sendMessage(to, message)` disponible

---

## Architecture cible

```
src/modules/notification/
├── notification.module.ts
├── entities/
│   └── notification.entity.ts
├── services/
│   ├── rules-engine.service.ts           → évalue les 4 règles MVP
│   ├── notification-sender.service.ts    → envoie via Twilio
│   └── notification-scheduler.service.ts → crons NestJS Schedule
└── __tests__/
    ├── rules-engine.service.spec.ts
    └── notification-sender.service.spec.ts
```

---

## C1 — Entité Notification

### Migration

Fichier : `src/migrations/1772050000000-CreateNotifications.ts`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_business_id ON notifications(business_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

### Entité TypeORM

Fichier : `src/modules/notification/entities/notification.entity.ts`

```typescript
export enum NotificationType {
  INACTIVITY_REMINDER    = 'inactivity_reminder',
  ACTIVITY_DROP_ALERT    = 'activity_drop_alert',
  GOAL_REACHED           = 'goal_reached',
  REGULARITY_SIGNAL      = 'regularity_signal',
  AGENT_INACTIVITY_REPORT = 'agent_inactivity_report',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'sent' | 'failed';

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## C2 — NotificationModule

### 2.1 RulesEngineService

Fichier : `src/modules/notification/services/rules-engine.service.ts`

Dépendances injectées :
- `Repository<Transaction>`
- `Repository<Business>`
- `Repository<User>`
- `DailyGoalService` (depuis DashboardModule — à exporter)
- `NotificationSenderService`

**Règle 1 — Rappel inactivité (cron 14h)**

Condition : aucune vente enregistrée depuis minuit (heure locale du commerce).

```
"Bonjour ! Vous n'avez pas encore enregistré de vente aujourd'hui.
Tapez 'vente' pour commencer."
```

**Règle 2 — Alerte baisse d'activité (cron 18h)**

Condition : CA du jour < 60 % de la moyenne des 7 derniers jours.

```
"⚠️ Votre chiffre d'affaires aujourd'hui est en baisse.
Habituellement : {moyenne} XOF, aujourd'hui : {ca_jour} XOF."
```

**Règle 3 — Objectif atteint (event-driven, déclenché par createTransaction)**

Condition : après une vente, le CA du jour franchit le seuil de `DailyGoal`.

```
"🎯 Objectif du jour atteint ! {ca_jour} XOF enregistrés. Excellente journée !"
```

Déclenchement : **hors scheduler**, appelé dans `DashboardService.createTransaction()` après le save.

**Règle 4 — Signal de régularité (cron lundi 9h)**

Condition : l'utilisateur a enregistré au moins une vente sur 5 des 7 derniers jours.

```
"👏 5 jours d'enregistrement cette semaine. Continuez comme ça !"
```

#### Gestion du fuseau horaire

Les crons tournent en UTC. La vérification de l'heure locale se fait dans la logique métier :

```typescript
private isLocalHourPast(targetHour: number, timezone: string): boolean {
  const localTime = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  return parseInt(localTime) >= targetHour;
}
```

Les crons sont déclenchés avec une fenêtre large (ex. toutes les heures entre 13h-15h UTC),
puis la logique filtre par timezone. Alternative : cron à heure fixe UTC couvrant le fuseau
principal (UTC+0 = Dakar = pas de décalage pour Africa/Dakar).

#### Déduplication

Avant d'envoyer, vérifier qu'aucune notification du même type n'a été envoyée pour ce business
dans les dernières 24h (règles 1, 2) ou 7 jours (règle 4).

```typescript
private async alreadySent(
  businessId: string,
  type: NotificationType,
  withinHours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const count = await this.notificationRepository.count({
    where: { businessId, type, status: 'sent', sentAt: MoreThan(since) },
  });
  return count > 0;
}
```

### 2.2 NotificationSenderService

Fichier : `src/modules/notification/services/notification-sender.service.ts`

Responsabilité : résoudre le numéro de téléphone du destinataire et déléguer à `TwilioWhatsAppService`.

```typescript
async send(notification: Notification, phoneNumber: string): Promise<void> {
  try {
    await this.twilioWhatsApp.sendMessage(phoneNumber, notification.content);
    notification.status = 'sent';
    notification.sentAt = new Date();
  } catch (err) {
    notification.status = 'failed';
    notification.errorMessage = err.message;
    this.logger.error(`Notification ${notification.id} failed`, err);
  } finally {
    await this.notificationRepository.save(notification);
  }
}
```

Le numéro est toujours le `phoneNumber` du user de rôle `owner` du business.

### 2.3 NotificationScheduler

Fichier : `src/modules/notification/services/notification-scheduler.service.ts`

```typescript
@Cron('0 14 * * *')   // 14h00 UTC = 14h00 Dakar (UTC+0)
async checkInactivity() { ... }

@Cron('0 18 * * *')   // 18h00 UTC
async checkActivityDrop() { ... }

@Cron('0 9 * * 1')    // lundi 09h00 UTC
async checkRegularity() { ... }
```

Pour chaque cron : charger tous les business `isActive = true`, boucler,
évaluer la règle, envoyer si condition remplie.

---

## C3 — Hook dans DashboardService

Dans `DashboardService.createTransaction()`, après le save de la transaction de type SALE :

```typescript
// Évaluation non bloquante — ne doit jamais faire échouer la transaction
try {
  await this.rulesEngineService.evaluateGoalRule(businessId, userId);
} catch (err) {
  this.logger.error('[createTransaction] Goal rule evaluation failed', err);
}
```

**Point de vigilance dépendance circulaire :**
`DashboardModule` importe `NotificationModule` (pour `RulesEngineService`).
`NotificationModule` importe `DashboardModule` (pour `DailyGoalService`).

Solution : exporter `DailyGoalService` de `DashboardModule`, et `RulesEngineService`
de `NotificationModule`. Utiliser `forwardRef()` si TypeScript/NestJS se plaint au
démarrage (cas rare avec deux modules qui s'importent mutuellement).

Alternative plus propre : extraire `DailyGoalService` dans un module dédié `GoalModule`
sans dépendance vers `DashboardModule`. À décider à l'implémentation.

---

## Ordre d'implémentation recommandé

| Étape | Fichier(s) | Durée |
|-------|-----------|-------|
| 1 | Migration + entité `Notification` | 0.5j |
| 2 | `NotificationSenderService` + tests | 1j |
| 3 | `RulesEngineService` règle 3 (goal) + tests | 1j |
| 4 | Hook `DashboardService.createTransaction()` | 0.5j |
| 5 | `NotificationScheduler` + règles 1, 2, 4 + tests | 2j |
| 6 | `NotificationModule` + wiring `AppModule` | 0.5j |
| 7 | Tests d'intégration end-to-end | 1j |

---

## Indicateur de succès

> Au moins une notification envoyée automatiquement par business actif par jour.

Vérification : `SELECT type, status, COUNT(*) FROM notifications GROUP BY type, status;`

---

## Points d'attention

- **Ne jamais bloquer une transaction** sur une erreur de notification (try/catch systématique)
- **Déduplication** obligatoire pour éviter le spam (une notification par type par période)
- **Pas de numéro hardcodé** : toujours résoudre le `phoneNumber` du owner depuis la DB
- **Fuseau Africa/Dakar = UTC+0** : pas de décalage pour le MVP, simplification acceptable
- Si un business a un timezone différent à l'avenir, la logique `isLocalHourPast()` est déjà prévue
