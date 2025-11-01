# How to View Product Prices

## 🔍 Quick Answer

To see the price of a product, simply type:

```
stock [produit]
```

**Example:**
```
stock pain
```

**Response:**
```
📦 Stock pain: 50 unités
💰 Prix: 300 FCFA/unité
💵 Valeur du stock: 15,000 FCFA
```

---

## 📋 All Methods to View Prices

### Method 1: View Single Product (Recommended)

**Command:**
```
stock pain
```

**Shows:**
- Current quantity in stock
- Price per unit
- Total value of stock
- Low stock warning (if applicable)

**Example Response:**
```
📦 Stock pain: 50 unités
💰 Prix: 300 FCFA/unité
💵 Valeur du stock: 15,000 FCFA
```

### Method 2: View All Products

**Command:**
```
stock
```

**Shows:**
- All products with quantities
- Price per unit for each
- Total inventory value

**Example Response:**
```
📦 ÉTAT DU STOCK:

• pain: 50 unités @ 300 FCFA
• eau: 100 unités @ 100 FCFA
• cigarette: 20 unités @ 500 FCFA ⚠️
• bonbon: 200 unités @ 50 FCFA

💰 Valeur totale du stock: 35,000 FCFA
```

### Method 3: View Advanced Unit Prices

For products with unit-based pricing (bulk purchases):

**Command:**
```
prix [produit]
```

**Example:**
```
prix bière
```

**Shows:**
- Purchase price
- Unit cost
- Selling price
- Profit margin

**Example Response:**
```
💰 PRIX - BIÈRE

📦 Prix d'achat: 12,000 FCFA/caisse
💰 Coût unitaire: 500 FCFA/bouteille

💵 Prix de vente: 700 FCFA/bouteille
📊 Marge: 40%
💰 Bénéfice: 200 FCFA/bouteille
```

---

## 🎯 What You'll See

### If Price Is Set

```
📦 Stock pain: 50 unités
💰 Prix: 300 FCFA/unité
💵 Valeur du stock: 15,000 FCFA
```

### If Price Is Not Set

```
📦 Stock pain: 50 unités
💡 Prix non défini. Définissez avec: prix pain [montant]
```

The system will tell you exactly how to set the price!

---

## 💡 Common Scenarios

### Scenario 1: Check Before Selling

```
You: stock pain
Bot: 📦 Stock pain: 50 unités
     💰 Prix: 300 FCFA/unité
     💵 Valeur du stock: 15,000 FCFA

You: vente pain 300
Bot: ✅ Vente enregistrée...
```

### Scenario 2: Check All Inventory Value

```
You: stock
Bot: 📦 ÉTAT DU STOCK:
     
     • pain: 50 unités @ 300 FCFA
     • eau: 100 unités @ 100 FCFA
     • cigarette: 20 unités @ 500 FCFA
     
     💰 Valeur totale du stock: 35,000 FCFA
```

### Scenario 3: Need to Set Price First

```
You: stock pain
Bot: 📦 Stock pain: 50 unités
     💡 Prix non défini. Définissez avec: prix pain [montant]

You: prix pain 300
Bot: ✅ Prix défini pour pain:
     💰 300 FCFA/unité
     📊 Stock actuel: 50 unités
     💵 Valeur du stock: 15,000 FCFA
```

---

## 📊 Price Information Summary

| Command | What You See | Best For |
|---------|-------------|----------|
| `stock pain` | Quantity + Price + Value | Single product check |
| `stock` | All products with prices | Full inventory view |
| `prix bière` | Detailed pricing breakdown | Unit-based products |

---

## ⚡ Quick Tips

### 1. Always Check Stock First
Before making a sale, check stock to see:
- Available quantity
- Current price
- If you need to restock

### 2. Regular Inventory Checks
```
stock          # Daily check
```
See total value and which products need attention.

### 3. Price Not Set?
The system will always tell you how to set it:
```
💡 Prix non défini. Définissez avec: prix pain [montant]
```

### 4. Low Stock Warnings
Products with ≤5 units show ⚠️ warning:
```
• cigarette: 3 unités @ 500 FCFA ⚠️
```

---

## 🔧 Troubleshooting

### "Produit non trouvé"

**Problem:** Product doesn't exist in stock

**Solution:**
```
# First add the product to stock
stock pain 50

# Then set the price
prix pain 300
```

### Price Shows NULL or Missing

**Problem:** Price never set for product

**Solution:**
```
prix pain 300
```

### Want More Detailed Price Info

**Problem:** `stock` shows basic price, want margins/costs

**Solution:** 
For advanced unit-based pricing:
```
# 1. Configure units
produit unité bière achat caisse 24 bouteille

# 2. Set purchase price
prix achat bière 12000 caisse

# 3. Set margin
prix vente bière 40%

# 4. View detailed breakdown
prix bière
```

---

## 📱 Complete Workflow Example

### Daily Business Flow

```bash
# Morning: Check inventory
stock
# See all products, prices, and total value

# Customer asks: "Combien coûte le pain?"
stock pain
# See: 📦 Stock pain: 50 unités
#      💰 Prix: 300 FCFA/unité

# Make the sale
vente pain 300

# Later: Check if need to restock
stock pain
# See remaining quantity

# End of day: Check total sales
bilan jour
```

---

## 🎓 Pro Tips

1. **Use `stock` as Your Dashboard**
   - Quick overview of everything
   - See total inventory value
   - Spot low stock items

2. **Check Individual Products Often**
   ```
   stock pain     # Quick price check
   ```

3. **Set Prices Immediately**
   When adding new products:
   ```
   stock savon 100        # Add stock
   prix savon 250         # Set price immediately
   stock savon            # Verify
   ```

4. **Monitor Total Value**
   ```
   stock                  # Shows: 💰 Valeur totale: 35,000 FCFA
   ```
   Track your inventory investment!

---

## 📚 Related Commands

| Task | Command | Description |
|------|---------|-------------|
| **View price** | `stock pain` | See price and quantity |
| **Set price** | `prix pain 300` | Set/update price |
| **View all** | `stock` | All products with prices |
| **Make sale** | `vente pain 300` | Uses the set price |
| **Add stock** | `stock pain 50` | Update quantity |

---

## 🆘 Need Help?

Type `aide` anytime for help with all commands!

---

**Remember:** `stock [produit]` is your go-to command to quickly check any product's price! 💡

