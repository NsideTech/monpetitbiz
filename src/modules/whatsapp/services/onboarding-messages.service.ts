import { Injectable } from '@nestjs/common';

export interface BusinessDetails {
  businessName: string;
  ownerName: string;
  businessCode: string;
  phoneNumber?: string;
  country?: string;
}

export interface ErrorContext {
  errorType: 'validation' | 'conflict' | 'technical' | 'unauthorized';
  field?: string;
  attemptCount?: number;
  maxAttempts?: number;
  details?: string;
}

export interface ProgressContext {
  currentStep: string;
  totalSteps: number;
  stepName: string;
  completedSteps: string[];
}

@Injectable()
export class OnboardingMessagesService {

  /**
   * Get success confirmation message with business details
   * Requirement 5.1: WHEN l'entreprise est créée avec succès THEN le système SHALL envoyer un message de confirmation
   * Requirement 5.2: WHEN l'entreprise est créée avec succès THEN le système SHALL fournir les détails de l'entreprise créée
   */
  getSuccessConfirmationMessage(businessDetails: BusinessDetails, products?: Array<{ name: string; price: number }>, skipped?: boolean): string {
    const { businessName, ownerName, businessCode } = businessDetails;

    let message = `🎉 **Félicitations ! Votre entreprise a été créée avec succès !**\n\n` +
      `✅ **Détails de votre entreprise :**\n` +
      `🏢 **Nom :** ${businessName}\n` +
      `👤 **Propriétaire :** ${ownerName}\n` +
      `🔑 **Code entreprise :** ${businessCode}\n\n`;

    if (products && products.length > 0) {
      message += `📦 **Produits configurés (${products.length}) :**\n`;
      products.forEach((product, index) => {
        message += `${index + 1}. ${product.name} - ${product.price} FCFA\n`;
      });
      message += `\n`;
    } else if (skipped) {
      message += `💡 **Note :** Vous pouvez ajouter des produits plus tard avec la commande "prix [nom_produit] [montant]"\n\n`;
    }

    message += `📋 **Prochaines étapes :**\n` +
      `• Partagez le code ${businessCode} avec vos employés\n` +
      `• Commencez à enregistrer vos ventes avec "vente"\n` +
      `• Gérez votre stock avec "stock"\n` +
      `• Consultez vos rapports avec "rapport"\n\n` +
      `💡 Tapez "aide" à tout moment pour voir toutes les commandes disponibles.\n\n` +
      `Bienvenue dans votre nouveau système de gestion ! 🚀`;

    return message;
  }

  /**
   * Get product setup start message
   */
  getProductSetupStartMessage(businessName: string, businessCode: string): string {
    return `🎉 **Entreprise créée avec succès !**\n\n` +
      `✅ **Votre entreprise :** ${businessName}\n` +
      `🔑 **Code entreprise :** ${businessCode}\n\n` +
      `📦 **Configuration des produits**\n\n` +
      `Maintenant, configurons vos produits avec leurs prix unitaires.\n\n` +
      `💡 **Format :** \`nom_produit: prix\`\n` +
      `**Exemples :**\n` +
      `• Pain: 500\n` +
      `• Lait: 750\n` +
      `• Riz: 1200\n\n` +
      `📝 **Commandes disponibles :**\n` +
      `• Ajoutez un produit : \`nom_produit: prix\`\n` +
      `• Terminer : \`terminer\` ou \`fin\`\n` +
      `• Passer cette étape : \`passer\`\n` +
      `• Aide : \`aide\`\n\n` +
      `Commencez par ajouter votre premier produit ! 🚀`;
  }

  /**
   * Get product added confirmation message
   */
  getProductAddedMessage(productName: string, price: number, totalProducts: number): string {
    return `✅ **Produit ajouté !**\n\n` +
      `📦 **${productName}** - ${price} FCFA\n\n` +
      `📊 **Total :** ${totalProducts} produit${totalProducts > 1 ? 's' : ''} configuré${totalProducts > 1 ? 's' : ''}\n\n` +
      `💡 **Prochaines actions :**\n` +
      `• Ajoutez un autre produit : \`nom_produit: prix\`\n` +
      `• Terminer : \`terminer\` ou \`fin\`\n` +
      `• Passer cette étape : \`passer\`\n\n` +
      `Continuez à ajouter vos produits ! 🚀`;
  }

