import { Injectable, Logger } from '@nestjs/common';
import { PhoneValidationService, PhoneNumberStatus } from '../../auth/services/phone-validation.service';

export interface ConflictResolutionResult {
  message: string;
  conflictType: 'owner_exists' | 'employee_exists' | 'no_conflict';
  canProceed: boolean;
  suggestedActions?: string[];
  businessName?: string;
  businessCode?: string;
}

/**
 * Service for handling conflicts when phone numbers already exist in the system
 * during merchant onboarding process
 */
@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name);

  constructor(
    private readonly phoneValidationService: PhoneValidationService,
  ) {}

  /**
   * Check for conflicts and provide resolution options
   */
  async checkAndResolveConflict(phoneNumber: string): Promise<ConflictResolutionResult> {
    this.logger.debug(`Checking for conflicts with phone number: ${phoneNumber}`);

    try {
      // Check if phone number already exists in the system
      const phoneStatus = await this.phoneValidationService.checkPhoneNumberStatus(phoneNumber);

      if (!phoneStatus.exists) {
        // No conflict - phone number is available
        return {
          message: '',
          conflictType: 'no_conflict',
          canProceed: true
        };
      }

      // Handle conflicts based on user type
      if (phoneStatus.userType === 'owner') {
        return this.handleExistingOwner(phoneStatus);
      } else if (phoneStatus.userType === 'employee') {
        return this.handleExistingEmployee(phoneStatus);
      }

      // Fallback for unknown user type
      this.logger.warn(`Unknown user type for phone number ${phoneNumber}: ${phoneStatus.userType}`);
      return {
        message: "❌ **Numéro déjà enregistré**\n\n" +
                "Ce numéro de téléphone est déjà enregistré dans le système, mais nous ne pouvons pas déterminer votre statut.\n\n" +
                "Veuillez contacter le support pour résoudre ce problème.",
        conflictType: 'owner_exists', // Default to more restrictive
        canProceed: false
      };

    } catch (error) {
      this.logger.error(`Error checking conflict for phone number ${phoneNumber}:`, error);
      
      return {
        message: "❌ **Erreur de vérification**\n\n" +
                "Une erreur s'est produite lors de la vérification de votre numéro.\n\n" +
                "Veuillez réessayer dans quelques minutes.",
        conflictType: 'no_conflict',
        canProceed: false
      };
    }
  }

  /**
   * Handle case where phone number belongs to an existing business owner
   * Requirements: 4.2, 4.3 - Reject creation for existing owners
   */
  private handleExistingOwner(phoneStatus: PhoneNumberStatus): ConflictResolutionResult {
    this.logger.debug(`Phone number belongs to existing owner of business: ${phoneStatus.businessName}`);

    const message = "❌ **Vous possédez déjà une entreprise**\n\n" +
                   `Votre numéro est déjà enregistré comme propriétaire de l'entreprise "${phoneStatus.businessName}".\n\n` +
                   "🚫 **Vous ne pouvez pas créer une nouvelle entreprise avec ce numéro.**\n\n" +
                   "💡 **Options disponibles :**\n" +
                   "• Utilisez votre compte existant pour gérer votre entreprise\n" +
                   "• Contactez le support si vous pensez qu'il y a une erreur\n" +
                   "• Utilisez un autre numéro de téléphone pour créer une nouvelle entreprise\n\n" +
                   "📞 Pour obtenir de l'aide, tapez 'aide' ou contactez le support.";

    return {
      message,
      conflictType: 'owner_exists',
      canProceed: false,
      businessName: phoneStatus.businessName,
      businessCode: phoneStatus.businessId,
      suggestedActions: [
        'use_existing_account',
        'contact_support',
        'use_different_number'
      ]
    };
  }

  /**
   * Handle case where phone number belongs to an existing employee
   * Requirements: 4.4, 6.1 - Propose options for existing employees
   */
  private handleExistingEmployee(phoneStatus: PhoneNumberStatus): ConflictResolutionResult {
    this.logger.debug(`Phone number belongs to existing employee of business: ${phoneStatus.businessName}`);

    const message = "⚠️ **Vous êtes déjà employé dans une entreprise**\n\n" +
                   `Votre numéro est enregistré comme employé dans l'entreprise "${phoneStatus.businessName}".\n\n` +
                   "🤔 **Que souhaitez-vous faire ?**\n\n" +
                   "1️⃣ **Créer une nouvelle entreprise** (recommandé)\n" +
                   "   • Vous deviendrez propriétaire d'une nouvelle entreprise\n" +
                   "   • Vous garderez aussi votre accès en tant qu'employé\n" +
                   "   • Vous pourrez basculer entre les deux rôles\n\n" +
                   "2️⃣ **Rester uniquement employé**\n" +
                   "   • Continuer à utiliser votre compte employé actuel\n" +
                   "   • Pas de création de nouvelle entreprise\n\n" +
                   "💡 **Pour choisir :**\n" +
                   "• Tapez 'nouvelle entreprise' ou '1' pour créer votre entreprise\n" +
                   "• Tapez 'rester employé' ou '2' pour garder votre statut actuel\n" +
                   "• Tapez 'aide' pour plus d'informations";

    return {
      message,
      conflictType: 'employee_exists',
      canProceed: true, // Employee can choose to create new business
      businessName: phoneStatus.businessName,
      businessCode: phoneStatus.businessId,
      suggestedActions: [
        'create_new_business',
        'stay_employee',
        'get_help'
      ]
    };
  }

  /**
   * Process employee's choice when they have a conflict
   */
  async processEmployeeChoice(phoneNumber: string, choice: string): Promise<{
    shouldProceed: boolean;
    message: string;
    action: 'create_business' | 'stay_employee' | 'invalid_choice';
  }> {
    const normalizedChoice = choice.toLowerCase().trim();

    // Check for "create new business" choice
    const createBusinessKeywords = [
      '1', 'nouvelle entreprise', 'créer entreprise', 'créer business',
      'nouvelle business', 'oui', 'continuer', 'créer'
    ];

    const wantsToCreateBusiness = createBusinessKeywords.some(keyword => 
      normalizedChoice.includes(keyword)
    );

    if (wantsToCreateBusiness) {
      this.logger.debug(`Employee ${phoneNumber} chose to create new business`);
      
      return {
        shouldProceed: true,
        message: "✅ **Parfait !**\n\n" +
                "Vous allez créer votre propre entreprise tout en gardant votre accès employé.\n\n" +
                "📝 Commençons par le nom de votre nouvelle entreprise :",
        action: 'create_business'
      };
    }

    // Check for "stay employee" choice
    const stayEmployeeKeywords = [
      '2', 'rester employé', 'garder employé', 'employé seulement',
      'pas créer', 'non', 'annuler'
    ];

    const wantsToStayEmployee = stayEmployeeKeywords.some(keyword => 
      normalizedChoice.includes(keyword)
    );

    if (wantsToStayEmployee) {
      this.logger.debug(`Employee ${phoneNumber} chose to stay employee only`);
      
      return {
        shouldProceed: false,
        message: "✅ **Choix confirmé**\n\n" +
                "Vous gardez votre statut d'employé actuel.\n\n" +
                "💼 Vous pouvez maintenant utiliser toutes les fonctionnalités disponibles pour les employés.\n\n" +
                "💡 Si vous changez d'avis plus tard, tapez 'créer une nouvelle entreprise' pour démarrer le processus.",
        action: 'stay_employee'
      };
    }

    // Invalid choice - provide guidance
    return {
      shouldProceed: false,
      message: "❌ **Choix non reconnu**\n\n" +
              "Veuillez choisir une option :\n\n" +
              "1️⃣ Tapez 'nouvelle entreprise' ou '1' pour créer votre entreprise\n" +
              "2️⃣ Tapez 'rester employé' ou '2' pour garder votre statut actuel\n\n" +
              "Ou tapez 'aide' pour plus d'informations.",
      action: 'invalid_choice'
    };
  }

  /**
   * Get help message for conflict resolution
   */
  getConflictHelpMessage(conflictType: 'owner_exists' | 'employee_exists'): string {
    if (conflictType === 'owner_exists') {
      return "ℹ️ **Aide - Propriétaire existant**\n\n" +
             "Votre numéro est déjà enregistré comme propriétaire d'une entreprise.\n\n" +
             "🚫 **Pourquoi ne puis-je pas créer une nouvelle entreprise ?**\n" +
             "• Un numéro de téléphone ne peut être propriétaire que d'une seule entreprise\n" +
             "• Cela évite les confusions et les erreurs de gestion\n\n" +
             "💡 **Solutions possibles :**\n" +
             "• Utilisez votre compte existant\n" +
             "• Utilisez un autre numéro pour la nouvelle entreprise\n" +
             "• Contactez le support si vous pensez qu'il y a une erreur\n\n" +
             "📞 **Support :** Tapez 'support' pour obtenir de l'aide.";
    }

    return "ℹ️ **Aide - Employé existant**\n\n" +
           "Votre numéro est déjà enregistré comme employé dans une entreprise.\n\n" +
           "✅ **Bonne nouvelle !** Vous pouvez :\n" +
           "• Créer votre propre entreprise ET garder votre statut d'employé\n" +
           "• Basculer entre les deux rôles selon vos besoins\n\n" +
           "🔄 **Comment ça marche ?**\n" +
           "• Vous aurez deux comptes : propriétaire et employé\n" +
           "• Vous pourrez choisir dans quel rôle agir\n" +
           "• Vos données restent séparées et sécurisées\n\n" +
           "💡 **Recommandation :** Créez votre entreprise pour plus d'opportunités !";
  }

  /**
   * Check if a message is asking for help about conflicts
   */
  isConflictHelpRequest(message: string): boolean {
    const normalizedMessage = message.toLowerCase().trim();
    const helpKeywords = [
      'aide', 'help', 'pourquoi', 'comment', 'expliquer',
      'ne comprends pas', 'pas compris', 'clarification'
    ];

    return helpKeywords.some(keyword => normalizedMessage.includes(keyword));
  }

  /**
   * Get summary of conflict resolution for logging/monitoring
   */
  getConflictSummary(phoneNumber: string, result: ConflictResolutionResult): string {
    return `Conflict check for ${phoneNumber}: ${result.conflictType}, ` +
           `canProceed: ${result.canProceed}, ` +
           `business: ${result.businessName || 'N/A'}`;
  }
}