# Feuille de Route - Support Multilingue

## Langues Actuellement Supportées

### ✅ Français (fr)
- **Statut** : Complètement implémenté
- **Région** : Afrique de l'Ouest francophone
- **Exemples** : `vente 1000`, `dépense 500`, `stock pain 10`

## Langues à Implémenter

### 📋 Mooré (mo) - Burkina Faso
- **Statut** : TODO - Planifié
- **Région** : Burkina Faso (langue mossi)
- **Population** : ~7 millions de locuteurs
- **Priorité** : Haute (marché important)

#### Vocabulaire Clé Mooré
```
Vendre = koose
Acheter = rãmde  
Argent = galga
Aujourd'hui = tɩ
Stock = stock (emprunté)
Pain = pɛɛn / burukutu
Riz = rĩis
Eau = koom
Merci = barka
Oui = ɔɔn
Non = ayi
```

#### Exemples de Commandes Mooré
```
koose 1000           → vente 1000
rãmde 500 rĩis       → dépense 500 riz  
stock rĩis 10        → stock riz 10
compte tɩ            → bilan aujourd'hui
barka                → merci
```

### 📋 Dioula (di) - Mali/Côte d'Ivoire
- **Statut** : TODO - Planifié  
- **Région** : Mali, Côte d'Ivoire, Burkina Faso
- **Population** : ~12 millions de locuteurs
- **Priorité** : Haute (large couverture géographique)

#### Vocabulaire Clé Dioula
```
Vendre = feereli
Acheter = san
Argent = wari
Aujourd'hui = bi
Stock = stock (emprunté)
Pain = kini
Riz = malo
Eau = ji
Merci = nba
Oui = ɔɔn
Non = ayi
```

#### Exemples de Commandes Dioula
```
feereli 1000         → vente 1000
san 500 malo         → dépense 500 riz
stock malo 10        → stock riz 10
compte bi            → bilan aujourd'hui
nba                  → merci
```

## Plan d'Implémentation

### Phase 1 : Mooré (Q1 2024)
1. **Recherche linguistique**
   - Validation du vocabulaire avec des locuteurs natifs
   - Adaptation des termes commerciaux au contexte burkinabè
   
2. **Implémentation technique**
   - Création des patterns de reconnaissance
   - Messages de réponse traduits
   - Tests avec utilisateurs pilotes

3. **Validation**
   - Tests utilisateurs au Burkina Faso
   - Ajustements basés sur les retours

### Phase 2 : Dioula (Q2 2024)
1. **Recherche linguistique**
   - Étude des variantes régionales (Mali vs Côte d'Ivoire)
   - Standardisation du vocabulaire commercial
   
2. **Implémentation technique**
   - Patterns de reconnaissance adaptés
   - Interface utilisateur traduite
   - Gestion des variantes dialectales

3. **Déploiement progressif**
   - Lancement pilote au Mali
   - Extension en Côte d'Ivoire
   - Monitoring et optimisation

### Phase 3 : Optimisation (Q3 2024)
1. **Détection automatique de langue**
   - Amélioration des algorithmes de détection
   - Support du code-switching (mélange de langues)
   
2. **Interface adaptative**
   - Préférences utilisateur persistantes
   - Basculement dynamique entre langues
   
3. **Analytics multilingues**
   - Métriques d'usage par langue
   - Optimisation des performances

## Défis Techniques

### 1. Détection de Langue
- **Problème** : Distinction entre langues similaires
- **Solution** : Mots-clés spécifiques + contexte utilisateur

### 2. Variations Dialectales
- **Problème** : Différences régionales dans le dioula
- **Solution** : Patterns flexibles + apprentissage adaptatif

### 3. Code-Switching
- **Problème** : Utilisateurs mélangeant français et langues locales
- **Solution** : Reconnaissance multi-langue dans un même message

### 4. Clavier et Saisie
- **Problème** : Caractères spéciaux (ɛ, ɔ, ã, etc.)
- **Solution** : Support des variantes ASCII + auto-correction

## Ressources Nécessaires

### Linguistiques
- Consultants natifs pour chaque langue
- Dictionnaires commerciaux spécialisés
- Validation communautaire

### Techniques  
- Extension du système de patterns
- Tests automatisés multilingues
- Infrastructure de déploiement par région

### Marketing
- Campagnes de sensibilisation locales
- Partenariats avec associations de commerçants
- Formation des utilisateurs

## Métriques de Succès

### Adoption
- % d'utilisateurs utilisant les langues locales
- Rétention par langue
- Croissance des nouveaux utilisateurs

### Qualité
- Taux de reconnaissance correcte des commandes
- Satisfaction utilisateur par langue
- Temps de réponse du support

### Impact Business
- Volume de transactions par langue
- Expansion géographique
- Revenus par région linguistique

## Notes d'Implémentation

### Structure de Code
```typescript
// Patterns pour chaque langue
private readonly morePatterns: LanguagePatterns = { ... };
private readonly dioulaPatterns: LanguagePatterns = { ... };

// Détection de langue étendue
private detectLanguage(text: string): 'fr' | 'wo' | 'mo' | 'di' { ... }

// Messages traduits
private getLocalizedMessage(key: string, language: string): string { ... }
```

### Base de Données
```sql
-- Table pour préférences linguistiques
CREATE TABLE user_language_preferences (
  user_id UUID PRIMARY KEY,
  preferred_language VARCHAR(2) NOT NULL,
  fallback_language VARCHAR(2) DEFAULT 'fr',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Configuration
```json
{
  "supportedLanguages": ["fr", "wo", "mo", "di"],
  "defaultLanguage": "fr",
  "languageDetection": {
    "enabled": true,
    "confidence_threshold": 0.7
  }
}
```

---

**Note** : Cette feuille de route est évolutive et sera mise à jour selon les retours utilisateurs et les priorités business.