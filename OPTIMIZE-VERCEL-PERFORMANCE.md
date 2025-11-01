# ⚡ Optimisation Performance Vercel

## 🐌 Problème : Flow Trop Lent

WhatsApp → Twilio → Vercel → Backend → Database → Réponse

**Temps typique observé** :
- 1ère requête (cold start) : 5-15 secondes ❌
- Requêtes suivantes : 1-3 secondes ⚠️

**Temps souhaité** : < 1 seconde ✅

## 🔍 Causes de Lenteur

### 1. Cold Start (5-10s)
- La fonction Vercel démarre à froid à chaque requête après inactivité
- NestJS prend du temps à s'initialiser

### 2. Connexion Database (2-5s)
- Supabase pooler peut être lent sur cold start
- Connection pooling non optimal

### 3. Validation de Configuration (1-2s)
- Validation complète à chaque démarrage

### 4. TypeORM (1-2s)
- Connexion et synchronisation des entités

## ✅ Solutions Rapides

### Solution 1 : Garder la Fonction Chaude (GRATUIT)

Créer un ping automatique toutes les 5 minutes :

```bash
# Utiliser un service gratuit comme cron-job.org ou UptimeRobot
# URL à pinger : https://your-app.vercel.app/health
# Fréquence : Toutes les 5 minutes
```

**Services gratuits** :
- https://uptimerobot.com/ (gratuit, 50 monitors)
- https://cron-job.org/ (gratuit, illimité)
- https://healthchecks.io/ (gratuit)

**Configuration** :
1. Créer un compte sur UptimeRobot
2. Add New Monitor :
   - Type : HTTP(s)
   - URL : `https://your-app.vercel.app/health`
   - Monitoring Interval : **5 minutes**
3. Save

**Résultat** : La fonction reste chaude, cold start éliminé ! ✅

### Solution 2 : Optimiser DATABASE_URL

**Utiliser le pooler Supabase avec les bons paramètres** :

```bash
# Format OPTIMAL pour Vercel
postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=0

# Nouveaux paramètres :
# pool_timeout=0 : Pas d'attente si pas de connexion dispo
# connection_limit=1 : 1 connexion par fonction serverless
```

**Mettre à jour** :
```bash
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production
# Coller : postgresql://...?pgbouncer=true&connection_limit=1&pool_timeout=0
vercel --prod
```

### Solution 3 : Désactiver Validation en Production

Modifier `src/bootstrap.ts` :

```typescript
// Ligne 16-18
// Valider seulement en développement
if (process.env.NODE_ENV !== 'production') {
    const configValidator = app.get(ConfigurationValidatorService);
    await configValidator.validateConfigurationOrThrow();
}
```

**OU** valider de manière asynchrone :
```typescript
// Ne pas bloquer le démarrage
const configValidator = app.get(ConfigurationValidatorService);
configValidator.validateConfigurationOrThrow().catch(err => {
    console.warn('Configuration validation failed:', err.message);
});
```

### Solution 4 : Connection Pooling Optimisé

Modifier `src/config/database.config.ts` :

```typescript
extra: {
  max: 1,  // Au lieu de 10 ou 20
  min: 0,  // Au lieu de 2
  idleTimeoutMillis: 10000,  // Au lieu de 30000
  connectionTimeoutMillis: 5000,  // Au lieu de 10000
  query_timeout: 30000,  // Au lieu de 60000
  statement_timeout: 30000,
}
```

### Solution 5 : Cache des Utilisateurs (Avancé)

Ajouter un cache en mémoire pour les lookups utilisateurs :

```typescript
// src/modules/auth/auth.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  private userCache = new Map<string, { user: User; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getUserByPhone(phoneNumber: string): Promise<User> {
    // Vérifier le cache
    const cached = this.userCache.get(phoneNumber);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.user;
    }

    // Sinon, query database
    const user = await this.userRepository.findOne({ 
      where: { phoneNumber },
      relations: ['business'] 
    });

    // Mettre en cache
    if (user) {
      this.userCache.set(phoneNumber, { user, timestamp: Date.now() });
    }

    return user;
  }
}
```

## 🚀 Solution Immédiate (5 minutes)

### Étape 1 : Activer UptimeRobot

