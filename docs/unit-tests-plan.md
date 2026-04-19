# Plan de tests unitaires - Couverture 80%+

## Statut d'implémentation (2025-02-24)

- **Phase 1:** Complétée - DashboardService mock ReceivableService ajouté
- **Phase 2:** Complétée - TransactionService, LoanService, ReceivableService, EmployeeService
- **Phase 3:** Complétée - coverageThreshold, exclusions (cli, migrations, lambda)
- **Phase 4:** En attente - tests additionnels pour atteindre 80% global
- **Correction:** BotController spec - ReceivableService et LoanService mocks ajoutés

Couverture actuelle (sans integration/e2e/twilio): ~27% global. Objectif: 80%.

---

## Contexte actuel

- **Framework:** Jest + ts-jest + NestJS Testing
- **Fichiers de tests** dans `src/**/__tests__/*.spec.ts`
- **Mobile (apps/mobile):** Pas de configuration Jest - React Native/Expo nécessite Jest + react-native-testing-library (hors scope backend)

## Architecture des tests existants

Les specs suivent le pattern NestJS standard :

- `Test.createTestingModule()` avec mocks pour repositories et services
- `getRepositoryToken(Entity)` pour les repositories TypeORM
- Mocks Jest pour les dépendances externes

## Phase 1 : Corriger les tests cassés

### 1.1 DashboardService - Ajouter ReceivableService mock

**Fichier:** `src/modules/dashboard/__tests__/dashboard.service.spec.ts`

Le `DashboardService` injecte `ReceivableService`. Ajouter le mock dans les providers.

**Vérification:** `npm test -- --testPathPattern="dashboard.service"`

---

## Phase 2 : Nouveaux tests pour les services métier

### 2.1 TransactionService

**Fichier:** `src/modules/transaction/__tests__/transaction.service.spec.ts`

**Méthodes testées:** recordTransaction, recordSale, recordExpense, getTransactions, getTransactionById

### 2.2 LoanService

**Fichier:** `src/modules/loan/__tests__/loan.service.spec.ts`

**Méthodes testées:** create, findAll, findOne, recordPayment, recordFullPayment, getSummary, findByLender

### 2.3 ReceivableService

**Fichier:** `src/modules/receivable/__tests__/receivable.service.spec.ts`

**Méthodes testées:** create, findAll, findOne, recordPayment, recordFullPayment, getSummary, findByDebtor

### 2.4 EmployeeService

**Fichier:** `src/modules/auth/services/__tests__/employee.service.spec.ts`

**Méthodes testées:** generateEmployeeCode, lookupByInviteCode, useEmployeeCode, createEmployeeAccount, getEmployeeCodes, getEmployees, removeEmployee, updateEmployeeRole, isValidCodeFormat

---

## Phase 3 : Configuration couverture

**Fichier:** `jest.config.js`

- `coverageThreshold` avec seuils globaux (baseline actuel)
- Exclusions: `!src/**/cli/**`, `!src/**/migrations/**`, `!src/lambda.ts`

---

## Phase 4 : Tests additionnels (priorité secondaire)

Pour dépasser 80% sur les modules complexes :

- **UnitCommandHandler** (whatsapp): handleConfigureUnits, handleStockWithUnit, handlePriceCommand
- **ConfigurationValidatorService**: si utilisé au démarrage
- **ReportService** / **DashboardService**: cas limites (getRecentTransactions, getStockLevels)

---

## Vérification

```bash
npm run test:cov -- --testPathIgnorePatterns="integration|e2e|twilio"
```

Objectif : rapport de couverture >= 80% sur les modules métier principaux.
