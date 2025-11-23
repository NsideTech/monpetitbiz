# 🏷️ Système de Codes Produits - Génération Automatique

## 📋 Vue d'ensemble

MonPetitBiz génère **automatiquement** un code unique pour chaque produit. Ces codes courts facilitent l'utilisation quotidienne, particulièrement pour les produits avec des noms longs ou composés.

## ✨ Avantages

- ⚡ **Rapidité**: `stock CIM50 100` au lieu de `stock 'ciment blanc 50kg' 100`
- ✅ **Automatique**: Aucune décision à prendre, le système génère le code
- 🎯 **Unique**: Chaque code est unique dans votre entreprise  
- 💡 **Mémorisation**: Codes courts basés sur le nom du produit
- 🔄 **Flexible**: Utilisez le code OU le nom complet

## 🚀 Fonctionnement

### Génération Automatique

Quand vous créez un produit, le système génère automatiquement un code intelligent :

```bash
# Vous créez le produit
ajout produit 'ciment blanc 50kg' 5000

# Réponse système:
✅ Produit créé avec succès !
📦 Nom: ciment blanc 50kg
🏷️ Code: CIM50 (généré automatiquement)
💰 Prix: 5 000 CFA

💡 Commandes rapides:
• stock CIM50 100
• vente 5 CIM50
• produit CIM50
```

### Algorithme de Génération

Le système génère des codes intelligents basés sur le nom :

| Nom du Produit | Code Généré | Logique |
|----------------|-------------|---------|
| pain | PAIN | Nom court → Code identique |
| pain de mie | PAINDE | 2 mots → 3 lettres chacun |
| ciment blanc 50kg | CIM50 | Initiales + chiffre |
| Coca Cola 1.5L | COC15 | Initiales + chiffre |
| riz parfumé 5kg | RIPA5 | 2 lettres par mot + chiffre |
| savon liquide | SAVLIQ | 3 lettres par mot |

### Gestion des Conflits

Si un code existe déjà, le système ajoute un numéro :

```bash
'ciment blanc 50kg' → CIM50
'ciment blanc 25kg' → CIM501 (ou CIM25 si détecté)
'ciment blanc 10kg' → CIM502
```

## 📝 Utilisation au Quotidien

### Création de Produits

```bash
# Simple
ajout produit pain 400
# Code généré: PAIN

# Nom composé
ajout produit 'ciment blanc 50kg' 5000
# Code généré: CIM50

# Nom avec unité
ajout produit "Coca Cola 1.5L" 1000
# Code généré: COC15
```

### Commandes avec Codes

Une fois le produit créé, utilisez le code partout :

```bash
# Stock
stock CIM50 100
stock PAIN 50

# Prix
prix CIM50 5500
prix PAIN 450

# Vente
vente 5 CIM50 27500
vente 10 PAIN 4500

# Requête
produit CIM50
stock PAIN
```

### Ou Utilisez le Nom Complet

Vous pouvez toujours utiliser le nom complet si vous préférez :

```bash
# Ces deux commandes sont équivalentes:
stock CIM50 100
stock 'ciment blanc 50kg' 100

# Le système reconnaît les deux!
```

## 💡 Exemples Pratiques

### Produits de Construction

```bash
ajout produit 'ciment blanc 50kg' 5000
# Code: CIM50 ou CIBLA50

ajout produit 'ciment gris 25kg' 4500
# Code: CIGRI25 ou CIM501

ajout produit 'sable fin 25kg' 2000
# Code: SAFIN25 ou SAB25

# Utilisation:
stock CIM50 100
vente 3 CIM50 15000
```

### Boissons

```bash
ajout produit 'Coca Cola 1.5L' 1000
# Code: COC15 ou COCOLA15

ajout produit 'Fanta Orange 2L' 1200
# Code: FANORA2 ou FAN2

ajout produit 'Eau minérale 1.5L' 500
# Code: EAUMIN15 ou EAU15

# Utilisation:
stock COC15 200
vente 20 COC15 20000
```

### Produits Alimentaires

```bash
ajout produit 'riz parfumé 5kg' 3500
# Code: RIPA5 ou RIZ5

ajout produit "huile de palme 5L" 7500
# Code: HUDEPA5 ou HUI5

ajout produit 'pain de mie' 600
# Code: PAINDE ou PAIN1

# Utilisation:
stock RIPA5 80
vente 5 RIPA5 17500
```

## 📊 Voir les Codes

### Liste Complète

```bash
produits
```