  /**
   * Get product setup help message
   */
  getProductSetupHelpMessage(): string {
    return `ℹ️ **Aide - Configuration des produits**\n\n` +
      `📦 **Pourquoi configurer les produits ?**\n` +
      `• Facilite l'enregistrement des ventes\n` +
      `• Permet de suivre les prix automatiquement\n` +
      `• Améliore la gestion de votre stock\n\n` +
      `💡 **Format :** \`nom_produit: prix\`\n\n` +
      `✅ **Exemples valides :**\n` +
      `• Pain: 500\n` +
      `• Lait: 750\n` +
      `• Riz: 1200\n` +
      `• Tomate: 300\n` +
      `• Huile: 1500\n\n` +
      `📝 **Commandes disponibles :**\n` +
      `• \`nom_produit: prix\` - Ajouter un produit\n` +
      `• \`terminer\` ou \`fin\` - Terminer la configuration\n` +
      `• \`passer\` - Passer cette étape (vous pourrez ajouter des produits plus tard)\n` +
      `• \`aide\` - Afficher cette aide\n\n` +
      `💡 **Conseil :** Vous pouvez ajouter autant de produits que vous voulez. Tapez "terminer" quand vous avez fini !`;
  }

  /**
   * Get product setup error message
   */
  getProductSetupErrorMessage(): string {
    return `❌ **Format incorrect**\n\n` +
      `💡 **Format attendu :** \`nom_produit: prix\`\n\n` +
      `✅ **Exemples valides :**\n` +
      `• Pain: 500\n` +
      `• Lait: 750\n` +
      `• Riz: 1200\n\n` +
      `📝 **Autres formats acceptés :**\n` +
      `• Pain - 500\n` +
      `• Pain à 500\n` +
      `• Pain 500 FCFA\n\n` +
      `🔄 **Réessayez avec le format :** \`nom_produit: prix\`\n\n` +
      `💡 Tapez "aide" pour plus d'informations.`;
  }

  /**
   * Get contextual error messages based on failure type
   * Requirement 5.3: IF la création échoue THEN le système SHALL expliquer la raison de l'échec
   */
  getErrorMessage(context: ErrorContext): string {
    switch (context.errorType) {
      case 'validation':
        return this.getValidationErrorMessage(context);

      case 'conflict':
        return this.getConflictErrorMessage(context);

      case 'technical':
        return this.getTechnicalErrorMessage(context);

      case 'unauthorized':
        return this.getUnauthorizedErrorMessage(context);

      default:
        return this.getGenericErrorMessage();
    }
  }

