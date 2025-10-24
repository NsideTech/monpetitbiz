# Requirements Document

## Introduction

Ce document définit les exigences pour un système d'onboarding des marchands via WhatsApp. Le système permet aux nouveaux marchands de créer une entreprise en fournissant des informations de base et en validant l'unicité de leur numéro de téléphone. Le processus est entièrement conversationnel et guidé à travers l'interface WhatsApp existante.

## Requirements

### Requirement 1

**User Story:** En tant que marchand, je veux pouvoir initier la création d'une nouvelle entreprise via WhatsApp en saisissant "créer une nouvelle entreprise", afin de commencer le processus d'onboarding.

#### Acceptance Criteria

1. WHEN un utilisateur envoie le message "créer une nouvelle entreprise" THEN le système SHALL démarrer le processus d'onboarding
2. WHEN le processus d'onboarding démarre THEN le système SHALL demander le nom de l'entreprise
3. IF l'utilisateur envoie un message différent de "créer une nouvelle entreprise" THEN le système SHALL ignorer la demande d'onboarding

### Requirement 2

**User Story:** En tant que marchand, je veux fournir le nom de mon entreprise et mon nom en tant que propriétaire, afin que ces informations soient enregistrées dans le système.

#### Acceptance Criteria

1. WHEN le système demande le nom de l'entreprise THEN l'utilisateur SHALL pouvoir saisir le nom de l'entreprise
2. WHEN l'utilisateur fournit le nom de l'entreprise THEN le système SHALL demander le nom du propriétaire
3. WHEN l'utilisateur fournit le nom du propriétaire THEN le système SHALL valider que les deux champs sont non vides
4. IF le nom de l'entreprise ou le nom du propriétaire est vide THEN le système SHALL redemander l'information manquante

### Requirement 3

**User Story:** En tant que système, je veux extraire automatiquement le pays et le numéro de téléphone à partir du numéro WhatsApp de l'utilisateur, afin d'enregistrer ces informations sans demander de saisie supplémentaire.

#### Acceptance Criteria

1. WHEN un utilisateur initie l'onboarding THEN le système SHALL extraire le numéro de téléphone complet depuis WhatsApp
2. WHEN le numéro est extrait THEN le système SHALL identifier le code pays automatiquement
3. WHEN le code pays est identifié THEN le système SHALL stocker le pays et le numéro séparément
4. IF le numéro de téléphone ne peut pas être extrait THEN le système SHALL rejeter la demande d'onboarding

### Requirement 4

**User Story:** En tant que système, je veux gérer intelligemment les numéros de téléphone existants en proposant soit de rejoindre l'entreprise existante soit de créer une nouvelle entreprise selon le contexte.

#### Acceptance Criteria

1. WHEN toutes les informations sont collectées THEN le système SHALL vérifier si le numéro de téléphone existe déjà
2. IF le numéro de téléphone est déjà associé à une entreprise en tant que propriétaire THEN le système SHALL rejeter la création d'une nouvelle entreprise
3. IF le numéro de téléphone est déjà associé à une entreprise en tant que propriétaire THEN le système SHALL informer l'utilisateur qu'il possède déjà une entreprise
4. IF le numéro de téléphone est déjà associé à une entreprise en tant qu'employé THEN le système SHALL proposer de créer une nouvelle entreprise ou de rester employé
5. IF le numéro de téléphone est unique THEN le système SHALL procéder à la création de l'entreprise

### Requirement 5

**User Story:** En tant que marchand, je veux recevoir une confirmation claire du succès ou de l'échec de la création de mon entreprise, afin de savoir si je peux commencer à utiliser le système.

#### Acceptance Criteria

1. WHEN l'entreprise est créée avec succès THEN le système SHALL envoyer un message de confirmation
2. WHEN l'entreprise est créée avec succès THEN le système SHALL fournir les détails de l'entreprise créée
3. IF la création échoue THEN le système SHALL expliquer la raison de l'échec
4. WHEN la confirmation est envoyée THEN le système SHALL terminer le processus d'onboarding

### Requirement 6

**User Story:** En tant qu'employé, je veux pouvoir rejoindre une entreprise existante en utilisant un code d'employé, afin d'accéder au système sans créer une nouvelle entreprise.

#### Acceptance Criteria

1. WHEN un utilisateur avec un numéro déjà associé à une entreprise tente de créer une nouvelle entreprise THEN le système SHALL proposer de rejoindre l'entreprise existante
2. WHEN un utilisateur souhaite rejoindre une entreprise THEN le système SHALL demander le code d'employé
3. WHEN un code d'employé valide est fourni THEN le système SHALL associer l'utilisateur à l'entreprise correspondante
4. IF le code d'employé est invalide ou expiré THEN le système SHALL rejeter la demande et expliquer l'erreur
5. WHEN l'association employé-entreprise est réussie THEN le système SHALL confirmer l'accès avec les permissions appropriées

### Requirement 7

**User Story:** En tant que propriétaire d'entreprise, je veux pouvoir générer des codes d'employé pour permettre à mes employés de rejoindre mon entreprise, afin de gérer mon équipe efficacement.

#### Acceptance Criteria

1. WHEN un propriétaire d'entreprise demande un code d'employé THEN le système SHALL générer un code unique temporaire
2. WHEN un code d'employé est généré THEN le système SHALL définir une durée de validité
3. WHEN un code d'employé est généré THEN le système SHALL l'associer à l'entreprise du propriétaire
4. IF un code d'employé expire THEN le système SHALL le désactiver automatiquement

### Requirement 8

**User Story:** En tant qu'administrateur système, je veux que le processus d'onboarding soit intégré au système d'authentification existant, afin que les nouveaux marchands puissent immédiatement utiliser leurs identifiants.

#### Acceptance Criteria

1. WHEN une entreprise est créée THEN le système SHALL créer automatiquement un utilisateur propriétaire
2. WHEN l'utilisateur propriétaire est créé THEN le système SHALL l'associer à l'entreprise
3. WHEN l'association est faite THEN le système SHALL générer les permissions appropriées pour le propriétaire
4. WHEN un employé rejoint une entreprise THEN le système SHALL créer un utilisateur avec des permissions d'employé
5. IF la création de l'utilisateur échoue THEN le système SHALL annuler l'opération correspondante