# Requirements Document

## Introduction

Ce document définit les exigences pour un système d'inscription d'employés via WhatsApp qui permet aux propriétaires d'entreprise d'inviter facilement leurs employés à rejoindre leur compte business. Le système utilise un code d'invitation unique pour chaque entreprise et gère des flux de conversation multi-étapes pour une expérience utilisateur fluide. L'objectif est de permettre l'onboarding sécurisé d'employés sans friction tout en maintenant un contrôle d'accès basé sur les rôles.

## Requirements

### Requirement 1 - Génération et gestion des codes d'entreprise

**User Story:** En tant que propriétaire d'entreprise, je veux obtenir un code d'invitation unique lors de la création de mon compte, afin de pouvoir facilement inviter mes employés sans partager d'informations sensibles.

#### Acceptance Criteria

1. WHEN un propriétaire crée son compte entreprise THEN le système SHALL générer automatiquement un code d'invitation unique de 6 caractères alphanumériques
2. WHEN le code d'entreprise est généré THEN il SHALL être unique dans toute la base de données
3. WHEN le propriétaire termine son inscription THEN le système SHALL lui communiquer son code d'invitation dans le message de confirmation
4. WHEN un propriétaire demande son code d'entreprise THEN le système SHALL le lui fournir s'il est authentifié
5. WHEN le code d'entreprise est affiché THEN il SHALL être formaté de manière claire (ex: "ABC123")

### Requirement 2 - Détection automatique du type d'utilisateur

**User Story:** En tant que nouvel utilisateur contactant le bot, je veux que le système comprenne automatiquement si je suis un propriétaire ou un employé, afin d'être dirigé vers le bon processus d'inscription.

#### Acceptance Criteria

1. WHEN un nouvel utilisateur envoie un message de salutation THEN le système SHALL proposer de choisir entre "Propriétaire d'entreprise" et "Employé"
2. WHEN l'utilisateur choisit "Propriétaire d'entreprise" THEN le système SHALL initier le flux d'inscription propriétaire
3. WHEN l'utilisateur choisit "Employé" THEN le système SHALL initier le flux d'inscription employé
4. WHEN l'utilisateur envoie une réponse ambiguë THEN le système SHALL redemander de préciser son statut
5. WHEN l'utilisateur utilise des mots-clés spécifiques (ex: "code invitation") THEN le système SHALL automatiquement détecter qu'il s'agit d'un employé

### Requirement 3 - Inscription des propriétaires d'entreprise

**User Story:** En tant que nouveau propriétaire d'entreprise, je veux créer mon compte facilement via WhatsApp, afin de commencer à utiliser le bot pour gérer mon business.

#### Acceptance Criteria

1. WHEN un propriétaire commence son inscription THEN le système SHALL demander le nom de son entreprise
2. WHEN le nom d'entreprise est fourni THEN le système SHALL demander le nom complet du propriétaire
3. WHEN toutes les informations sont collectées THEN le système SHALL créer l'entreprise et le compte utilisateur
4. WHEN l'inscription est terminée THEN le système SHALL fournir le code d'invitation et expliquer comment l'utiliser
5. WHEN l'inscription échoue THEN le système SHALL expliquer l'erreur et permettre de recommencer

### Requirement 4 - Validation des codes d'entreprise

**User Story:** En tant qu'employé avec un code d'invitation, je veux que le système vérifie rapidement si mon code est valide, afin de savoir immédiatement si je peux rejoindre l'entreprise.

#### Acceptance Criteria

1. WHEN un employé saisit un code d'entreprise THEN le système SHALL vérifier son format (6 caractères alphanumériques)
2. WHEN le format du code est invalide THEN le système SHALL expliquer le format attendu avec un exemple
3. WHEN le code est au bon format THEN le système SHALL vérifier son existence dans la base de données
4. WHEN le code existe THEN le système SHALL afficher le nom de l'entreprise pour confirmation
5. WHEN le code n'existe pas THEN le système SHALL indiquer que le code est invalide et suggérer de vérifier avec le patron

### Requirement 5 - Inscription des employés

**User Story:** En tant qu'employé avec un code d'invitation valide, je veux m'inscrire rapidement, afin de commencer à utiliser le bot pour mon travail.

#### Acceptance Criteria

