# Module Créances & Dettes — Plan d'implémentation

*Document créé : Février 2026*
*Implémenté : Février 2026*

## Vue d'ensemble

Module dédié pour gérer les **créances** (argent à recevoir des clients) et les **dettes** (argent à payer aux fournisseurs). La solution est partagée entre l'**app mobile** et le **bot WhatsApp**.

### Avantages du module dédié
- Suivi des paiements partiels
- Historique des encaissements par créance
- Dates d'échéance
- Indicateurs Dashboard (total à recevoir / à payer)
- Extensible (rappels, vieillissement, etc.)

---

## 1. Modèle de données

### 1.1 Table `receivables` (créances)

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Clé primaire |
| business_id | UUID | Entreprise |
| debtor_name | VARCHAR(255) | Nom du débiteur (client) |
| debtor_phone | VARCHAR(50) | Téléphone (optionnel, pour rappels futurs) |
| amount | DECIMAL(12,2) | Montant total de la créance |
| amount_paid | DECIMAL(12,2) | Montant déjà encaissé (défaut 0) |
| currency | VARCHAR(3) | XOF par défaut |
| description | TEXT | Détails (ex: "Vente riz 10kg") |
| due_date | DATE | Date d'échéance (optionnel) |
| status | VARCHAR(20) | `open` \| `partial` \| `paid` \| `overdue` |
| created_by | UUID | Utilisateur créateur |
| created_at | TIMESTAMP | Date création |
| updated_at | TIMESTAMP | Dernière mise à jour |

**Solde restant** = `amount - amount_paid`

### 1.2 Table `receivable_payments` (encaissements)

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | Clé primaire |
| receivable_id | UUID | Référence créance |
| amount | DECIMAL(12,2) | Montant encaissé |
| payment_date | DATE | Date du paiement |
| notes | TEXT | Notes (optionnel) |
| created_by | UUID | Utilisateur |
| created_at | TIMESTAMP | Date enregistrement |

### 1.3 Table `payables` (dettes) — Phase 2

Structure similaire à `receivables` mais pour les dettes (creditor_name, amount, amount_paid, etc.). À implémenter après les créances.

---

## 2. API Backend (partagée Mobile + WhatsApp)

### 2.1 Créances

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/dashboard/:businessId/receivables` | Liste des créances (filtres: status, limit, offset) |
| POST | `/dashboard/:businessId/receivables` | Créer une créance |
| GET | `/dashboard/:businessId/receivables/:id` | Détail d'une créance + paiements |
| PATCH | `/dashboard/:businessId/receivables/:id` | Modifier (annuler, etc.) |
| POST | `/dashboard/:businessId/receivables/:id/payments` | Enregistrer un encaissement |

### 2.2 Agrégats pour Dashboard

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/dashboard/:businessId/receivables-summary` | `{ totalOutstanding, count, overdueCount }` |

Ou inclure dans `getSummaryCards` / `getDashboardData` existant.

---

## 3. App Mobile

### 3.1 Navigation

- Ajouter un module **Créances** dans le Dashboard (carte existante "Créances & Dettes" → cliquable)
- Nouvel écran `ReceivablesScreen` dans le stack

### 3.2 Écran Créances (`ReceivablesScreen`)

- **Liste** : créances avec statut (ouvert, partiel, payé, en retard)
- **Filtres** : Toutes / Ouvertes / En retard
- **Pull-to-refresh**
- **Bouton +** : créer une créance
- **Clic sur une créance** : modal détail avec historique des paiements + bouton "Enregistrer paiement"

### 3.3 Modal Créer créance

- Nom du débiteur (requis)
- Téléphone (optionnel)
- Montant (requis)
- Description (optionnel)
- Date d'échéance (optionnel)

### 3.4 Modal Enregistrer paiement

