# Vercel Speed Insights - Configuration

## 📊 Vue d'ensemble

Speed Insights de Vercel mesure les **Web Vitals** (Core Web Vitals) pour suivre les performances de votre application web. Il est intégré dans Swagger UI pour mesurer les performances de la documentation API.

## ✅ Configuration Actuelle

### 1. Package Installé

Le package `@vercel/speed-insights` est déjà installé dans `package.json` :

```json
{
  "dependencies": {
    "@vercel/speed-insights": "^1.2.0"
  }
}
```

### 2. Script Speed Insights

Un script personnalisé a été créé dans `public/vercel-speed-insights.js` qui charge automatiquement Speed Insights sur les domaines Vercel :

```javascript
// public/vercel-speed-insights.js
(function() {
  // Only load in production on Vercel
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    const script = document.createElement('script');
    script.src = 'https://cdn.vercel.com/insights/script.js';
    script.defer = true;
    script.setAttribute('data-api', '/_vercel/insights/script');
    document.head.appendChild(script);
    
    console.log('[Vercel Speed Insights] Script loaded');
  }
})();
```

### 3. Intégration dans Swagger UI

Le script est automatiquement injecté dans Swagger UI via `customJs` :

```typescript
// src/bootstrap.ts & src/main.ts
SwaggerModule.setup('api', app, document, {
  customJs: [
    '/vercel-speed-insights.js',  // Speed Insights script
  ],
  // ...
});
```

### 4. Configuration Vercel

Les en-têtes appropriés sont configurés dans `vercel.json` pour servir le script JavaScript :

```json
{
  "headers": [
    {
      "source": "/vercel-speed-insights.js",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/javascript"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 🎯 Comment ça fonctionne

### Sur Vercel

1. **Détection automatique** : Le script détecte si l'application est déployée sur Vercel (domaine `*.vercel.app`)
2. **Chargement du script** : Speed Insights est chargé depuis le CDN Vercel
3. **Collecte des métriques** : Les Web Vitals sont collectés automatiquement
4. **Visualisation** : Les métriques sont disponibles dans le dashboard Vercel

### Web Vitals Mesurés

Speed Insights mesure les **Core Web Vitals** :

- **LCP (Largest Contentful Paint)** : Temps de chargement du contenu principal
- **FID (First Input Delay)** : Délai avant la première interaction
- **CLS (Cumulative Layout Shift)** : Stabilité visuelle de la page
- **FCP (First Contentful Paint)** : Temps jusqu'au premier rendu
- **TTFB (Time to First Byte)** : Temps de réponse du serveur

## 📈 Visualisation des Métriques

### Dans le Dashboard Vercel

1. Accédez à votre projet sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Allez dans l'onglet **Analytics** ou **Speed Insights**
3. Visualisez les métriques Web Vitals en temps réel

### Métriques Disponibles

- **Performance Score** : Score global de performance
- **Core Web Vitals** : Métriques détaillées par vital
- **Historique** : Tendances de performance sur le temps
- **Comparaisons** : Comparaison avec les benchmarks

## 🔧 Configuration Avancée

### Utiliser le Package NPM (Alternative)

Si vous préférez utiliser le package NPM directement (pour Next.js ou autres frameworks) :

```typescript
import { SpeedInsights } from '@vercel/speed-insights/next';

// Dans votre composant/page
export default function Page() {
  return (
    <>
      <SpeedInsights />
      {/* Votre contenu */}
    </>
  );
}
```

### Configuration Personnalisée

Pour des configurations plus avancées, vous pouvez modifier `public/vercel-speed-insights.js` :

```javascript
// Configuration personnalisée
const script = document.createElement('script');
script.src = 'https://cdn.vercel.com/insights/script.js';
script.defer = true;
script.setAttribute('data-api', '/_vercel/insights/script');
// Optionnel : configuration personnalisée
script.setAttribute('data-sample-rate', '1.0'); // 100% des sessions
document.head.appendChild(script);
```

## 🚀 Déploiement

### Sur Vercel

1. **Commit** les changements
2. **Push** vers votre repository
3. Vercel déploie automatiquement
4. Speed Insights est activé automatiquement

### Vérification

1. Déployez sur Vercel
2. Accédez à Swagger UI : `https://your-app.vercel.app/api`
3. Ouvrez la console du navigateur
4. Vous devriez voir : `[Vercel Speed Insights] Script loaded`
5. Vérifiez dans le dashboard Vercel que les métriques sont collectées

## 📝 Notes

### Limitations

- **Local Development** : Speed Insights ne s'active que sur les domaines Vercel
- **Backend API** : Speed Insights mesure les performances web (Swagger UI), pas les performances API
- **Données** : Les métriques sont collectées uniquement pour les utilisateurs réels sur Vercel

### Meilleures Pratiques

1. ✅ **Tester en production** : Les métriques ne sont collectées qu'en production
2. ✅ **Monitorer régulièrement** : Vérifiez les métriques dans le dashboard Vercel
3. ✅ **Optimiser** : Utilisez les métriques pour identifier les problèmes de performance
4. ✅ **Comparer** : Comparez avec les benchmarks Core Web Vitals

## 🔗 Ressources

- [Vercel Speed Insights Documentation](https://vercel.com/docs/speed-insights)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Core Web Vitals](https://web.dev/vitals/#core-web-vitals)

## 🎯 Résultat Attendu

Après déploiement sur Vercel :

1. ✅ Speed Insights est activé automatiquement sur Swagger UI
2. ✅ Les métriques Web Vitals sont collectées
3. ✅ Les données sont visibles dans le dashboard Vercel
4. ✅ Les performances sont suivies en temps réel