1. WHEN un employé fournit un code valide THEN le système SHALL demander son nom complet
2. WHEN le nom est fourni THEN le système SHALL proposer de choisir son rôle (Vendeur ou Manager)
3. WHEN le rôle "Vendeur" est choisi THEN le système SHALL assigner les permissions de base (ventes, consultation stock)
4. WHEN le rôle "Manager" est choisi THEN le système SHALL assigner les permissions étendues (ventes, dépenses, stock, rapports)
5. WHEN l'inscription est terminée THEN le système SHALL confirmer l'inscription et expliquer les permissions accordées

### Requirement 6 - Gestion des états de conversation

**User Story:** En tant qu'utilisateur en cours d'inscription, je veux que le bot se souvienne de notre conversation, afin de ne pas avoir à recommencer si j'envoie un message incorrect.

#### Acceptance Criteria

1. WHEN un utilisateur commence une inscription THEN le système SHALL sauvegarder l'état de la conversation
2. WHEN l'utilisateur envoie une réponse incorrecte THEN le système SHALL maintenir le contexte et redemander l'information
3. WHEN l'utilisateur ne répond pas pendant 30 minutes THEN le système SHALL expirer la session d'inscription
4. WHEN une session expire THEN l'utilisateur SHALL pouvoir recommencer une nouvelle inscription
5. WHEN l'inscription est terminée ou annulée THEN le système SHALL nettoyer l'état de conversation

### Requirement 7 - Contrôle d'accès basé sur les rôles

**User Story:** En tant que propriétaire, je veux que mes employés aient accès uniquement aux fonctionnalités appropriées à leur rôle, afin de protéger les données sensibles de mon entreprise.

#### Acceptance Criteria

1. WHEN un vendeur tente d'enregistrer une dépense THEN le système SHALL refuser l'accès avec un message explicatif
2. WHEN un vendeur demande un rapport financier THEN le système SHALL refuser l'accès
3. WHEN un manager utilise toutes les fonctionnalités autorisées THEN le système SHALL traiter les demandes normalement
4. WHEN un propriétaire utilise n'importe quelle fonctionnalité THEN le système SHALL autoriser l'accès complet
5. WHEN un utilisateur tente une action non autorisée THEN le système SHALL expliquer clairement les permissions de son rôle

### Requirement 8 - Messages d'erreur et guidance

**User Story:** En tant qu'utilisateur faisant une erreur pendant l'inscription, je veux recevoir des messages clairs, afin de comprendre comment corriger le problème.

#### Acceptance Criteria

1. WHEN un utilisateur saisit un code d'entreprise invalide THEN le système SHALL expliquer le problème et donner des conseils
2. WHEN un utilisateur ne répond pas dans le format attendu THEN le système SHALL reformuler la question avec des exemples
3. WHEN une erreur technique survient THEN le système SHALL s'excuser et proposer de recommencer
4. WHEN l'inscription échoue THEN le système SHALL expliquer la cause et les étapes pour résoudre
5. WHEN l'utilisateur semble perdu THEN le système SHALL proposer de l'aide ou de recommencer

### Requirement 9 - Sécurité et validation

**User Story:** En tant que propriétaire d'entreprise, je veux que seules les personnes autorisées puissent rejoindre mon entreprise, afin de protéger mes données business.

#### Acceptance Criteria

1. WHEN un employé s'inscrit THEN le système SHALL vérifier son numéro de téléphone par OTP
2. WHEN l'OTP est validé THEN le système SHALL permettre de continuer l'inscription
3. WHEN un numéro existe déjà THEN le système SHALL empêcher la création d'un doublon
4. WHEN un code d'entreprise est utilisé THEN le système SHALL logger l'événement pour audit
5. WHEN des tentatives suspectes sont détectées THEN le système SHALL implémenter des mesures de protection

### Requirement 10 - Expérience utilisateur fluide

**User Story:** En tant qu'utilisateur mobile avec une connexion limitée, je veux que le processus d'inscription soit rapide et efficace, afin de ne pas consommer trop de data ni de temps.

#### Acceptance Criteria

1. WHEN l'inscription commence THEN le système SHALL guider l'utilisateur étape par étape
2. WHEN chaque étape est complétée THEN le système SHALL confirmer avec un emoji ou symbole visuel
3. WHEN l'utilisateur progresse THEN le système SHALL indiquer combien d'étapes restent
4. WHEN l'inscription est terminée THEN le système SHALL fournir un résumé clair des prochaines actions possibles
5. WHEN l'utilisateur a besoin d'aide THEN le système SHALL fournir des exemples concrets et des formats attendus