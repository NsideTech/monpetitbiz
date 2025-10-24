# Implementation Plan

- [x] 1. Créer le service de validation des numéros de téléphone
  - Implémenter la classe `PhoneValidationService` avec extraction du pays depuis WhatsApp
  - Créer les méthodes de vérification du statut des numéros existants
  - Ajouter la validation du format des numéros de téléphone
  - _Requirements: 3.1, 3.2, 3.3, 4.1_

- [x] 2. Implémenter le middleware de vérification d'onboarding
  - Créer la classe `OnboardingCheckMiddleware` pour intercepter les messages
  - Implémenter la logique de vérification du statut d'onboarding des utilisateurs
  - Ajouter les messages de redirection contextuels selon l'action tentée
  - Intégrer le middleware dans le flux de traitement des messages WhatsApp
  - _Requirements: 1.1, 1.3_

- [x] 3. Étendre le RegistrationHandlerService pour l'onboarding des marchands
  - Ajouter la détection d'intention "créer une nouvelle entreprise"
  - Implémenter le flux de collecte du nom d'entreprise avec validation
  - Implémenter le flux de collecte du nom du propriétaire avec validation
  - Créer la gestion d'état conversationnel pour l'onboarding des marchands
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

- [x] 4. Implémenter la gestion des conflits de numéros existants
  - Créer le service `ConflictResolutionService` pour gérer les numéros existants
  - Implémenter la logique de rejet pour les propriétaires existants
  - Implémenter la logique de proposition d'options pour les employés existants
  - Ajouter les messages d'explication des conflits et options disponibles
  - _Requirements: 4.2, 4.3, 4.4, 6.1_

- [x] 5. Étendre l'AuthService pour la création d'entreprises
  - Ajouter la méthode `createBusinessWithOwner` pour créer entreprise et propriétaire
  - Implémenter la génération automatique des codes d'entreprise uniques
  - Ajouter la validation d'unicité des noms d'entreprise
  - Intégrer l'extraction du pays dans la création d'utilisateur
  - _Requirements: 8.1, 8.2, 8.3, 3.3_

- [x] 6. Implémenter les messages de confirmation et d'erreur
  - Créer les templates de messages de succès avec détails de l'entreprise
  - Implémenter les messages d'erreur contextuels selon le type d'échec
  - Ajouter les messages de guidance pour les erreurs de validation
  - Créer les messages de progression du processus d'onboarding
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. Ajouter les extensions aux entités de base de données
  - Ajouter les colonnes `ownerName` et `country` à l'entité Business
  - Créer les migrations de base de données pour les nouvelles colonnes
  - Mettre à jour les index pour optimiser les requêtes de vérification
  - _Requirements: 3.3, 8.1_

- [ ]* 8. Créer les tests unitaires pour les services d'onboarding
  - Écrire les tests pour `PhoneValidationService`
  - Écrire les tests pour `OnboardingCheckMiddleware`
  - Écrire les tests pour `ConflictResolutionService`
  - Écrire les tests pour les extensions d'`AuthService`
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [ ]* 9. Créer les tests d'intégration pour les flux complets
  - Tester le flux complet d'onboarding d'un nouveau marchand
  - Tester la gestion des conflits avec numéros existants
  - Tester l'intégration avec le système d'authentification
  - Tester les cas d'erreur et la récupération
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ]* 10. Créer les tests conversationnels
  - Tester les différentes variantes de messages d'intention d'onboarding
  - Tester la gestion des erreurs de saisie et corrections
  - Tester l'abandon et la reprise de conversation
  - Tester les messages d'aide et de guidance
  - _Requirements: 1.1, 2.4, 5.3_