# Intégration avec le Portail Admin

## Vue d'ensemble

Le backend MonPetitBiz expose des endpoints admin (`/admin/dashboard/*`) qui permettent au portail admin d'accéder aux données de n'importe quel business sans vérification de propriété.

## Configuration

### Variable d'environnement requise

Ajoutez dans votre fichier `.env` ou variables d'environnement :

```bash
SERVICE_TOKEN=your_service_token_here
```

Ce token doit :
- Être identique au `BACKEND_SERVICE_TOKEN` configuré dans le portail admin
- Être gardé secret et ne jamais être exposé publiquement
- Être suffisamment complexe pour la sécurité (recommandé : UUID ou token aléatoire de 32+ caractères)

### Génération du token

Pour générer un token sécurisé, vous pouvez utiliser :

```bash
# Générer un UUID
node -e "console.log(require('crypto').randomUUID())"

# Ou générer un token aléatoire de 32 caractères
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Endpoints Admin

Tous les endpoints admin sont préfixés par `/admin/dashboard/` et utilisent le `ServiceTokenGuard` pour l'authentification.

### Endpoints disponibles

- `GET /admin/dashboard/:businessId` - Données complètes du dashboard
- `GET /admin/dashboard/:businessId/summary` - Résumés (jour/semaine/mois)
- `GET /admin/dashboard/:businessId/chart-data?days=7` - Données de graphique
- `GET /admin/dashboard/:businessId/stock-warnings?threshold=5` - Alertes stock
- `GET /admin/dashboard/:businessId/stock-levels` - Niveaux de stock
- `GET /admin/dashboard/:businessId/recent-transactions?limit=10` - Transactions récentes
- `GET /admin/dashboard/:businessId/metrics?period=day` - Métriques
- `GET /admin/dashboard/:businessId/export?startDate=&endDate=` - Export JSON
- `GET /admin/dashboard/:businessId/export/csv?startDate=&endDate=` - Export CSV

### Authentification

Tous les endpoints admin requièrent un header d'authentification :

```
Authorization: Bearer <SERVICE_TOKEN>
```

Le token doit correspondre exactement à la variable d'environnement `SERVICE_TOKEN` du backend.

## Différences avec les endpoints normaux

| Aspect | Endpoints normaux (`/dashboard/*`) | Endpoints admin (`/admin/dashboard/*`) |
|--------|-----------------------------------|----------------------------------------|
| Authentification | JWT utilisateur (via OTP) | Token de service |
| Vérification propriété | ✅ Vérifie `user.businessId === businessId` | ❌ Aucune vérification |
| Accès | Uniquement son propre business | Tous les businesses |
| Guard | `JwtAuthGuard` + `PermissionGuard` | `ServiceTokenGuard` |

## Sécurité

### Bonnes pratiques

1. **Token fort** : Utilisez un token aléatoire de 32+ caractères ou un UUID
2. **Stockage sécurisé** : Stockez le token dans les variables d'environnement, jamais dans le code
3. **Rotation** : Changez le token régulièrement, surtout en cas de compromission
4. **HTTPS** : Utilisez toujours HTTPS en production pour protéger le token en transit
5. **Logs** : Ne loggez jamais le token complet dans les logs

### En cas de compromission

Si le token est compromis :
1. Générez un nouveau token immédiatement
2. Mettez à jour `SERVICE_TOKEN` dans le backend
3. Mettez à jour `BACKEND_SERVICE_TOKEN` dans le portail admin
4. Redéployez les deux applications

## Test

Pour tester les endpoints admin :

```bash
# Remplacer <SERVICE_TOKEN> et <BUSINESS_ID> par vos valeurs
curl -X GET "http://localhost:3000/admin/dashboard/<BUSINESS_ID>" \
  -H "Authorization: Bearer <SERVICE_TOKEN>" \
  -H "Content-Type: application/json"
```

## Dépannage

### Erreur 401 (Unauthorized)
- Vérifiez que `SERVICE_TOKEN` est configuré dans le backend
- Vérifiez que le token dans le header correspond exactement à `SERVICE_TOKEN`
- Vérifiez qu'il n'y a pas d'espaces ou de caractères invisibles

### Erreur 404 (Not Found)
- Vérifiez que le `businessId` existe dans la base de données
- Vérifiez que l'URL est correcte (`/admin/dashboard/` et non `/dashboard/`)

### Erreur 500 (Internal Server Error)
- Vérifiez les logs du backend pour plus de détails
- Vérifiez que la base de données est accessible
- Vérifiez que tous les services nécessaires sont démarrés

