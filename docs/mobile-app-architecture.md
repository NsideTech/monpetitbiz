# Architecture de l'application mobile (React Native)

## Objectifs

- Offrir une gestion complète (tableau de bord, stock, transactions) depuis mobile.
- Réutiliser la logique métier existante du backend via API REST.
- Proposer un chatbot in-app qui reproduit l'expérience WhatsApp.

## Écrans principaux

- **Auth**: saisie du numéro, envoi OTP.
- **OTP**: validation du code reçu.
- **Dashboard**: synthèse (ventes, dépenses, profit) et accès rapide.
- **Chatbot**: interface conversationnelle (messages + réponses bot).
- **Stock** (à étendre): niveaux, alertes, ajustements.
- **Transactions** (à étendre): ventes, dépenses, historique.
- **Rapports** (à étendre): résumé + export.

## Rôles et permissions

- **owner**: accès complet + gestion employés.
- **manager**: stock, dépenses, rapports.
- **seller**: ventes et consultation stock.

## Flux d’authentification

1) `POST /auth/send-otp` (saisie téléphone)
2) `POST /auth/verify-otp` (validation OTP → JWT)
3) `GET /auth/profile` (récupération du `businessId` et du rôle)
4) Token stocké localement (SecureStore)

## Intégration API

Les endpoints mobiles s’appuient sur l’API actuelle :

- `/auth/*` pour l’auth
- `/dashboard/:businessId/*` pour la synthèse
- `/chat/*` pour le chatbot in‑app

## Structure mobile (proposée)

```text
apps/mobile/
  App.tsx
  src/
    api/           # client HTTP + endpoints
    auth/          # contexte auth
    components/    # UI générique
    navigation/    # stacks + routes
    screens/       # Auth, OTP, Dashboard, Chat
    storage/       # SecureStore
```

## Convention de données

- `businessId` vient du profil utilisateur
- `role` pilote l’accès aux écrans
- Le chat renvoie une `response` textuelle comme WhatsApp
