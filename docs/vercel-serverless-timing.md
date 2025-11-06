# Vercel Serverless Function Timing - Guide Technique

## 🔍 Pourquoi la fonction peut se terminer avant le traitement ?

### Problème Principal

Sur Vercel, les fonctions serverless sont conçues pour répondre rapidement. Le comportement est le suivant :

1. **Réponse HTTP envoyée** : Dès que `res.send()`, `res.json()` ou `res.end()` est appelé, la réponse est envoyée au client
2. **Code continue** : Le code après l'envoi de la réponse continue de s'exécuter
3. **Risque d'interruption** : **MAIS** Vercel peut considérer que la requête est terminée et fermer la fonction avant que le traitement asynchrone ne soit terminé

### Exemple du Problème

```typescript
// ❌ PROBLÈME : Code asynchrone après la réponse
async handleWebhook(req, res) {
  // 1. Message ajouté à la queue
  await messageQueue.enqueue(message);
  
  // 2. processQueue() démarre de manière asynchrone (fire-and-forget)
  // Note: pas de await ici pour éviter de bloquer la réponse
  processQueue().catch(err => console.error(err));
  
  // 3. Réponse envoyée immédiatement
  res.send('OK'); // ← Vercel peut terminer la fonction ici
  
  // 4. Le traitement asynchrone peut être interrompu si Vercel
  //    décide de terminer la fonction après la réponse
}
```

## ✅ Solutions

### Solution 1 : Traitement Synchrone pour Messages Critiques (Recommandé)

Pour les messages critiques (comme "créer une nouvelle entreprise"), traiter de manière synchrone AVANT d'envoyer la réponse :

```typescript
// ✅ SOLUTION : Traiter avant de répondre
async handleWebhook(req, res) {
  const isCritical = isCriticalMessage(message);
  
  if (isCritical) {
    // Traiter de manière synchrone - attendre que ce soit terminé
    await processMessageSynchronously(message);
  } else {
    // Messages non critiques : queue asynchrone
    await messageQueue.enqueue(message);
  }
  
  // Réponse envoyée APRÈS le traitement
  res.send('OK'); // ← Le traitement est déjà terminé
}
```

**Avantages** :
- ✅ Garantit que le traitement est terminé avant la réponse
- ✅ Pas d'interruption possible
- ✅ Fonctionne parfaitement sur Vercel

**Inconvénients** :
- ⚠️ Augmente la latence de la réponse (mais acceptable pour les messages critiques)
- ⚠️ Ne convient que pour les messages qui nécessitent une réponse immédiate

### Solution 2 : Augmenter maxDuration

Augmenter `maxDuration` dans `vercel.json` :

```json
{
  "functions": {
    "api/index.js": {
      "maxDuration": 60,  // Maximum 60 secondes (60s pour Pro, 30s pour Hobby)
      "memory": 1024
    }
  }
}
```

**Limites Vercel** :
- **Hobby (gratuit)** : Maximum 10 secondes
- **Pro** : Maximum 60 secondes
- **Enterprise** : Maximum 300 secondes (5 minutes)

**Avantages** :
- ✅ Donne plus de temps au traitement asynchrone
- ✅ Simple à configurer

**Inconvénients** :
- ⚠️ Ne résout pas le problème fondamental : si la réponse est envoyée avant le traitement, Vercel peut quand même terminer la fonction
- ⚠️ Coûts plus élevés (fonctions qui tournent plus longtemps)

### Solution 3 : Attendre un peu avant de répondre

Pour les messages non critiques, attendre un court délai avant d'envoyer la réponse :

```typescript
// ⚠️ Solution intermédiaire (pas recommandée)
async handleWebhook(req, res) {
  await messageQueue.enqueue(message);
  
  // Attendre que le traitement démarre
  await new Promise(resolve => setTimeout(resolve, 100));
  
  res.send('OK');
}
```

**Inconvénients** :
- ❌ Pas fiable : le traitement peut prendre plus de 100ms
- ❌ Augmente la latence sans garantie
- ❌ Pas de garantie que le traitement sera terminé

### Solution 4 : Queue Externe (Solution Robust)

Utiliser une queue externe comme Vercel Queue, AWS SQS, ou Redis :

```typescript
// ✅ Solution robuste mais plus complexe
async handleWebhook(req, res) {
  // Envoyer le message à une queue externe
  await externalQueue.send(message);
  
  // Réponse immédiate
  res.send('OK');
  
  // Un worker séparé traite les messages de la queue
  // (déployé séparément ou via Vercel Queue)
}
```

**Avantages** :
- ✅ Très fiable
- ✅ Peut gérer des retries automatiques
- ✅ Scalable

**Inconvénients** :
- ⚠️ Plus complexe à mettre en place
- ⚠️ Coûts supplémentaires
- ⚠️ Nécessite une infrastructure supplémentaire

## 📊 Stratégie Actuelle dans MonPetitBiz

### Messages Critiques → Traitement Synchrone

Messages traités de manière synchrone :
- "créer une nouvelle entreprise"
- "créer nouvelle entreprise"
- "nouvelle entreprise"
- "créer entreprise"
- "inscription"
- "bonjour"
- "aide"

**Code** : `src/modules/whatsapp/whatsapp.service.ts`
```typescript
if (isCriticalMessage(message)) {
  await processMessageSynchronously(message); // Traitement synchrone
} else {
  await messageQueue.enqueue(message); // Queue asynchrone
}
```

### Messages Non Critiques → Queue Asynchrone

Messages non critiques passent par la queue asynchrone :
- Commandes de vente
- Consultations de stock
- Rapports
- etc.

**Code** : `src/modules/whatsapp/services/message-queue.service.ts`
```typescript
async enqueue(message) {
  this.messageQueue.push(message);
  // Démarre processQueue() de manière asynchrone
  this.processQueue().catch(err => this.logger.error(err));
}
```

## 🎯 Recommandations

### Pour MonPetitBiz

1. ✅ **Continuer avec le traitement synchrone pour les messages critiques** (déjà en place)
2. ✅ **Augmenter maxDuration à 60 secondes** pour donner plus de temps aux messages non critiques
3. ✅ **Monitorer les logs Vercel** pour détecter les interruptions
4. 🔄 **Si problèmes persistants** : considérer Vercel Queue pour les messages non critiques

### Configuration Recommandée

```json
// vercel.json
{
  "functions": {
    "api/index.js": {
      "maxDuration": 60,  // Maximum pour plan Pro
      "memory": 1024
    }
  }
}
```

## 📝 Notes Techniques

### Pourquoi Vercel peut terminer la fonction ?

1. **Optimisation des ressources** : Vercel optimise l'utilisation des ressources en fermant les fonctions après la réponse
2. **Cold start** : Les fonctions serverless sont éphémères
3. **Pas de garantie** : Il n'y a pas de garantie que le code après `res.send()` s'exécutera complètement

### Meilleures Pratiques

1. ✅ **Toujours traiter les messages critiques de manière synchrone**
2. ✅ **Envoyer la réponse APRÈS le traitement pour les messages critiques**
3. ✅ **Utiliser des queues externes pour les tâches longues**
4. ✅ **Monitorer les logs pour détecter les interruptions**
5. ✅ **Tester en production** pour valider le comportement

## 🔗 Ressources

- [Vercel Function Configuration](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)
- [Vercel Queue](https://vercel.com/docs/storage/vercel-queue)
- [Serverless Best Practices](https://vercel.com/docs/functions/serverless-functions/best-practices)