  /**
   * Get validation error messages with guidance
   * Requirement 5.3: Messages de guidance pour les erreurs de validation
   */
  private getValidationErrorMessage(context: ErrorContext): string {
    const { field, attemptCount = 1, maxAttempts = 3, details } = context;

    const baseMessages = {
      businessName: {
        title: "❌ **Erreur - Nom d'entreprise invalide**",
        guidance: "💡 **Format attendu :**\n" +
          "• Entre 2 et 100 caractères\n" +
          "• Lettres, chiffres et espaces autorisés\n" +
          "• Exemples : \"Boutique Fatou\", \"Restaurant Chez Amadou\""
      },
      ownerName: {
        title: "❌ **Erreur - Nom du propriétaire invalide**",
        guidance: "💡 **Format attendu :**\n" +
          "• Entre 2 et 100 caractères\n" +
          "• Lettres et espaces autorisés\n" +
          "• Exemples : \"Fabrice Ilboudo\""
      },
      phoneNumber: {
        title: "❌ **Erreur - Numéro de téléphone invalide**",
        guidance: "💡 **Problème détecté :**\n" +
          "• Le numéro WhatsApp ne peut pas être extrait\n" +
          "• Vérifiez que vous utilisez WhatsApp Business\n" +
          "• Contactez le support si le problème persiste"
      }
    };

    const messageConfig = baseMessages[field] || {
      title: "❌ **Erreur de validation**",
      guidance: "💡 Veuillez vérifier le format de votre saisie."
    };

    let message = `${messageConfig.title}\n\n`;

    if (details) {
      message += `📝 **Détail :** ${details}\n\n`;
    }

    message += `${messageConfig.guidance}\n\n`;

    if (attemptCount < maxAttempts) {
      message += `🔄 **Tentative ${attemptCount}/${maxAttempts}** - Veuillez réessayer.\n\n`;
      message += `Tapez "aide" pour plus d'exemples ou "stop" pour annuler.`;
    } else {
      message += `⚠️ **Limite d'essais atteinte (${maxAttempts}/${maxAttempts})**\n\n`;
      message += `Pour recommencer, tapez "créer une nouvelle entreprise".\n`;
      message += `Ou tapez "aide" pour obtenir de l'assistance.`;
    }

    return message;
  }

  /**
   * Get conflict error messages
   */
  private getConflictErrorMessage(context: ErrorContext): string {
    const { details } = context;

    if (details?.includes('owner_exists')) {
      return `❌ **Numéro déjà enregistré comme propriétaire**\n\n` +
        `🏢 Ce numéro de téléphone est déjà associé à une entreprise en tant que propriétaire.\n\n` +
        `💡 **Options disponibles :**\n` +
        `• Si c'est votre entreprise, tapez "aide" pour récupérer vos informations\n` +
        `• Si ce n'est pas votre numéro, vérifiez le numéro utilisé\n` +
        `• Pour créer une nouvelle entreprise, utilisez un autre numéro\n\n` +
        `📞 Contactez le support si vous pensez qu'il y a une erreur.`;
    }

    if (details?.includes('employee_exists')) {
      return `⚠️ **Numéro déjà enregistré comme employé**\n\n` +
        `👤 Ce numéro est déjà associé à une entreprise en tant qu'employé.\n\n` +
        `🤔 **Que souhaitez-vous faire ?**\n` +
        `1️⃣ Créer une nouvelle entreprise (vous deviendrez propriétaire)\n` +
        `2️⃣ Rester employé de votre entreprise actuelle\n\n` +
        `Tapez "1" ou "2" pour choisir, ou "aide" pour plus d'informations.`;
    }

    return this.getGenericErrorMessage();
  }

  /**
   * Get technical error messages
   */
  private getTechnicalErrorMessage(context: ErrorContext): string {
    const { details } = context;

    return `❌ **Erreur technique**\n\n` +
      `🔧 Une erreur technique s'est produite lors de la création de votre entreprise.\n\n` +
      `${details ? `📝 **Détail :** ${details}\n\n` : ''}` +
      `🔄 **Solutions suggérées :**\n` +
      `• Réessayez dans quelques minutes\n` +
      `• Vérifiez votre connexion internet\n` +
      `• Contactez le support si le problème persiste\n\n` +
      `💡 Tapez "créer une nouvelle entreprise" pour recommencer.`;
  }

  /**
   * Get unauthorized access error messages
   */
  private getUnauthorizedErrorMessage(context: ErrorContext): string {
    return `🚫 **Accès non autorisé**\n\n` +
      `👋 Pour utiliser ce service, vous devez d'abord créer votre compte.\n\n` +
      `📝 **Pour commencer :**\n` +
      `• Tapez "créer une nouvelle entreprise" si vous êtes propriétaire\n` +
      `• Demandez un code d'employé à votre patron si vous êtes employé\n\n` +
      `💡 Tapez "aide" pour plus d'informations sur l'inscription.`;
  }

