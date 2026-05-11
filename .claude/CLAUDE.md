# MonPetitBiz — Agent Instructions

## Contexte projet
WhatsApp bot NestJS pour micro-entreprises en Afrique.
Stack: NestJS + TypeScript, PostgreSQL (Supabase) + TypeORM, Twilio WhatsApp, Supabase Storage (PDF), Next.js dashboard.
Tests: Jest. Deploy: Vercel (API) ; Docker/PM2 possible en self-host uniquement.

## Structure clé
- src/modules/whatsapp/    → NLP, parsing, queue, bot controller
- src/modules/transaction/ → Ventes & dépenses
- src/modules/stock/       → Inventaire, prix, unités
- src/modules/report/      → PDF, rapports
- src/modules/auth/        → JWT, OTP, rôles

## Règles globales des agents
1. L'Analyste lit le codebase AVANT tout changement et produit un plan
2. Le Dev implémente UNIQUEMENT ce qui est dans le plan validé
3. Le Testeur valide coverage Jest > 80% avant de passer au déployeur
4. Le Déployeur ne fait JAMAIS de push direct sur main
5. Outputs intermédiaires dans .agent-workspace/ (gitignored)

## Commandes du projet
- npm run start:dev       → dev avec hot reload
- npm run test            → tests unitaires
- npm run test:cov        → coverage
- npm run test:e2e        → end-to-end
- npm run lint            → ESLint
- npm run migration:run   → migrations DB

## Ne jamais toucher
- .env et .env.production
- Les migrations déjà appliquées (src/migrations/)
- TWILIO_WEBHOOK_SECRET et JWT_SECRET dans les fichiers
- Les entités TypeORM sans générer une migration correspondante

## Conventions de code
- NestJS modules pattern (module/service/controller/entity)
- TypeORM entities avec migrations en prod
- Messages WhatsApp toujours en français
- Commandes NLP dans src/modules/whatsapp/services/