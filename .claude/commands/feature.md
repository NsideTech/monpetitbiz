Tu es l'orchestrateur de MonPetitBiz. Feature demandée: $ARGUMENTS

## ÉTAPE 1 — Analyste
Lis ces fichiers en priorité selon la feature:
- src/modules/whatsapp/services/ (NLP + parsing)
- src/modules/stock/stock.service.ts
- src/modules/transaction/transaction.service.ts
- src/modules/whatsapp/bot.controller.ts

Produis un plan JSON dans .agent-workspace/plan.json:
{
  "feature": "...",
  "fichiers_a_modifier": [...],
  "nouveaux_fichiers": [...],
  "migration_requise": true/false,
  "impact_nlp": true/false,
  "tests_a_ecrire": [...],
  "risques": [...]
}

STOP — Affiche le plan et demande confirmation avant de continuer.

## ÉTAPE 2 — Dev
- Lis .agent-workspace/plan.json
- Si migration_requise: génère la migration avec npm run migration:generate
- Implémente en respectant les patterns NestJS du projet
- Si impact_nlp: mets à jour les patterns dans whatsapp/services/
- Documente les nouvelles commandes WhatsApp avec exemples français
- Sauvegarde le résumé dans .agent-workspace/changes.md

## ÉTAPE 3 — Testeur
- Génère les tests Jest pour chaque fichier modifié
- Couvre les cas: commande valide, commande invalide, pluriels (pain/pains)
- Roule: npm run test && npm run test:cov
- Si coverage < 80% ou tests échouent → retourne à l'étape Dev
- Sauvegarde le rapport dans .agent-workspace/test-report.md

## ÉTAPE 4 — Déployeur
- Crée la branche: git checkout -b feature/[nom-kebab-case]
- Message de commit conventionnel: feat(module): description en français
- Affiche le résumé: fichiers changés, nouveaux tests, migration si applicable
- Rappelle les étapes manuelles: migration:run en prod, redémarrage PM2