  /**
   * Get generic error message
   */
  private getGenericErrorMessage(): string {
    return `❌ **Une erreur s'est produite**\n\n` +
      `😔 Désolé, quelque chose ne s'est pas passé comme prévu.\n\n` +
      `🔄 **Que faire ?**\n` +
      `• Réessayez votre dernière action\n` +
      `• Tapez "aide" pour obtenir de l'assistance\n` +
      `• Contactez le support si le problème persiste\n\n` +
      `💡 Vous pouvez aussi recommencer avec "créer une nouvelle entreprise".`;
  }

  /**
   * Get progress messages during onboarding process
   * Requirement 5.4: Créer les messages de progression du processus d'onboarding
   */
  getProgressMessage(context: ProgressContext): string {
    const { currentStep, totalSteps, stepName, completedSteps } = context;

    const progressPercentage = Math.round((completedSteps.length / totalSteps) * 100);
    const progressBar = this.generateProgressBar(completedSteps.length, totalSteps);

    return `📊 **Progression de l'inscription**\n\n` +
      `${progressBar} ${progressPercentage}%\n\n` +
      `🔄 **Étape actuelle :** ${stepName}\n` +
      `✅ **Étapes complétées :** ${completedSteps.length}/${totalSteps}\n\n` +
      `${this.getStepSpecificGuidance(currentStep)}`;
  }

  /**
   * Generate visual progress bar
   */
  private generateProgressBar(completed: number, total: number): string {
    const barLength = 10;
    const filledLength = Math.round((completed / total) * barLength);
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(barLength - filledLength);
    return `[${filled}${empty}]`;
  }

  /**
   * Get step-specific guidance messages
   */
  private getStepSpecificGuidance(step: string): string {
    const guidance = {
      'merchant_onboarding_start': '💡 Tapez "continuer" pour commencer la création de votre entreprise.',
      'merchant_business_name': '💡 Saisissez le nom de votre entreprise (ex: "Boutique Fatou").',
      'merchant_owner_name': '💡 Saisissez votre nom complet (ex: "Fabrice Ilboudo").',
      'merchant_confirmation': '💡 Vérifiez les informations et tapez "confirmer" pour créer l\'entreprise.',
      'merchant_conflict_resolution': '💡 Choisissez si vous voulez créer une nouvelle entreprise ou rester employé.'
    };

    return guidance[step] || '💡 Suivez les instructions pour continuer.';
  }

  /**
   * Get help message for specific onboarding step
   */
  getStepHelpMessage(step: string): string {
    const helpMessages = {
      'merchant_onboarding_start':
        `ℹ️ **Aide - Création d'entreprise**\n\n` +
        `🏢 Vous allez créer une nouvelle entreprise. Le processus comprend :\n` +
        `1️⃣ Saisie du nom de votre entreprise\n` +
        `2️⃣ Saisie de votre nom en tant que propriétaire\n` +
        `3️⃣ Création automatique de votre compte\n\n` +
        `⏱️ **Durée estimée :** 2-3 minutes\n` +
        `🔒 **Sécurité :** Vos données sont protégées\n\n` +
        `Tapez "continuer" pour commencer ou "stop" pour annuler.`,

      'merchant_business_name':
        `ℹ️ **Aide - Nom de l'entreprise**\n\n` +
        `📝 Saisissez le nom de votre entreprise tel que vous voulez qu'il apparaisse.\n\n` +
        `✅ **Exemples valides :**\n` +
        `• Boutique Fatou\n` +
        `• Restaurant Chez Amadou\n` +
        `• Salon de Coiffure Aïcha\n` +
        `📏 **Contraintes :**\n` +
        `• Entre 2 et 100 caractères\n` +
        `• Lettres, chiffres et espaces autorisés\n\n` +
        `💡 Choisissez un nom facile à retenir pour vos clients !`,

      'merchant_owner_name':
        `ℹ️ **Aide - Nom du propriétaire**\n\n` +
        `👤 Saisissez votre nom complet tel que vous voulez qu'il apparaisse.\n\n` +
        `✅ **Exemples valides :**\n` +
        `• Fabrice Ilboudo\n` +
        `📏 **Contraintes :**\n` +
        `• Entre 2 et 100 caractères\n` +
        `• Lettres et espaces autorisés\n\n` +
        `💡 Ce nom apparaîtra sur vos rapports et documents.`,

      'merchant_confirmation':
        `ℹ️ **Aide - Confirmation**\n\n` +
        `✅ Vérifiez attentivement les informations affichées :\n` +
        `• Nom de l'entreprise\n` +
        `• Votre nom en tant que propriétaire\n\n` +
        `🎯 **Actions disponibles :**\n` +
        `• Tapez "confirmer" ou "oui" pour créer l'entreprise\n` +
        `• Tapez "modifier" pour changer les informations\n` +
        `• Tapez "stop" pour annuler\n\n` +
        `⚠️ Une fois créée, l'entreprise ne pourra plus être supprimée.`,

      'merchant_conflict_resolution':
        `ℹ️ **Aide - Résolution de conflit**\n\n` +
        `⚠️ Votre numéro est déjà enregistré comme employé.\n\n` +
        `🤔 **Options disponibles :**\n\n` +
        `1️⃣ **Créer une nouvelle entreprise**\n` +
        `   • Vous deviendrez propriétaire\n` +
        `   • Vous pourrez inviter des employés\n` +
        `   • Vous garderez votre accès employé actuel\n\n` +
        `2️⃣ **Rester employé uniquement**\n` +
        `   • Vous gardez votre statut actuel\n` +
        `   • Pas de création d'entreprise\n` +
        `   • Vous pouvez utiliser les fonctions employé\n\n` +
        `Tapez "1" ou "2" pour choisir.`
    };

    return helpMessages[step] || this.getGenericHelpMessage();
  }

