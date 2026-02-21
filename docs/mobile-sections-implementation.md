# Implémentation des sections mobile — Rapports, Stock, Ventes/Dépenses

## Résumé

Implémentation du plan de design pour les sections Rapports, Stock et Ventes/Dépenses dans l'app mobile MonPetitBiz, avec navigation hybride (bottom tabs + cartes sur l'accueil).

## Backend

### 1. Rapports (bilan annuel + sécurisation)

- **ReportPeriod.YEAR** ajouté dans `src/modules/report/dto/report.dto.ts`
- **generateYearlyReport** dans `ReportService`
- Endpoint **GET /reports/:businessId/yearly**
- **JwtAuthGuard** et **PermissionGuard** sur tous les endpoints du `ReportController`
- Vérification `user.businessId === businessId` sur chaque requête

### 2. Transactions (création + liste filtrée)

- **POST /dashboard/:businessId/transactions** — créer une vente ou dépense
- **GET /dashboard/:businessId/transactions** — liste avec filtres `?type=sale|expense&startDate=&endDate=&limit=&offset=`
- `DashboardService.createTransaction` et `DashboardService.getTransactions`

### 3. Stock (ajustement + mouvements)

- **PATCH /dashboard/:businessId/stock/:productId** — ajuster la quantité (enregistre un mouvement ADJUSTMENT)
- **GET /dashboard/:businessId/stock-movements** — historique avec `?productId=&limit=&offset=`
- `DashboardService.adjustStock` et `DashboardService.getStockMovements`

## Mobile

### 4. Navigation hybride

- **Bottom tabs** : Accueil | Chat
- **Stack Accueil** : Dashboard, Reports, Stock, Transactions, Products, Chat
- **Cartes sur Dashboard** : Rapports, Stock, Ventes et Dépenses, Chatbot

### 5. Écran Rapports

- Sélecteur de période : Jour | Semaine | Mois | Année
- Affichage : ventes, dépenses, bénéfice net, nombre de transactions, top produits

### 6. Écran Ventes et Dépenses

- Onglets : Tous | Ventes | Dépenses
- FAB : + Vente, + Dépense
- Modal d'ajout : montant, produit (vente), description
- Liste avec pull-to-refresh

### 7. Écran Stock (ProductsScreen enrichi)

- Badge "Stock bas" / "Rupture" pour produits sous le seuil (5)
- Boutons **Ajuster** et **Historique** sur chaque carte produit
- Modal **Ajuster** : nouvelle quantité
- Modal **Historique** : liste des mouvements (achat, vente, ajustement, perte)

## API mobile ajoutées

| Fonction | Description |
|----------|-------------|
| `fetchReport(token, businessId, period)` | Bilan jour/semaine/mois/année |
| `fetchTransactions(token, businessId, filters?)` | Liste filtrée |
| `createTransaction(token, businessId, data)` | Créer vente/dépense |
| `fetchStockWarnings(token, businessId, threshold?)` | Alertes stock |
| `fetchStockMovements(token, businessId, filters?)` | Historique mouvements |
| `adjustStock(token, businessId, productId, quantity)` | Ajuster quantité |

## Fichiers modifiés/créés

### Backend
- `src/modules/report/dto/report.dto.ts`
- `src/modules/report/report.service.ts`
- `src/modules/report/report.controller.ts`
- `src/modules/report/report.module.ts`
- `src/modules/dashboard/dashboard.service.ts`
- `src/modules/dashboard/dashboard.controller.ts`
- `src/modules/dashboard/dashboard.module.ts`

### Mobile
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/screens/DashboardScreen.tsx`
- `apps/mobile/src/screens/ReportsScreen.tsx` (nouveau)
- `apps/mobile/src/screens/TransactionsScreen.tsx` (nouveau)
- `apps/mobile/src/screens/ProductsScreen.tsx` (enrichi)
- `apps/mobile/src/api/mobile-api.ts`
- `apps/mobile/src/api/types.ts`
