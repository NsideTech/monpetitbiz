# Module Prêts — Plan d'implémentation

*Document créé : Février 2026*
*Implémenté : Février 2026*

## Vue d'ensemble

Module dédié pour enregistrer les **prêts** que le marchand prend (fournisseur, microcrédit) avec délai de remboursement, paiements partiels, et intégration Mobile + WhatsApp. La carte Dashboard "Créances & Dettes" affiche à recevoir (créances) et à payer (prêts).

### Décisions validées

- Pas d'intérêts pour le MVP (montant principal + échéance uniquement)
- Mobile + WhatsApp
- Carte Dashboard fusionnée : À recevoir | À payer

---

## 1. Modèle de données

### 1.1 Table `loans`

| Colonne      | Type          | Description                                           |
| ------------ | ------------- | ----------------------------------------------------- |
| id           | UUID          | Clé primaire                                          |
| business_id  | UUID          | Entreprise                                            |
| lender_name  | VARCHAR(255)  | Nom du prêteur (fournisseur, institution microcrédit) |
| lender_phone | VARCHAR(50)   | Téléphone (optionnel)                                 |
| loan_type    | VARCHAR(20)   | `supplier` \| `microcredit`                           |
| amount       | DECIMAL(12,2) | Montant emprunté                                      |
| amount_paid  | DECIMAL(12,2) | Montant déjà remboursé (défaut 0)                     |
| currency     | VARCHAR(3)    | XOF par défaut                                        |
| description  | TEXT          | Détails (optionnel)                                   |
| due_date     | DATE          | Date d'échéance (requis pour un prêt)                  |
| status       | VARCHAR(20)   | `open` \| `partial` \| `paid` \| `overdue`            |
| created_by   | UUID          | Utilisateur créateur                                  |
| created_at   | TIMESTAMP     | Date création                                         |
| updated_at   | TIMESTAMP     | Dernière mise à jour                                  |

**Solde restant** = `amount - amount_paid`

### 1.2 Table `loan_payments`

| Colonne      | Type          | Description           |
| ------------ | ------------- | --------------------- |
| id           | UUID          | Clé primaire          |
| loan_id      | UUID          | Référence prêt        |
| amount       | DECIMAL(12,2) | Montant remboursé     |
| payment_date | DATE          | Date du remboursement |
| notes        | TEXT          | Notes (optionnel)     |
| created_by   | UUID          | Utilisateur           |
| created_at   | TIMESTAMP     | Date enregistrement   |

---

## 2. Architecture Backend

### 2.1 Module `loan`

- `src/modules/loan/entities/loan.entity.ts`
- `src/modules/loan/entities/loan-payment.entity.ts`
- `src/modules/loan/loan.module.ts`
- `src/modules/loan/loan.service.ts`

**LoanService** : `create`, `findAll`, `findOne`, `recordPayment`, `recordFullPayment`, `getSummary`, `findByLender`

### 2.2 API (via DashboardController)

| Méthode | Endpoint                                         | Description                                 |
| ------- | ------------------------------------------------ | ------------------------------------------- |
| GET     | `/dashboard/:businessId/loans-summary`           | `{ totalOutstanding, count, overdueCount }` |
| GET     | `/dashboard/:businessId/loans`                   | Liste (filtres: status, limit, offset)      |
| POST    | `/dashboard/:businessId/loans`                   | Créer un prêt                               |
| GET     | `/dashboard/:businessId/loans/:id`               | Détail + paiements                          |
| POST    | `/dashboard/:businessId/loans/:id/payments`      | Enregistrer un remboursement                |
| POST    | `/dashboard/:businessId/loans/:id/payments/full` | Soldé le prêt                               |

### 2.3 Permissions

- `view_loans` : voir les prêts
- `create_loan` : créer un prêt et enregistrer des remboursements

---

## 3. App Mobile

### 3.1 Écran Créances & Dettes

- `ReceivablesAndLoansScreen` : écran avec onglets Créances | Prêts
- `ReceivablesScreen` : onglet Créances
- `LoansScreen` : onglet Prêts

### 3.2 Écran Prêts (`LoansScreen`)

- Liste : prêts avec statut (ouvert, partiel, payé, en retard)
- Filtres : Tous / Ouverts / En retard
- Modal Créer prêt : nom prêteur, type (Fournisseur/Microcrédit), montant, date d'échéance
- Modal Enregistrer remboursement

### 3.3 Dashboard

- Carte "Créances & Dettes" : À recevoir | À payer (deux colonnes)

---

## 4. Bot WhatsApp

### 4.1 Commandes

| Commande                 | Exemple                                     |
| ------------------------ | ------------------------------------------- |
| Créer prêt               | `prêt Fournisseur X 50000 15/03/2026`       |
| Créer prêt (microcrédit) | `prêt microcrédit Caurie 100000 30/04/2026` |
| Liste prêts              | `prêts` ou `prêts liste`                    |
| Remboursement            | `remboursement Fournisseur X 10000`         |
| Remboursement total      | `remboursement Fournisseur X tout`          |

### 4.2 Formats de date acceptés

- DD/MM/YYYY (ex: 15/03/2026)
- DD-MM-YYYY
- YYYY-MM-DD

---

## 5. Migration

- `src/migrations/1772030000000-CreateLoansTables.ts`
