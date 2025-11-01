# 🚀 Déploiement Rapide - MonPetitBiz

## Déploiement en 5 Minutes

### 1. **Prérequis**
```bash
# Installer Vercel CLI
npm install -g vercel

# Se connecter
vercel login
```

### 2. **Base de Données**

#### Option A: Via l'Intégration Vercel (Recommandé)
1. Dashboard Vercel → Settings → Integrations
2. Ajouter l'intégration "Supabase"
3. Connecter votre projet Supabase ou créer un nouveau projet
4. Les variables d'environnement sont créées automatiquement ✅

#### Option B: Manuel
Créer une base PostgreSQL sur [Supabase](https://supabase.com) ou [Neon](https://neon.tech)

### 3. **Déployer**
```bash
# Cloner et déployer
git clone https://github.com/your-username/MonPetitBiz.git
cd MonPetitBiz
./scripts/deploy-vercel.sh
```

### 4. **Configurer les Variables**

**Si vous avez utilisé l'intégration Supabase**, `DATABASE_URL` est déjà configurée ✅

Sinon, ajouter dans Vercel Dashboard → Settings → Environment Variables :
- `DATABASE_URL` - URL de votre base PostgreSQL (utiliser le port pooler 6543 pour Vercel)
- `TWILIO_ACCOUNT_SID` - SID de votre compte Twilio
- `TWILIO_AUTH_TOKEN` - Token d'authentification Twilio
- `JWT_SECRET` - Clé secrète pour JWT (min 32 caractères)

**Format DATABASE_URL pour Supabase avec Vercel :**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
```

> 💡 **Note** : Utiliser le port **6543** (pooler) au lieu de **5432** pour Vercel

**Variables d'environnement optionnelles :**
- `DISABLE_PUPPETEER=true` - Désactive la génération PDF (recommandé sur Vercel)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` - Pour stockage S3 (si disponible)

> ⚠️ **Note Puppeteer** : La génération PDF avec Puppeteer n'est pas disponible sur Vercel par défaut. Le système basculera automatiquement vers un rapport texte si la génération PDF échoue. Pour activer Puppeteer, utilisez un service externe ou configurez Chrome Lambda layer.

### 5. **Configurer Twilio**
URL du webhook : `https://your-app.vercel.app/whatsapp/webhook`

## Commandes Utiles

```bash
# Déployer
vercel --prod

# Voir les logs
vercel logs

# Variables d'environnement
vercel env add VARIABLE_NAME
vercel env ls

# Rollback
vercel rollback
```

---

## Déploiement sur AWS Lambda (API Gateway HTTP API v2)

### Prérequis
```bash
npm i -g serverless # ou utilisez npx serverless ...
```

### Build + Deploy
```bash
# Variables d'env requises (exemples)
export DATABASE_URL=...
export JWT_SECRET=...
export TWILIO_ACCOUNT_SID=...
export TWILIO_AUTH_TOKEN=...

# Déployer
npm run deploy:lambda
```

Le handler Lambda est `dist/lambda.handler`. Toutes les routes Nest sont exposées via API Gateway.

### URL Webhook Twilio
Après déploiement, remplacez l’URL du webhook par:
```
https://<votre-api-id>.execute-api.<region>.amazonaws.com/whatsapp/webhook
```

### Puppeteer/PDF (si utilisé)
Si la génération PDF est active en prod Lambda, ajoutez un layer Chromium compatible (ex: chrome-aws-lambda) ou basculez la génération PDF sur un job séparé (ECS, Lambda avec layer adapté).

### Maintenance
```bash
# Supprimer le déploiement
npm run remove:lambda

# Voir les endpoints
npx serverless info
```

## Vérification

- ✅ Health check : `https://your-app.vercel.app/health`
- ✅ API docs : `https://your-app.vercel.app/api`
- ✅ WhatsApp webhook : `https://your-app.vercel.app/whatsapp/webhook`

## Migration de la Base de Données

Après le déploiement, exécuter les migrations :

```bash
# Option 1: Via script local
# Récupérer les variables depuis Vercel
./scripts/sync-vercel-env.sh
source .env.local
npm run migration:run

# Option 2: Via Supabase Dashboard
# Copier le contenu de supabase-schema.sql
# Coller dans Supabase Dashboard → SQL Editor → Run
```

## Troubleshooting Base de Données

Si vous rencontrez des problèmes de connexion :

```bash
# Diagnostiquer la connexion
./scripts/check-database-connection.sh

# Récupérer les variables depuis Vercel pour tester localement
./scripts/sync-vercel-env.sh
source .env.local
./scripts/check-database-connection.sh
```

Voir le guide complet : [Database Troubleshooting](./docs/database-connection-troubleshooting.md)

## Support

- 🔧 [Troubleshooting Connexion DB](./docs/database-connection-troubleshooting.md)
- 🗄️ [Guide Supabase](./SUPABASE.md)
- 🐛 [Issues GitHub](https://github.com/your-username/MonPetitBiz/issues)