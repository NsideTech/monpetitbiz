# MonPetitBiz Mobile App

Application mobile React Native (Expo) pour la gestion d'entreprise avec chatbot intégré.

## Fonctionnalités

- 🔐 **Authentification OTP** : connexion sécurisée par SMS
- 📊 **Tableau de bord** : vue d'ensemble des ventes, dépenses et profits
- 💬 **Chatbot in-app** : enregistrement de transactions via commandes naturelles (même logique que WhatsApp)
- 👥 **Gestion multi-rôles** : propriétaire, manager, vendeur
- 🏢 **Création d'entreprise** : enregistrement direct depuis l'app

## Prérequis

- Node.js >= 18
- npm ou yarn
- iOS Simulator (macOS) ou Android Studio (tous OS)
- Backend API MonPetitBiz en cours d'exécution

## Installation

```bash
cd apps/mobile
npm install
```

## Configuration

### 1. URL du backend

Éditer `app.json` et ajuster l'URL de l'API :

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "http://localhost:9000"
    }
  }
}
```

**Note** : Pour iOS Simulator, utilise `http://localhost:9000`.  
Pour device physique, remplace `localhost` par l'IP locale de ton Mac (ex : `http://192.168.1.10:9000`).

### 2. Démarrer le backend

Depuis la racine du repo :

```bash
npm run start:dev
```

L'API doit être accessible sur `http://localhost:9000`.

## Lancement

### Démarrage du serveur Expo

```bash
npm start
```

Ou avec cache propre :

```bash
npx expo start -c
```

### Lancer sur iOS

```bash
npm run ios
```

Ou appuie sur `i` dans le terminal Expo.

### Lancer sur Android

```bash
npm run android
```

Ou appuie sur `a` dans le terminal Expo.

### Lancer sur Web

```bash
npm run web
```

## Structure du projet

```
apps/mobile/
├── App.tsx                 # Point d'entrée, provider d'auth
├── app.json                # Config Expo
├── src/
│   ├── api/                # Client HTTP + endpoints
│   │   ├── client.ts       # Fetch wrapper avec logs
│   │   ├── mobile-api.ts   # Fonctions API (auth, dashboard, chat)
│   │   └── types.ts        # Types TypeScript
│   ├── auth/               # Contexte d'authentification
│   │   └── auth-context.tsx
│   ├── components/         # Composants réutilisables
│   │   ├── ChatMessageBubble.tsx
│   │   └── PrimaryButton.tsx
│   ├── config.ts           # Configuration (API URL)
│   ├── navigation/         # Navigation React Navigation
│   │   ├── AppNavigator.tsx
│   │   └── types.ts
│   ├── screens/            # Écrans de l'app
│   │   ├── AuthScreen.tsx
│   │   ├── OtpScreen.tsx
│   │   ├── RegisterBusinessScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   └── ChatScreen.tsx
│   └── storage/            # Stockage sécurisé (SecureStore)
│       └── token-storage.ts
```

## Flux d'utilisation

### 1. Connexion (utilisateur existant)

1. Saisir le numéro de téléphone (+226123456789)
2. Recevoir et valider le code OTP
3. Accéder au dashboard

### 2. Création d'entreprise (nouveau propriétaire)

1. Cliquer sur "Créer une nouvelle entreprise"
2. Remplir téléphone, nom d'entreprise, nom du propriétaire
3. Créer → reçoit un code entreprise (ex: ABC123)
4. Partager le code avec les employés

### 3. Chatbot

Depuis le dashboard, cliquer sur "Ouvrir le chatbot" et taper des commandes :

- `vente pain 1500` → enregistre une vente
- `dépense 500 marchandise` → enregistre une dépense
- `stock pain 50` → met à jour le stock
- `bilan jour` → affiche le bilan du jour

## Endpoints utilisés

- `POST /auth/send-otp` : envoi OTP
- `POST /auth/verify-otp` : validation OTP + JWT
- `GET /auth/profile` : récupération du profil utilisateur
- `POST /auth/register-business-owner` : création d'entreprise
- `GET /dashboard/:businessId/summary` : résumé dashboard
- `POST /chat/message` : envoi message chatbot
- `GET /chat/history` : historique des conversations

Voir [openapi.yaml](../../openapi.yaml) pour la spec complète.

## Troubleshooting

### Erreur "Impossible d'envoyer le code OTP"

- Vérifie que le backend tourne (`curl http://localhost:9000/health`)
- Vérifie `app.json` → `expo.extra.apiBaseUrl`
- Format du numéro : international avec `+` (ex: `+226123456789`)

### Erreur "Code invalide ou expiré"

En développement, **l'OTP n'est pas envoyé par SMS** — il est retourné par l'API et affiché dans l'app. Si tu vois "Mode dev : utilisez le code XXXXXX" sur l'écran OTP, entre ce code.

Si le message n'apparaît pas :
- Le code est aussi affiché dans le terminal du backend quand tu envoies l'OTP
- L'OTP expire après 5 minutes — demande un nouveau code
- Après 3 tentatives incorrectes, la session est invalidée — demande un nouveau code

### Timeout sur iOS Simulator

```bash
# Ouvrir le simulateur d'abord
open -a Simulator

# Puis lancer avec cache propre
npx expo start -c
```

### Impossible de se connecter depuis un device physique

1. **Même réseau WiFi** : Le téléphone et l'ordinateur doivent être sur le même WiFi (pas de données cellulaires).

2. **Backend en cours d'exécution** : Depuis la racine du repo :
   ```bash
   npm run start:dev
   ```
   Vérifie : `curl http://localhost:9000/health` doit retourner 200.

3. **IP correcte dans `app.json`** : Remplace par l'IP locale de ta machine :
   ```json
   "apiBaseUrl": "http://192.168.2.131:9000"
   ```
   Trouve ton IP :
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   # Windows
   ipconfig
   ```

4. **Redémarre l'app** : Après modification de `app.json`, relance `npm run start` et recharge l'app (secouer le téléphone → Reload).

### Mode tunnel (réseau restrictif)

Si le réseau local bloque la connexion :

```bash
npm install -D @expo/ngrok@^4.1.0
npx expo start --tunnel
```

## Documentation

- [Architecture mobile](../../docs/mobile-app-architecture.md)
- [Chatbot in-app](../../docs/mobile-chatbot.md)
- [README principal](../../README.md)

## Technologies

- **React Native** : framework mobile
- **Expo** : plateforme de développement
- **React Navigation** : navigation
- **Expo SecureStore** : stockage sécurisé des tokens
- **TypeScript** : typage statique

## Prochaines étapes

- [x] Écran Produits (liste, ajout, suppression, modification du prix)
- [ ] Écrans Stock (niveaux, alertes, ajustements)
- [ ] Écrans Transactions (historique, filtres)
- [ ] Écrans Rapports (génération PDF, export CSV)
- [ ] Mode offline + sync
- [ ] Notifications push

## Support

Pour toute question, voir la [documentation principale](../../README.md) ou ouvrir une issue.