```bash
# 1. Créer compte : https://uptimerobot.com/signUp
# 2. Add Monitor :
#    - URL : https://your-app.vercel.app/health
#    - Interval : 5 minutes
# 3. Save

# Résultat : Cold start éliminé !
```

### Étape 2 : Optimiser DATABASE_URL

```bash
# DATABASE_URL avec pool_timeout=0
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production
# Coller : postgresql://postgres:PASSWORD@db.REF.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=0

vercel --prod
```

### Étape 3 : Tester

```bash
# Attendre 2 minutes après déploiement
# Tester 3 fois de suite
curl -X POST https://your-app.vercel.app/whatsapp/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+22670000001" \
  -d "To=whatsapp:+14155238886" \
  -d "Body=aide" \
  -d "MessageSid=SM$(date +%s)" \
  -d "AccountSid=AC123" \
  -w "\nTime: %{time_total}s\n"

# La 1ère peut être lente, les suivantes devraient être < 1s
```

## 📊 Monitoring

### Voir les Temps de Réponse Vercel

```bash
# Dashboard Vercel → Analytics
# Voir :
# - Cold starts
# - Function duration
# - Database query time
```

### Logs de Performance

Ajouter des timers dans le code :

```typescript
// src/modules/whatsapp/whatsapp.controller.ts
@Post('twilio')
async handleTwilioWebhook(@Body() payload: any) {
  const startTime = Date.now();
  
  this.logger.log(`[PERF] Request started`);
  
  // ... traitement ...
  
  const duration = Date.now() - startTime;
  this.logger.log(`[PERF] Request completed in ${duration}ms`);
  
  return result;
}
```

## 🎯 Objectifs de Performance

| Métrique | Avant | Après Optimisation |
|----------|-------|-------------------|
| Cold Start | 5-15s | 0s (fonction chaude) |
| DB Connection | 2-5s | < 500ms |
| Query Time | 1-2s | < 300ms |
| Total | 8-22s ❌ | < 1s ✅ |

## 🔧 Configuration Vercel Avancée

### Augmenter la Mémoire (Plan Pro)

Si vous avez un plan Pro :

```json
// vercel.json
{
  "functions": {
    "api/index.js": {
      "maxDuration": 30,
      "memory": 3008  // Au lieu de 1024
    }
  }
}
```

Plus de mémoire = Démarrage plus rapide.

### Région Optimale

Déployer dans la région la plus proche de vos utilisateurs :

```bash
# Voir où est déployé actuellement
vercel inspect

# Changer de région (Plan Pro)
# Dashboard → Settings → Functions → Region
```

## 🔍 Analyser les Goulots d'Étranglement

```bash
# Activer les logs détaillés
vercel logs --follow --output all

# Chercher les lignes avec [PERF]
# Identifier les étapes lentes
```

## ⚡ Quick Wins

1. ✅ **UptimeRobot** (5 min) → Élimine cold start
2. ✅ **DATABASE_URL optimisé** (2 min) → Connexion 2x plus rapide
3. ✅ **Validation conditionnelle** (5 min) → Gain 1-2s
4. ⚠️ **Cache utilisateurs** (30 min) → Gain 50-70%
5. ⚠️ **Plan Pro Vercel** (20$/mois) → Fonction toujours chaude

## 📝 Checklist d'Optimisation

- [ ] UptimeRobot configuré (ping toutes les 5 min)
- [ ] DATABASE_URL avec `pool_timeout=0`
- [ ] Connection pooling : `max: 1, min: 0`
- [ ] Validation désactivée en production
- [ ] Logs de performance ajoutés
- [ ] Test : < 1s après warm-up

## 🎉 Résultat Attendu

**Avant** :
- 1ère requête : 10-15s
- Suivantes : 2-3s

**Après** :
- 1ère requête : 1-2s (avec UptimeRobot)
- Suivantes : < 500ms

---

## 🚀 Actions MAINTENANT

```bash
# 1. Créer compte UptimeRobot
open https://uptimerobot.com/signUp

# 2. Optimiser DATABASE_URL
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production
# Ajouter : ...?pgbouncer=true&connection_limit=1&pool_timeout=0

# 3. Redéployer
vercel --prod

# 4. Tester après 5 minutes
curl -w "\nTime: %{time_total}s\n" \
  -X POST https://your-app.vercel.app/health
```

**La différence sera immédiate !** ⚡

