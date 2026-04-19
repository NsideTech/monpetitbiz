# Section Rapports — Recommandations

## Ajustements effectués

### Top produits
- **Backend** : utilisation de `transaction.quantity` quand disponible (au lieu de compter 1 par transaction)
- **Frontend** : affichage de la quantité vendue + nombre d’opérations (transactions associées)
- Exemple : « 15 vendus · 3 op. » = 15 unités vendues réparties sur 3 transactions

### Transactions associées
- Chaque top produit affiche désormais le nombre de transactions (`transactionCount`)
- Format : « X vendus · Y op. » (Y = nombre de transactions)

### Robustesse
- `formatXof` protégé contre les valeurs invalides (évite « NaN F »)
- Gestion des valeurs `undefined` / `null` pour quantity et transactionCount

---

## Graphiques : recommandation

### Pour un utilisateur lambda (micro-commerce, secteur informel)

**L’affichage actuel (cartes + listes) est suffisant** pour la plupart des utilisateurs :

- Chiffres clairs (ventes, dépenses, bénéfice)
- Top produits avec quantité et CA
- Peu de friction, lecture rapide sur mobile

### Quand ajouter des graphiques ?

| Cas d’usage | Recommandation |
|-------------|----------------|
| Utilisateur habitué aux tableaux de bord | Optionnel : barres horizontales pour les top produits |
| Comparaison de périodes (jour vs semaine vs mois) | Utile : mini graphique en courbe ou barres |
| Présentation à un partenaire / banque | PDF existant suffit ; graphiques déjà dans le template PDF |

### Si on ajoute des graphiques plus tard

1. **Priorité 1** : barres horizontales pour les top produits (CA par produit) — simple et parlant
2. **Priorité 2** : évolution ventes/dépenses sur la période (courbe ou barres empilées)
3. **Bibliothèque** : `react-native-svg` + `victory-native` ou `react-native-chart-kit` (léger, compatible Expo)

### Conclusion

Pour l’instant, **ne pas ajouter de graphiques** : l’écran actuel répond bien aux besoins d’un utilisateur lambda. Les graphiques peuvent être envisagés dans une version ultérieure si les retours utilisateurs le justifient.