**Réponse:**
```
📋 LISTE DES PRODUITS

1. ciment blanc 50kg
   🏷️ Code: CIM50
   📦 Stock: 100 unités
   💰 Prix: 5 000 CFA/unité

2. Coca Cola 1.5L
   🏷️ Code: COC15
   📦 Stock: 200 unités
   💰 Prix: 1 000 CFA/unité

3. pain
   🏷️ Code: PAIN
   📦 Stock: 50 unités
   💰 Prix: 400 CFA/unité
```

### Requête Individuelle

```bash
produit CIM50
```

**Réponse:**
```
📦 ciment blanc 50kg
🏷️ Code: CIM50
📊 Stock: 100 unités
💰 Prix: 5 000 CFA/unité
💵 Valeur: 500 000 CFA
```

## 🎯 Bonnes Pratiques

### 1. Laissez le Système Générer

✅ **Recommandé:**
```bash
ajout produit 'ciment blanc 50kg' 5000
# Le système génère: CIM50
```

Le code généré est:
- Basé sur le nom (facile à deviner)
- Unique dans votre entreprise
- Optimisé pour la mémorisation

### 2. Utilisez le Code au Quotidien

Une fois le produit créé, privilégiez le code :

```bash
# Plus rapide ✅
stock CIM50 100
vente 5 CIM50

# Plus long ❌ (mais fonctionne aussi)
stock 'ciment blanc 50kg' 100
vente 5 'ciment blanc 50kg'
```

### 3. Notez les Codes Importants

Pour vos produits les plus vendus, notez les codes :

```
Pain → PAIN
Riz 5kg → RIZ5
Ciment 50kg → CIM50
Coca 1.5L → COC15
```

### 4. Cohérence des Noms

Utilisez des noms cohérents lors de la création :

```bash
✅ Bon:
ajout produit 'ciment blanc 50kg'  → CIM50
ajout produit 'ciment blanc 25kg'  → CIM501 ou CIM25
ajout produit 'ciment gris 50kg'   → CIGRI50

❌ À éviter:
ajout produit 'ciment blanc 50'    → Pas d'unité
ajout produit 'ciment bl. 50kg'    → Abréviation non standard
```

## 🔍 Recherche de Produits

Le système reconnaît automatiquement si vous utilisez un code ou un nom :

```bash
# Par code (recommandé)
produit CIM50
stock COC15

# Par nom
produit 'ciment blanc 50kg'
stock "Coca Cola 1.5L"

# Le système trouve toujours le bon produit!
```

## ⚠️ Notes Importantes

### Codes Permanents

- ✅ Les codes sont **permanents** une fois générés
- ✅ Ils restent attachés au produit
- ✅ L'historique utilise le nom du produit (pas le code)

### Codes Uniques

- ✅ Un code = un seul produit par entreprise
- ✅ Si conflit, ajout automatique d'un numéro

### Majuscules Automatiques

- ✅ Les codes sont toujours en MAJUSCULES
- ✅ Vous pouvez taper en minuscules: `cim50` → `CIM50`

## 🆕 Produits Existants

### Génération Rétroactive

Les produits existants reçoivent automatiquement un code lors de :
- ✅ La prochaine mise à jour de stock
- ✅ La prochaine définition de prix
- ✅ La prochaine requête

```bash
# Produit ancien sans code
produit pain

# Réponse (code généré automatiquement):
📦 pain
🏷️ Code: PAIN (nouveau!)
📊 Stock: 50 unités
```

## 📱 Résumé Rapide

| Action | Commande | Code Généré |
|--------|----------|-------------|
| Créer produit | `ajout produit 'nom'` | Automatique |
| Voir code | `produits` ou `produit [code/nom]` | - |
| Utiliser code | `stock CODE qté` | - |
| Vendre | `vente qté CODE` | - |
| Prix | `prix CODE montant` | - |

## 💬 Support

**Questions fréquentes:**

**Q: Puis-je choisir mon propre code?**  
R: Non, dans cette version, les codes sont générés automatiquement pour garantir la cohérence.

**Q: Que se passe-t-il si je n'aime pas le code généré?**  
R: Vous pouvez toujours utiliser le nom complet du produit.

**Q: Les codes peuvent-ils changer?**  
R: Non, une fois généré, un code est permanent.

**Q: Que faire si j'oublie un code?**  
R: Tapez `produits` pour voir tous les codes, ou utilisez le nom du produit.

---

**💡 Astuce:** Commencez par utiliser les codes pour vos 5-10 produits les plus vendus. Vous verrez rapidement la différence de rapidité !

