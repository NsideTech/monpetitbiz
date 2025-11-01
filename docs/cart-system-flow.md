# Flux du Système de Panier

## Diagramme de Flux Principal

```mermaid
graph TD
    A[Client arrive] --> B{Panier actif?}
    B -->|Non| C[Commande: ajouter produit X]
    B -->|Oui| D[Commande: ajouter/retirer/voir]
    
    C --> E[Créer nouvelle session]
    E --> F[Valider produit et stock]
    F --> G{Produit valide?}
    G -->|Non| H[Erreur: produit inexistant]
    G -->|Oui| I{Stock suffisant?}
    I -->|Non| J[Erreur: stock insuffisant]
    I -->|Oui| K[Ajouter au panier]
    
    D --> L{Type de commande?}
    L -->|Ajouter| F
    L -->|Retirer| M[Retirer du panier]
    L -->|Voir| N[Afficher panier]
    L -->|Finaliser| O[Valider stock final]
    L -->|Annuler| P[Supprimer session]
    
    K --> Q[Afficher panier mis à jour]
    M --> Q
    N --> Q
    
    O --> R{Stock OK pour tous?}
    R -->|Non| S[Erreur: stock insuffisant]
    R -->|Oui| T[Enregistrer transaction]
    T --> U[Mettre à jour stock]
    U --> V[Générer facture]
    V --> W[Envoyer facture]
    W --> X[Terminer session]
    
    P --> Y[Confirmer annulation]
    
    Q --> Z[Attendre prochaine commande]
    Z --> D
```

## États de Session

```mermaid
stateDiagram-v2
    [*] --> Inactive
    Inactive --> Active : startSession()
    Active --> Active : addItem() / removeItem()
    Active --> Completed : completeSession()
    Active --> Cancelled : cancelSession()
    Active --> Expired : timeout (30min)
    Completed --> [*] : cleanup (5min)
    Cancelled --> [*]
    Expired --> [*]
```

## Flux de Données

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant B as BotController
    participant S as SaleSessionService
    participant St as StockService
    participant T as TransactionService
    participant I as InvoiceService
    
    U->>B: "ajouter pain 5"
    B->>S: startSession() ou getCurrentSession()
    B->>St: getStockLevel("pain")
    B->>St: getUnitPrice("pain")
    
    alt Stock et prix OK
        B->>S: addItem({pain, 5, 250, 1250})
        S->>B: session mise à jour
        B->>U: "Panier mis à jour + résumé"
    else Stock insuffisant
        B->>U: "Erreur stock insuffisant"
    end
    
    U->>B: "finaliser"
    B->>S: getCurrentSession()
    
    loop Pour chaque item
        B->>St: validateStock(item)
    end
    
    alt Tous les stocks OK
        B->>T: recordTransaction()
        loop Pour chaque item
            B->>St: decrementStock(item)
        end
        B->>I: generateInvoice(session)
        B->>S: completeSession()
        B->>U: "Facture générée"
    else Stock insuffisant
        B->>U: "Erreur validation finale"
    end
```

## Architecture des Services

```mermaid
graph LR
    subgraph "WhatsApp Module"
        BC[BotController]
        CP[CommandParser]
        SS[SaleSessionService]
        CH[CartHandlers]
    end
    
    subgraph "Stock Module"
        StS[StockService]
        UMS[UnitManagementService]
    end
    
    subgraph "Transaction Module"
        TS[TransactionService]
    end
    
    subgraph "Invoice Module"
        IS[InvoiceService]
    end
    
    BC --> CP
    BC --> SS
    BC --> CH
    CH --> SS
    CH --> StS
    CH --> TS
    CH --> IS
    StS --> UMS
```

## Gestion des Erreurs

```mermaid
graph TD
    A[Commande reçue] --> B{Session valide?}
    B -->|Non| C[Créer session si ajout]
    B -->|Oui| D{Commande valide?}
    
    C --> E{Première commande = ajout?}
    E -->|Non| F[Erreur: pas de panier]
    E -->|Oui| D
    
    D -->|Non| G[Erreur: format invalide]
    D -->|Oui| H{Produit existe?}
    
    H -->|Non| I[Erreur: produit inexistant]
    H -->|Oui| J{Stock suffisant?}
    
    J -->|Non| K[Erreur: stock insuffisant]
    J -->|Oui| L[Exécuter commande]
    
    L --> M{Succès?}
    M -->|Non| N[Erreur technique]
    M -->|Oui| O[Réponse succès]
    
    F --> P[Message d'aide]
    G --> P
    I --> Q[Suggestions produits]
    K --> R[Suggestion quantité max]
    N --> S[Message erreur générique]
```

## Optimisations et Considérations

### Performance
- **Sessions en mémoire** : Accès rapide mais perte au redémarrage
- **Cleanup automatique** : Évite l'accumulation de sessions orphelines
- **Validation lazy** : Stock validé seulement à la finalisation

### Sécurité
- **Validation utilisateur** : Chaque action vérifie l'authentification
- **Isolation des sessions** : Une session par numéro de téléphone
- **Expiration automatique** : Évite les sessions infinies

### Scalabilité
- **État stateless** : Facile à distribuer sur plusieurs instances
- **Cleanup périodique** : Maintient la mémoire propre
- **Validation différée** : Réduit les appels à la base de données

### Extensibilité
- **Interface modulaire** : Facile d'ajouter de nouveaux types de commandes
- **Handlers séparés** : Logique métier isolée
- **Services découplés** : Chaque service a une responsabilité claire

---

**Note** : Ce flux est conçu pour être robuste et gérer tous les cas d'erreur tout en offrant une expérience utilisateur fluide.