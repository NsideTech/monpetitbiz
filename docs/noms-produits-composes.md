# Guide des Noms de Produits Composés

## 📋 Vue d'ensemble

Ce guide explique comment gérer les produits avec des noms composés (plusieurs mots, incluant des chiffres) comme "ciment blanc 50kg", "Coca Cola 1.5L", "pain complet 500g", etc.

## 🆕 Nouveauté: Codes Produits Automatiques

**MonPetitBiz génère maintenant automatiquement un code pour chaque produit !**

Cela simplifie grandement l'utilisation des produits avec des noms composés :
- ✅ Plus besoin de guillemets dans les commandes quotidiennes
- ✅ Codes courts et faciles à mémoriser
- ✅ Génération automatique basée sur le nom

**Exemple:**
```bash
# Création (avec guillemets pour le nom)
ajout produit 'ciment blanc 50kg' 5000

# Réponse: Code généré → CIM50

# Utilisation (sans guillemets!)
stock CIM50 100
vente 5 CIM50
produit CIM50
```

📚 **Voir le guide complet:** [`codes-produits.md`](./codes-produits.md)

---

## ✅ Formats Supportés

### 1. **Avec Guillemets (Recommandé pour les noms complexes)**

Les guillemets simples `'` ou doubles `"` permettent de délimiter clairement le nom du produit :

```
ajout produit 'ciment blanc 50kg'
ajout produit "Coca Cola 1.5L" 1000
stock 'ciment blanc 50kg' 100
prix "pain complet 500g" 300
vente 10 'ciment blanc 50kg' 50000
```

**Avantages :**
- ✅ Aucune ambiguïté sur le nom du produit
- ✅ Supporte tous les caractères spéciaux
- ✅ Recommandé pour les produits avec des chiffres dans le nom

### 2. **Sans Guillemets (Pour les noms simples)**

Pour les produits avec des noms composés simples sans chiffres :

```
ajout produit pain de mie
stock pain de mie 50
prix pain de mie 400
vente pain de mie 400
```

**Note :** Pour les produits avec des chiffres dans le nom (comme "50kg", "1.5L"), l'utilisation de guillemets est fortement recommandée pour éviter toute confusion.

## 📝 Exemples par Commande

### Ajout de Produit

```bash
# Avec guillemets (recommandé)
ajout produit 'ciment blanc 50kg'
ajout produit "Huile Total 5L" 15000

# Sans guillemets (pour noms simples)
ajout produit savon liquide
ajout produit pain de mie
```

### Mise à Jour du Stock

```bash
# Avec guillemets
stock 'ciment blanc 50kg' 100
stock "Coca Cola 1.5L" 200

# Sans guillemets
stock pain de mie 50
stock savon liquide 30
```

### Définir un Prix

```bash
# Avec guillemets
prix 'ciment blanc 50kg' 5000
prix "Coca Cola 1.5L" 1000

# Sans guillemets
prix pain de mie 400
prix savon liquide 800
```

### Vente

```bash
# Avec quantité et guillemets
vente 5 'ciment blanc 50kg' 25000
vente 10 "Coca Cola 1.5L" 10000

# Sans guillemets (noms simples)
vente 5 pain de mie 2000
vente pain de mie 400
```

### Requête de Stock

```bash
# Avec guillemets
produit 'ciment blanc 50kg'
stock "Coca Cola 1.5L"

# Sans guillemets
produit pain de mie
stock savon liquide
```

## ⚠️ Cas Problématiques (À Éviter)

### ❌ Ambiguïté avec les Chiffres

**Problème :**
```
stock ciment blanc 50kg 100
```

**Ambiguïté :** Le système peut interpréter "50kg" comme une quantité au lieu de faire partie du nom.

**Solution :**
```
stock 'ciment blanc 50kg' 100
```

### ❌ Produits avec Plusieurs Nombres

**Problème :**
```
vente 10 Coca Cola 1.5L 10000
```

**Ambiguïté :** "1.5L" contient un nombre qui peut être confondu avec le prix.

**Solution :**
```
vente 10 'Coca Cola 1.5L' 10000
```

## 🎯 Bonnes Pratiques

### 1. **Utilisez des Guillemets pour les Noms Complexes**

