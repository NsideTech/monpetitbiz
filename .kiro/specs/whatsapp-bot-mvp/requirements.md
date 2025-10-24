# Requirements Document

## Introduction

Ce document définit les exigences pour un bot WhatsApp MVP destiné aux micro-entreprises du secteur informel en Afrique. Le bot permet d'enregistrer les transactions commerciales en langage naturel, de suivre le stock et de générer des rapports financiers simples. L'objectif est de fournir un outil accessible via WhatsApp pour structurer les données de base des petites entreprises sans friction d'adoption.

## Requirements

### Requirement 1 - Enregistrement des ventes

**User Story:** En tant que vendeuse de boutique, je veux enregistrer rapidement une vente via WhatsApp, afin de suivre mes revenus quotidiens sans interrompre mon activité commerciale.

#### Acceptance Criteria

1. WHEN l'utilisateur envoie un message de vente (ex: "vente 5000 CFA pain") THEN le système SHALL enregistrer la transaction avec montant, produit et horodatage
2. WHEN l'utilisateur envoie une vente sans détail produit (ex: "vente 3000") THEN le système SHALL enregistrer la transaction avec montant uniquement
3. WHEN une vente est enregistrée THEN le système SHALL confirmer l'enregistrement par un message de retour
4. WHEN l'utilisateur utilise des variantes en langage naturel (ex: "j'ai vendu du pain à 2000") THEN le système SHALL reconnaître et traiter la transaction

### Requirement 2 - Enregistrement des dépenses

**User Story:** En tant que propriétaire de boutique, je veux enregistrer mes dépenses via WhatsApp, afin de suivre mes coûts et calculer ma marge bénéficiaire.

#### Acceptance Criteria

1. WHEN l'utilisateur envoie un message de dépense (ex: "dépense 10000 achat marchandise") THEN le système SHALL enregistrer la dépense avec montant, description et horodatage
2. WHEN l'utilisateur envoie une dépense sans description (ex: "dépense 5000") THEN le système SHALL enregistrer la dépense avec montant uniquement
3. WHEN une dépense est enregistrée THEN le système SHALL confirmer l'enregistrement par un message de retour
4. WHEN l'utilisateur utilise des variantes en langage naturel pour les dépenses THEN le système SHALL reconnaître et traiter la transaction

### Requirement 3 - Gestion du stock

**User Story:** En tant que vendeuse, je veux mettre à jour mon stock via WhatsApp, afin de connaître en temps réel la disponibilité de mes produits.

#### Acceptance Criteria

1. WHEN l'utilisateur envoie "stock pain 50" THEN le système SHALL mettre à jour la quantité du produit à 50 unités
2. WHEN l'utilisateur demande "stock pain" THEN le système SHALL retourner la quantité actuelle du produit
3. WHEN l'utilisateur demande "stock" sans préciser de produit THEN le système SHALL retourner la liste de tous les produits avec leurs quantités
4. WHEN une vente est enregistrée avec un produit THEN le système SHALL automatiquement décrémenter le stock si disponible

### Requirement 4 - Génération de bilans

**User Story:** En tant que propriétaire, je veux obtenir un bilan de mes activités, afin d'évaluer la performance de mon entreprise sur différentes périodes.

#### Acceptance Criteria

1. WHEN l'utilisateur demande "bilan jour" THEN le système SHALL retourner le résumé des ventes et dépenses du jour
2. WHEN l'utilisateur demande "bilan semaine" THEN le système SHALL retourner le résumé des 7 derniers jours
3. WHEN l'utilisateur demande "bilan mois" THEN le système SHALL retourner le résumé du mois en cours
4. WHEN un bilan est généré THEN le système SHALL inclure total des ventes, total des dépenses, et bénéfice net
5. WHEN un bilan est demandé THEN le système SHALL répondre dans un délai maximum de 5 secondes

### Requirement 5 - Rapports automatiques quotidiens

**User Story:** En tant que propriétaire, je veux recevoir automatiquement un rapport quotidien à 20h, afin de connaître les performances de la journée sans avoir à le demander.