  /**
   * Get generic help message
   */
  private getGenericHelpMessage(): string {
    return `ℹ️ **Aide générale**\n\n` +
      `🆘 **Commandes utiles :**\n` +
      `• "aide" - Afficher cette aide\n` +
      `• "stop" - Annuler l'opération en cours\n` +
      `• "créer une nouvelle entreprise" - Commencer l'inscription\n\n` +
      `📞 **Support :** Contactez-nous si vous avez besoin d'aide supplémentaire.`;
  }

  /**
   * Get cancellation confirmation message
   */
  getCancellationMessage(step?: string): string {
    const stepContext = step ? ` (étape: ${step})` : '';

    return `❌ **Création d'entreprise annulée**${stepContext}\n\n` +
      `😔 Pas de problème ! Vous pouvez recommencer quand vous voulez.\n\n` +
      `🔄 **Pour recommencer :**\n` +
      `• Tapez "créer une nouvelle entreprise"\n\n` +
      `💡 **Besoin d'aide ?**\n` +
      `• Tapez "aide" pour obtenir de l'assistance\n` +
      `• Contactez le support si vous avez des questions\n\n` +
      `À bientôt ! 👋`;
  }

  /**
   * Get session expiration message
   */
  getSessionExpiredMessage(): string {
    return `⏰ **Session expirée**\n\n` +
      `🔄 Votre session d'inscription a expiré pour des raisons de sécurité.\n\n` +
      `💡 **Pour continuer :**\n` +
      `• Tapez "créer une nouvelle entreprise" pour recommencer\n` +
      `• Vos données précédentes n'ont pas été sauvegardées\n\n` +
      `⚡ **Conseil :** Complétez l'inscription en une fois pour éviter l'expiration.`;
  }

  /**
   * Get retry suggestion message
   */
  getRetryMessage(action: string, attemptCount: number): string {
    return `🔄 **Nouvelle tentative suggérée**\n\n` +
      `⚠️ L'action "${action}" a échoué (tentative ${attemptCount}).\n\n` +
      `💡 **Suggestions :**\n` +
      `• Vérifiez votre saisie\n` +
      `• Réessayez dans quelques secondes\n` +
      `• Tapez "aide" si vous avez besoin d'assistance\n\n` +
      `🛑 Tapez "stop" pour annuler si nécessaire.`;
  }
}