```bash
✅ ajout produit 'ciment blanc 50kg'
✅ stock "Huile Total 5L" 20
✅ vente 5 'pain complet 500g' 2500

❌ ajout produit ciment blanc 50kg
❌ stock Huile Total 5L 20
```

### 2. **Soyez Cohérent avec les Noms**

Une fois qu'un produit est créé, utilisez toujours le même nom exact :

```bash
# Créer le produit
ajout produit 'ciment blanc 50kg'

# Utiliser le même nom partout
stock 'ciment blanc 50kg' 100
prix 'ciment blanc 50kg' 5000
vente 2 'ciment blanc 50kg' 10000
```

### 3. **Évitez les Espaces Inutiles**

```bash
✅ ajout produit 'ciment blanc 50kg'
❌ ajout produit ' ciment blanc 50kg '  # Espaces avant/après
```

### 4. **Normalisez les Unités**

Utilisez toujours le même format pour les unités :

```bash
✅ 'ciment blanc 50kg'  # Toujours "50kg"
❌ 'ciment blanc 50 kg' # Éviter l'espace
❌ 'ciment blanc 50Kg'  # Éviter la variation de casse
```

## 📊 Types de Produits Courants

### Produits de Construction

```bash
ajout produit 'ciment blanc 50kg'
ajout produit 'ciment gris 50kg'
ajout produit 'sable fin 25kg'
ajout produit 'gravier 50kg'
```

### Boissons

```bash
ajout produit 'Coca Cola 1.5L'
ajout produit 'Fanta Orange 2L'
ajout produit 'Eau minérale 1.5L'
ajout produit 'Jus Tropical 1L'
```

### Produits Alimentaires

```bash
ajout produit 'pain complet 500g'
ajout produit 'riz parfumé 5kg'
ajout produit 'huile de palme 5L'
ajout produit 'sucre en poudre 1kg'
```

### Produits d'Hygiène

```bash
ajout produit 'savon liquide 500ml'
ajout produit 'shampoing 250ml'
ajout produit 'détergent 2kg'
```

## 🔧 Dépannage

### Problème : "Produit non trouvé"

**Cause :** Le nom utilisé ne correspond pas exactement au nom enregistré.

**Solution :**
1. Vérifiez la liste des produits : `produits`
2. Copiez le nom exact tel qu'il apparaît
3. Utilisez des guillemets pour éviter les erreurs

### Problème : "Format incorrect" lors du stock

**Cause :** Le système ne peut pas distinguer le nom du produit de la quantité.

**Solution :** Utilisez des guillemets autour du nom du produit :
```bash
❌ stock ciment blanc 50kg 100
✅ stock 'ciment blanc 50kg' 100
```

### Problème : Confusion quantité/prix

**Cause :** Un chiffre dans le nom du produit est interprété comme une quantité ou un prix.

**Solution :** Toujours utiliser des guillemets pour les noms contenant des chiffres :
```bash
❌ vente 10 Coca Cola 1.5L 10000
✅ vente 10 'Coca Cola 1.5L' 10000
```

## 💡 Astuces

### Créer des Abréviations

Pour les produits fréquemment utilisés, vous pouvez créer des versions abrégées :

```bash
# Version complète
ajout produit 'ciment blanc 50kg' 5000

# Version abrégée (plus pratique)
ajout produit CB50 5000

# Ou créer les deux versions
ajout produit 'ciment blanc 50kg' 5000
ajout produit CB50 5000
```

### Utiliser des Codes Produits

Pour éviter les noms longs, utilisez des codes :

```bash
ajout produit CIM001  # au lieu de 'ciment blanc 50kg'
ajout produit COC150  # au lieu de 'Coca Cola 1.5L'
```

## 📱 Résumé Rapide

| Situation | Format | Exemple |
|-----------|--------|---------|
| Nom simple sans chiffre | Sans guillemets | `stock pain 50` |
| Nom avec chiffres | **Avec guillemets** | `stock 'ciment 50kg' 100` |
| Nom très long | **Avec guillemets** | `ajout produit 'détergent lessive 2kg'` |
| Création avec prix | Guillemets + prix | `ajout produit 'Coca 1.5L' 1000` |
| Vente avec quantité | Guillemets recommandés | `vente 10 'pain 500g' 2500` |

---

**💡 Conseil Principal :** En cas de doute, **utilisez toujours des guillemets** autour du nom du produit. C'est la méthode la plus sûre !