#### Acceptance Criteria

1. WHEN il est 20h00 chaque jour THEN le système SHALL envoyer automatiquement un rapport quotidien
2. WHEN le rapport quotidien est envoyé THEN il SHALL inclure le total des ventes, dépenses et bénéfice du jour
3. WHEN il n'y a eu aucune activité dans la journée THEN le système SHALL envoyer un message indiquant "Aucune activité aujourd'hui"
4. WHEN l'utilisateur est dans un fuseau horaire différent THEN le système SHALL respecter l'heure locale de l'entreprise

### Requirement 6 - Génération de rapports PDF

**User Story:** En tant que propriétaire, je veux générer un rapport PDF partageable, afin de présenter mes données financières à des partenaires ou institutions financières.

#### Acceptance Criteria

1. WHEN l'utilisateur demande "rapport PDF" THEN le système SHALL générer un PDF avec les données de la période demandée
2. WHEN le PDF est généré THEN le système SHALL l'envoyer via WhatsApp sous forme de document
3. WHEN le PDF est créé THEN il SHALL inclure un résumé des ventes, dépenses, et évolution sur la période
4. WHEN la génération PDF échoue THEN le système SHALL informer l'utilisateur et proposer une alternative

### Requirement 7 - Authentification et gestion des rôles

**User Story:** En tant que propriétaire, je veux contrôler qui peut accéder aux données de mon entreprise, afin de sécuriser mes informations financières.

#### Acceptance Criteria

1. WHEN un nouvel utilisateur contacte le bot THEN le système SHALL demander une authentification par OTP SMS ou WhatsApp
2. WHEN l'authentification est réussie THEN le système SHALL assigner le rôle approprié (owner ou seller)
3. WHEN un utilisateur avec rôle "seller" tente d'accéder aux bilans THEN le système SHALL refuser l'accès
4. WHEN un utilisateur avec rôle "owner" demande des rapports THEN le système SHALL autoriser l'accès complet

### Requirement 8 - Support multilingue

**User Story:** En tant qu'utilisateur parlant une langue locale, je veux utiliser le bot dans ma langue, afin d'interagir naturellement sans barrière linguistique.

#### Acceptance Criteria

1. WHEN l'utilisateur configure sa langue préférée THEN le système SHALL répondre dans cette langue
2. WHEN l'utilisateur envoie des commandes en français THEN le système SHALL les traiter correctement
3. WHEN l'utilisateur envoie des commandes dans une langue locale supportée THEN le système SHALL les traiter correctement
4. WHEN une langue n'est pas supportée THEN le système SHALL utiliser le français par défaut

### Requirement 9 - Dashboard web en lecture seule

**User Story:** En tant que propriétaire, je veux consulter un tableau de bord web, afin de visualiser l'historique de mes données sur un écran plus grand.

#### Acceptance Criteria

1. WHEN l'utilisateur accède au dashboard web THEN il SHALL voir la liste de ses transactions
2. WHEN l'utilisateur consulte le dashboard THEN il SHALL voir les totaux par période (jour/semaine/mois)
3. WHEN l'utilisateur tente de modifier des données via le web THEN le système SHALL empêcher toute modification
4. WHEN l'utilisateur n'est pas authentifié THEN le système SHALL rediriger vers une page de connexion

### Requirement 10 - Performance et fiabilité

**User Story:** En tant qu'utilisateur avec une connexion limitée, je veux que le bot réponde rapidement, afin de ne pas consommer trop de data ni attendre longtemps.

#### Acceptance Criteria

1. WHEN l'utilisateur envoie une commande simple THEN le système SHALL répondre en moins de 3 secondes
2. WHEN le système est en maintenance THEN il SHALL informer les utilisateurs avec un message d'attente
3. WHEN une erreur survient THEN le système SHALL envoyer un message d'erreur compréhensible
4. WHEN les données sont sauvegardées THEN elles SHALL être persistées de manière fiable