- Montant du paiement
- Date (défaut: aujourd'hui)
- Notes (optionnel)

### 3.5 Dashboard

- Carte "Créances & Dettes" : afficher le total des créances en cours (`totalOutstanding`)
- Rendre la carte cliquable → navigation vers `ReceivablesScreen`

---

## 4. Bot WhatsApp

### 4.1 Commandes à ajouter

| Commande | Exemple | Action |
|----------|---------|--------|
| Créer créance | `créance Marie 5000` | Créer créance 5000 F pour Marie |
| Créer créance (détails) | `créance Marie 5000 riz 10kg` | Avec description |
| Liste créances | `créances` ou `créances liste` | Liste des créances ouvertes |
| Détail créance | `créance Marie` | Détail créances pour Marie |
| Encaissement | `encaissement Marie 2000` | Enregistrer paiement 2000 de Marie |
| Encaissement (tout) | `encaissement Marie tout` | Soldé la créance |

### 4.2 Parsing NLP

- Ajouter type `receivable_create`, `receivable_list`, `receivable_payment` dans `ParsedCommand`
- Patterns français : `créance`, `à crédit`, `encaissement`, `reçu`, `paiement reçu`

### 4.3 Intégration BotController

- Nouveau `ReceivablesService` injecté dans `BotController`
- Branchement dans le switch des commandes (après `balance`, `report`, etc.)
- Handler `handleReceivableCommand` qui délègue selon le sous-type

---

## 5. Permissions

- `view_receivables` : voir les créances
- `create_receivable` : créer une créance
- `record_receivable_payment` : enregistrer un encaissement

Rôles : owner, manager, seller (selon politique métier).

---

## 6. Ordre d'implémentation suggéré

### Phase 1 — Créances (MVP)

1. **Backend**
   - Entités `Receivable`, `ReceivablePayment`
   - Migration
   - `ReceivablesService` (CRUD + paiements)
   - Endpoints Dashboard (controller)
   - Permissions

2. **Mobile**
   - API `fetchReceivables`, `createReceivable`, `recordPayment`
   - Types TypeScript
   - `ReceivablesScreen` (liste + modals)
   - Navigation + carte Dashboard cliquable

3. **WhatsApp**
   - Patterns NLP créance / encaissement
   - `ReceivableCommandHandler` ou intégration dans BotController
   - Messages de confirmation

### Phase 2 — Dettes

- Entités `Payable`, `PayablePayment`
- Même logique que créances (inversée)
- Carte Dashboard : afficher créances - dettes (ou deux sous-indicateurs)

---

## 7. Exemples de flux

### Mobile : Vente à crédit

1. Utilisateur va dans Créances → +
2. Saisit : Marie, 5000, "Vente riz 10kg"
3. Créance créée, statut `open`
4. Plus tard : clic sur la créance → "Enregistrer paiement" → 2000
5. Statut passe à `partial`, solde 3000
6. Nouveau paiement 3000 → statut `paid`

### WhatsApp : Même scénario

```
User: créance Marie 5000 riz 10kg
Bot: ✅ Créance enregistrée pour Marie : 5 000 F CFA. Solde à recevoir : 5 000 F

User: créances
Bot: 📋 Créances ouvertes (1) :
     • Marie : 5 000 F (riz 10kg)

User: encaissement Marie 2000
Bot: ✅ Paiement de 2 000 F enregistré pour Marie. Solde restant : 3 000 F
```

---

## 8. Fichiers à créer/modifier

### Nouveaux fichiers
- `src/modules/receivable/receivable.module.ts`
- `src/modules/receivable/entities/receivable.entity.ts`
- `src/modules/receivable/entities/receivable-payment.entity.ts`
- `src/modules/receivable/receivable.service.ts`
- `src/modules/receivable/receivable.controller.ts` (ou intégrer dans dashboard)
- `src/migrations/xxx-CreateReceivablesTables.ts`
- `apps/mobile/src/screens/ReceivablesScreen.tsx`
- `apps/mobile/src/api/mobile-api.ts` (ajout fonctions)
- `src/modules/whatsapp/handlers/receivable-handler.service.ts` (ou similaire)

### Fichiers à modifier
- `src/app.module.ts` (importer ReceivableModule)
- `src/modules/dashboard/dashboard.controller.ts` (ou ReceivableController sous /dashboard)
- `src/modules/dashboard/dashboard.service.ts` (agrégat créances pour summary)
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/screens/DashboardScreen.tsx` (carte cliquable + données)
- `src/modules/whatsapp/command-parser.service.ts` (nouveaux types/patterns)
- `src/modules/whatsapp/bot.controller.ts` (branchement handler)
- `src/modules/whatsapp/whatsapp.module.ts` (injection ReceivablesService)
