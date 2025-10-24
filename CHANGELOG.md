# 📋 Changelog - MonPetitBiz WhatsApp Bot

## 🚀 Version 2.0.0 - Améliorations Majeures

### ✨ Nouvelles Fonctionnalités

#### 🛒 Ventes par Quantité
- **Support des ventes par quantité** : `vente 10 pain 2500`
- **Formats multiples supportés** :
  - `vente 1000` - Vente de 1000 CFA
  - `vente pain 500` - Vendre du pain pour 500 CFA  
  - `vente 10 pain` - Vendre 10 pains (demande le montant)
  - `vente 10 pain 2500` - Vendre 10 pains pour 2500 CFA
- **Calcul automatique du prix unitaire**
- **Décrémentation correcte du stock par quantité**

#### 📦 Gestion Intelligente des Stocks
- **Normalisation des noms de produits** avec support singulier/pluriel
- **Correspondances automatiques** : `pain` ↔ `pains`, `eau` ↔ `eaux`
- **Support des mots irréguliers** français
- **Gestion des mots composés** : `pomme de terre` ↔ `pommes de terre`
- **Logs détaillés** pour le debugging

#### 🧠 Parsing Intelligent
- **Distinction automatique** entre quantité et montant
- **Heuristiques avancées** :
  - Petits nombres (1-20) → Quantité
  - Grands nombres (>500) → Montant
  - Analyse du contexte et de l'ordre des mots
- **Support multiformat** dans une même commande

### 🔧 Améliorations Techniques

#### 📊 Services Améliorés
- **ProductNormalizerService** : Normalisation intelligente des produits
- **CommandParserService** : Parsing avancé avec support quantité
- **StockService** : Recherche intelligente avec correspondances
- **BotController** : Gestion des ventes par quantité

#### 🛠️ Infrastructure
- **Endpoint de test offline** : `/whatsapp/test-offline`
- **Logs détaillés** avec préfixes `[StockService]` et `[BotController]`
- **Gestion d'erreurs améliorée**
- **Validation robuste des commandes**

### 🐛 Corrections de Bugs

#### 📦 Stock
- **Problème de décrémentation résolu** : Le stock se décrémente maintenant correctement
- **Correspondance singulier/pluriel** : `pain` trouve maintenant `pains` en stock
- **Messages d'alerte précis** : Distinction entre rupture et stock faible

#### 💬 Parsing des Commandes
- **Ambiguïté quantité/montant résolue** : `vente pain 10` vs `vente 10 pain`
- **Support des formats mixtes**
- **Validation améliorée des paramètres**

### 📚 Documentation

#### 📖 Guides Créés (puis nettoyés)
- Guide de migration vers production Twilio
- Explication du modèle de pricing WhatsApp
- Documentation des différences Sandbox vs Production
- Guide de diagnostic des problèmes de stock

#### 🧪 Outils de Développement (nettoyés)
- Simulateurs WhatsApp offline et hybride
- Scripts de test automatisés
- Outils de diagnostic de base de données
- Scripts d'optimisation Twilio

### 🔄 Migration et Compatibilité

#### ✅ Rétrocompatibilité
- **Tous les anciens formats** continuent de fonctionner
- **Pas de breaking changes** pour les utilisateurs existants
- **Migration transparente** des données

#### 🗄️ Base de Données
- **Nouvelles colonnes** : `quantity` dans ParsedCommand
- **Index optimisés** pour les recherches de produits
- **Contraintes de validation** renforcées

### 🎯 Performances

#### ⚡ Optimisations
- **Cache des correspondances** produits en mémoire
- **Recherche optimisée** avec patterns pré-compilés
- **Réduction des requêtes** base de données redondantes
- **Logs conditionnels** pour éviter la surcharge

### 🧹 Nettoyage

#### 🗑️ Fichiers Supprimés
- 38 fichiers de test et développement supprimés
- Simulateurs HTML temporaires
- Scripts de diagnostic
- Documentation de développement temporaire
- Fichiers de configuration de test

#### 📁 Structure Finale
```
├── src/                    # Code source
├── scripts/                # Scripts utilitaires
├── docs/                   # Documentation
├── .env.example            # Template de configuration
├── README.md               # Documentation principale
├── SETUP-GUIDE.md          # Guide d'installation
├── openapi.yaml            # Documentation API
├── package.json            # Dépendances
└── tsconfig.json           # Configuration TypeScript
```

### 🚀 Prêt pour Production

#### ✅ Checklist Production
- [x] Code nettoyé et optimisé
- [x] Tests unitaires à jour
- [x] Documentation complète
- [x] Gestion d'erreurs robuste
- [x] Logs de production configurés
- [x] Sécurité renforcée
- [x] Performance optimisée

#### 🎯 Prochaines Étapes Recommandées
1. **Migration Twilio Production** : Passer du sandbox à un compte payant
2. **Tests utilisateurs** : Valider les nouveaux formats avec de vrais commerçants
3. **Monitoring** : Mettre en place des alertes de performance
4. **Backup** : Configurer les sauvegardes automatiques

---

## 📞 Support

Pour toute question ou problème :
1. Consultez le `README.md` pour l'utilisation de base
2. Consultez le `SETUP-GUIDE.md` pour l'installation
3. Vérifiez les logs avec les préfixes `[StockService]` et `[BotController]`
4. Utilisez l'endpoint `/whatsapp/test-offline` pour les tests sans Twilio

---

**Version précédente** : 1.0.0 - Fonctionnalités de base  
**Version actuelle** : 2.0.0 - Ventes par quantité et gestion intelligente des stocks