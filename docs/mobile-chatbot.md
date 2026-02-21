# Chatbot in‑app (équivalent WhatsApp)

## Objectif

Offrir une interface conversationnelle dans l’application mobile qui réutilise la logique WhatsApp existante pour la saisie des opérations métier.

## Flux

1) L’utilisateur envoie un message depuis l’écran Chat.
2) L’app appelle `POST /chat/message`.
3) Le backend traite la commande via le `BotController` (mêmes règles que WhatsApp).
4) La réponse est renvoyée à l’app et stockée dans l’historique.
5) L’historique est consultable via `GET /chat/history`.

## Commandes supportées (exemples)

- Vente: `vente pain 1500`, `vente 1000`
- Dépense: `dépense 500 marchandise`
- Stock: `stock pain 50`, `stock`
- Rapport: `bilan jour`, `rapport PDF`

## Principes UX

- Message utilisateur à droite, réponse bot à gauche.
- Horodatage visible.
- Erreurs réseau affichées via alertes simples.

## Notes d’intégration

- L’auth JWT est requise sur `/chat/*`.
- Les réponses retournent `success`, `response`, `messageId`, `timestamp`.
