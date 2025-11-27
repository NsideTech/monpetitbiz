import { Injectable, Logger } from '@nestjs/common';
import { ConversationStateService, RegistrationState, MerchantOnboardingState } from './conversation-state.service';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/entities/user.entity';
import { NLPService } from './nlp.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { OnboardingMessagesService, BusinessDetails, ErrorContext } from './onboarding-messages.service';
import { StockService } from '../../stock/stock.service';

export interface RegistrationResponse {
  message: string;
  completed: boolean;
  nextStep?: string;
  requiresOTP?: boolean;
  data?: any;
}

export interface ProgressInfo {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  completedSteps: string[];
}

@Injectable()
export class RegistrationHandlerService {
  private readonly logger = new Logger(RegistrationHandlerService.name);

  constructor(
    private readonly conversationStateService: ConversationStateService,
    private readonly authService: AuthService,
    private readonly nlpService: NLPService,
    private readonly conflictResolutionService: ConflictResolutionService,
    private readonly onboardingMessagesService: OnboardingMessagesService,
    private readonly stockService: StockService,
  ) { }

  /**
   * Main entry point for handling registration messages
   */
  async handleRegistrationMessage(phoneNumber: string, message: string): Promise<RegistrationResponse> {
    this.logger.debug(`Handling registration message from ${phoneNumber}: "${message}"`);

    try {
      // Handle session extension requests
      if (this.isSessionExtensionRequest(message)) {
        return this.handleSessionExtension(phoneNumber);
      }

      // Check if user is already in registration flow
      const registrationState = this.conversationStateService.getRegistrationState(phoneNumber);

      if (registrationState) {
        // Check if session has expired
        if (this.conversationStateService.isStateExpired(phoneNumber)) {
          return this.handleExpiredSession(phoneNumber);
        }

        // Continue existing registration flow
        return await this.continueRegistrationFlow(phoneNumber, message, registrationState);
      } else {
        // Start new registration flow
        return await this.startRegistrationFlow(phoneNumber, message);
      }
    } catch (error) {
      this.logger.error(`Error handling registration message for ${phoneNumber}:`, error);

      const errorMessage = this.onboardingMessagesService.getErrorMessage({
        errorType: 'technical',
        details: 'Erreur lors du traitement du message d\'inscription'
      });

      return {
        message: errorMessage,
        completed: false,
        nextStep: 'error_recovery'
      };
    }
  }

  /**
   * Start a new registration flow
   */
  async startRegistrationFlow(phoneNumber: string, message: string): Promise<RegistrationResponse> {
    this.logger.debug(`Starting registration flow for ${phoneNumber}`);

    // Check for merchant onboarding intent first
    const isMerchantOnboarding = this.detectMerchantOnboardingIntent(message.toLowerCase().trim());

    if (isMerchantOnboarding) {
      return await this.startMerchantOnboardingFlow(phoneNumber, message);
    }

    // Detect general registration intent using NLP patterns
    const isRegistrationIntent = this.detectRegistrationIntent(message);

    if (!isRegistrationIntent) {
      // Not a registration message, return null to let other handlers process it
      return {
        message: '',
        completed: false,
        nextStep: 'not_registration'
      };
    }

    // Initialize registration state
    this.conversationStateService.setRegistrationState(phoneNumber, {
      step: 'type_selection',
      phoneNumber: phoneNumber
    });

    return {
      message: this.getTypeSelectionMessage(),
      completed: false,
      nextStep: 'type_selection'
    };
  }

  /**
   * Continue existing registration flow
   */
  async continueRegistrationFlow(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    this.logger.debug(`Continuing registration flow for ${phoneNumber}, step: ${state.step}`);

    switch (state.step) {
      case 'type_selection':
        return await this.handleTypeSelection(phoneNumber, message, state);

      case 'business_info':
        return await this.handleBusinessInfo(phoneNumber, message, state);

      case 'owner_name':
        return await this.handleOwnerName(phoneNumber, message, state);

      case 'employee_info':
        return await this.handleEmployeeInfo(phoneNumber, message, state);

      case 'role_selection':
        return await this.handleRoleSelection(phoneNumber, message, state);

      // Merchant onboarding steps
      case 'merchant_onboarding_start':
        return await this.handleMerchantOnboardingStart(phoneNumber, message, state);

      case 'merchant_conflict_resolution':
        return await this.handleMerchantConflictResolution(phoneNumber, message, state);

      case 'merchant_business_name':
        return await this.handleMerchantBusinessName(phoneNumber, message, state);

      case 'merchant_owner_name':
        return await this.handleMerchantOwnerName(phoneNumber, message, state);

      case 'merchant_confirmation':
        return await this.handleMerchantConfirmation(phoneNumber, message, state);

      case 'product_setup':
        // Product setup step is no longer part of the onboarding flow
        // If a user is stuck in this state, clear it and show completion message
        this.logger.warn(`User ${phoneNumber} is in deprecated product_setup step, clearing state`);
        this.conversationStateService.clearState(phoneNumber);
        const businessName = state.businessName || '';
        const ownerName = state.ownerName || '';
        const businessCode = state.businessCode || '';
        return {
          message: this.getMerchantCompletionMessage(businessName, ownerName, businessCode),
          completed: true,
          nextStep: 'completed'
        };

      default:
        this.logger.warn(`Unknown registration step: ${state.step}`);
        return {
          message: "Étape inconnue. Recommençons depuis le début. Êtes-vous:\n1️⃣ Propriétaire d'entreprise\n2️⃣ Employé",
          completed: false,
          nextStep: 'type_selection'
        };
    }
  }

  /**
   * Check if user is currently in registration flow
   */
  isInRegistrationFlow(phoneNumber: string): boolean {
    return this.conversationStateService.isInRegistration(phoneNumber);
  }

  /**
   * Start merchant onboarding flow
   */
  async startMerchantOnboardingFlow(phoneNumber: string, message: string): Promise<RegistrationResponse> {
    this.logger.debug(`Starting merchant onboarding flow for ${phoneNumber}`);

    // Initialize merchant onboarding state
    this.conversationStateService.setRegistrationState(phoneNumber, {
      step: 'merchant_onboarding_start',
      type: 'merchant',
      phoneNumber: phoneNumber
    });

    return {
      message: this.getMerchantOnboardingStartMessage(),
      completed: false,
      nextStep: 'merchant_onboarding_start'
    };
  }

  /**
   * Handle merchant onboarding start - check for existing phone number
   */
  async handleMerchantOnboardingStart(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    this.logger.debug(`Handling merchant onboarding start for ${phoneNumber}`);

    // Check if user wants to proceed or cancel
    const normalizedMessage = message.toLowerCase().trim();

    if (normalizedMessage === 'stop' || normalizedMessage === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: this.onboardingMessagesService.getCancellationMessage('merchant_onboarding_start'),
        completed: true,
        nextStep: 'cancelled'
      };
    }

    if (normalizedMessage.includes('aide') || normalizedMessage.includes('help')) {
      return {
        message: this.onboardingMessagesService.getStepHelpMessage('merchant_onboarding_start'),
        completed: false,
        nextStep: 'merchant_onboarding_start'
      };
    }

    // Check for confirmation to proceed
    const proceedKeywords = ['oui', 'yes', 'continuer', 'continue', 'ok', 'commencer', 'démarrer', '1'];
    const shouldProceed = proceedKeywords.some(keyword => normalizedMessage.includes(keyword));

    if (!shouldProceed) {
      return {
        message: "🤔 Pour créer votre entreprise, tapez 'continuer'.\n\n" +
          "Ou tapez 'aide' pour plus d'informations, 'stop' pour annuler.",
        completed: false,
        nextStep: 'merchant_onboarding_start'
      };
    }

    // Check for conflicts with existing phone number
    const conflictResult = await this.conflictResolutionService.checkAndResolveConflict(phoneNumber);

    if (conflictResult.conflictType === 'owner_exists') {
      // Phone number belongs to existing owner - cannot proceed
      this.cancelRegistration(phoneNumber);
      return {
        message: conflictResult.message,
        completed: true,
        nextStep: 'conflict_rejected'
      };
    }

    if (conflictResult.conflictType === 'employee_exists') {
      // Phone number belongs to existing employee - offer options
      this.conversationStateService.setRegistrationState(phoneNumber, {
        step: 'merchant_conflict_resolution',
        conflictType: 'employee_exists',
        businessName: conflictResult.businessName
      });

      return {
        message: conflictResult.message,
        completed: false,
        nextStep: 'merchant_conflict_resolution'
      };
    }

    // No conflict - proceed to business name collection
    this.conversationStateService.setRegistrationState(phoneNumber, {
      step: 'merchant_business_name'
    });

    return {
      message: this.getMerchantBusinessNameMessage(),
      completed: false,
      nextStep: 'merchant_business_name'
    };
  }

  /**
   * Handle merchant conflict resolution when phone number already exists as employee
   */
  async handleMerchantConflictResolution(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    this.logger.debug(`Handling merchant conflict resolution for ${phoneNumber}`);

    const normalizedMessage = message.toLowerCase().trim();

    // Check for cancel
    if (normalizedMessage === 'stop' || normalizedMessage === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: this.onboardingMessagesService.getCancellationMessage('merchant_conflict_resolution'),
        completed: true,
        nextStep: 'cancelled'
      };
    }

    // Check for help request
    if (this.conflictResolutionService.isConflictHelpRequest(message)) {
      const helpMessage = this.conflictResolutionService.getConflictHelpMessage('employee_exists');
      return {
        message: helpMessage,
        completed: false,
        nextStep: 'merchant_conflict_resolution'
      };
    }

    // Process the employee's choice
    const choiceResult = await this.conflictResolutionService.processEmployeeChoice(phoneNumber, message);

    if (choiceResult.action === 'create_business') {
      // Employee chose to create new business - proceed to business name collection
      this.conversationStateService.setRegistrationState(phoneNumber, {
        step: 'merchant_business_name'
      });

      return {
        message: choiceResult.message,
        completed: false,
        nextStep: 'merchant_business_name'
      };
    }

    if (choiceResult.action === 'stay_employee') {
      // Employee chose to stay employee only - end the onboarding process
      this.cancelRegistration(phoneNumber);
      return {
        message: choiceResult.message,
        completed: true,
        nextStep: 'stay_employee'
      };
    }

    // Invalid choice - ask again
    return {
      message: choiceResult.message,
      completed: false,
      nextStep: 'merchant_conflict_resolution'
    };
  }

  /**
   * Handle merchant business name collection
   */
  async handleMerchantBusinessName(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    const trimmedMessage = message.trim();

    // Check for cancel/help requests
    if (trimmedMessage.toLowerCase() === 'stop' || trimmedMessage.toLowerCase() === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: this.onboardingMessagesService.getCancellationMessage('merchant_business_name'),
        completed: true,
        nextStep: 'cancelled'
      };
    }

    if (trimmedMessage.toLowerCase().includes('aide') || trimmedMessage.toLowerCase().includes('help')) {
      return {
        message: this.onboardingMessagesService.getStepHelpMessage('merchant_business_name'),
        completed: false,
        nextStep: 'merchant_business_name'
      };
    }

    // Validate business name
    const validation = this.validateInputLength(trimmedMessage, "Le nom de l'entreprise", 2, 100);
    if (!validation.isValid) {
      const errorMessage = this.onboardingMessagesService.getErrorMessage({
        errorType: 'validation',
        field: 'businessName',
        details: validation.message
      });

      return {
        message: errorMessage,
        completed: false,
        nextStep: 'merchant_business_name'
      };
    }

    const businessName = trimmedMessage;

    // Store business name and move to owner name collection
    // Preserve all existing state data
    this.conversationStateService.setRegistrationState(phoneNumber, {
      ...state,
      businessName: businessName,
      step: 'merchant_owner_name'
    });

    this.logger.debug(`Merchant business name collected for ${phoneNumber}: ${businessName}`);

    return {
      message: this.getMerchantOwnerNameMessage(businessName),
      completed: false,
      nextStep: 'merchant_owner_name'
    };
  }

  /**
   * Handle merchant owner name collection
   */
  async handleMerchantOwnerName(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    const trimmedMessage = message.trim();

    // Check for cancel/help requests
    if (trimmedMessage.toLowerCase() === 'stop' || trimmedMessage.toLowerCase() === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: this.onboardingMessagesService.getCancellationMessage('merchant_owner_name'),
        completed: true,
        nextStep: 'cancelled'
      };
    }

    if (trimmedMessage.toLowerCase().includes('aide') || trimmedMessage.toLowerCase().includes('help')) {
      return {
        message: this.onboardingMessagesService.getStepHelpMessage('merchant_owner_name'),
        completed: false,
        nextStep: 'merchant_owner_name'
      };
    }

    // Validate owner name
    const validation = this.validateInputLength(trimmedMessage, "Le nom du propriétaire", 2, 100);
    if (!validation.isValid) {
      const errorMessage = this.onboardingMessagesService.getErrorMessage({
        errorType: 'validation',
        field: 'ownerName',
        details: validation.message
      });

      return {
        message: errorMessage,
        completed: false,
        nextStep: 'merchant_owner_name'
      };
    }

    const ownerName = trimmedMessage;
    const businessName = state.businessName;

    if (!businessName) {
      this.logger.error(`Missing business name for ${phoneNumber} during merchant onboarding`);
      return {
        message: "❌ Erreur : nom d'entreprise manquant. Recommençons.\n\n" +
          "Quel est le nom de votre entreprise ?",
        completed: false,
        nextStep: 'merchant_business_name'
      };
    }

    // Store owner name and move to confirmation
    // Preserve all existing state data
    this.conversationStateService.setRegistrationState(phoneNumber, {
      ...state,
      ownerName: ownerName,
      step: 'merchant_confirmation'
    });

    this.logger.debug(`Merchant owner name collected for ${phoneNumber}: ${ownerName}`);

    return {
      message: this.getMerchantConfirmationMessage(businessName, ownerName),
      completed: false,
      nextStep: 'merchant_confirmation'
    };
  }

  /**
   * Handle merchant confirmation and create the business
   */
  async handleMerchantConfirmation(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    const normalizedMessage = message.toLowerCase().trim();

    // Check for cancel
    if (normalizedMessage === 'stop' || normalizedMessage === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: this.onboardingMessagesService.getCancellationMessage('merchant_confirmation'),
        completed: true,
        nextStep: 'cancelled'
      };
    }

    // Check for help
    if (normalizedMessage.includes('aide') || normalizedMessage.includes('help')) {
      return {
        message: this.onboardingMessagesService.getStepHelpMessage('merchant_confirmation'),
        completed: false,
        nextStep: 'merchant_confirmation'
      };
    }

    // Check for modification request
    if (normalizedMessage.includes('modifier') || normalizedMessage.includes('changer') || normalizedMessage.includes('corriger')) {
      // Go back to business name collection
      this.conversationStateService.setRegistrationState(phoneNumber, {
        step: 'merchant_business_name'
      });

      return {
        message: "🔄 **Modification des informations**\n\n" +
          "Recommençons la saisie.\n\n" +
          this.getMerchantBusinessNameMessage(),
        completed: false,
        nextStep: 'merchant_business_name'
      };
    }

    // Check for confirmation
    const confirmKeywords = ['oui', 'yes', 'confirmer', 'confirm', 'ok', 'valider', 'créer'];
    const isConfirmed = confirmKeywords.some(keyword => normalizedMessage.includes(keyword));

    if (!isConfirmed) {
      return {
        message: "🤔 Pour créer votre entreprise, tapez 'confirmer' ou 'oui'.\n\n" +
          "Tapez 'modifier' pour changer les informations.\n" +
          "Tapez 'aide' pour plus d'informations.",
        completed: false,
        nextStep: 'merchant_confirmation'
      };
    }

    // Proceed with business creation
    const businessName = state.businessName;
    const ownerName = state.ownerName;

    if (!businessName || !ownerName) {
      this.logger.error(`Missing required data for merchant onboarding: ${phoneNumber}`);
      return {
        message: "❌ Erreur : données manquantes. Recommençons la création.\n\n" +
          "Tapez 'créer une nouvelle entreprise' pour recommencer.",
        completed: true,
        nextStep: 'error'
      };
    }

    try {
      // Create business owner using AuthService
      const registrationResult = await this.authService.registerBusinessOwner({
        phoneNumber: phoneNumber,
        businessName: businessName,
        role: UserRole.OWNER,
        language: 'fr'
      });

      // Get business code and business ID from the created business
      const businessCode = registrationResult.user.business?.businessCode;
      const businessId = registrationResult.user.businessId;

      // Clear registration state - onboarding is complete
      this.conversationStateService.clearState(phoneNumber);

      this.logger.debug(`Merchant registration completed for ${phoneNumber}`);

      // Return completion message with product addition instruction
      return {
        message: this.getMerchantCompletionMessage(businessName, ownerName, businessCode),
        completed: true,
        nextStep: 'completed',
        data: {
          user: registrationResult.user,
          accessToken: registrationResult.accessToken,
          businessCode: businessCode,
          businessId: businessId
        }
      };

    } catch (error) {
      this.logger.error(`Error during merchant onboarding for ${phoneNumber}:`, error);

      let errorContext: ErrorContext;

      // Handle specific error types
      if (error.message?.includes('already exists')) {
        errorContext = {
          errorType: 'conflict',
          details: 'owner_exists'
        };
      } else {
        errorContext = {
          errorType: 'technical',
          details: 'Erreur lors de la création de l\'entreprise'
        };
      }

      return {
        message: this.onboardingMessagesService.getErrorMessage(errorContext),
        completed: true,
        nextStep: 'error'
      };
    }
  }

  /**
   * Handle product setup step after merchant registration
   */
  async handleProductSetup(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    this.logger.debug(`Handling product setup for ${phoneNumber}: "${message}"`);

    const normalizedMessage = message.toLowerCase().trim();
    const businessId = state.data?.businessId || state.data?.user?.businessId;

    // Check for completion command
    if (normalizedMessage === 'terminer' || normalizedMessage === 'fin' || normalizedMessage === 'fini' || normalizedMessage === 'terminé') {
      return await this.completeProductSetup(phoneNumber, state);
    }

    // Check for skip command
    if (normalizedMessage === 'passer' || normalizedMessage === 'skip' || normalizedMessage === 'ignorer') {
      return await this.completeProductSetup(phoneNumber, state, true);
    }

    // Check for help
    if (normalizedMessage === 'aide' || normalizedMessage === 'help') {
      return {
        message: this.onboardingMessagesService.getProductSetupHelpMessage(),
        completed: false,
        nextStep: 'product_setup'
      };
    }

    // Parse product and price from message
    // Format: "nom_produit prix" or "nom_produit: prix" or "nom_produit - prix"
    const productPriceMatch = message.match(/^(.+?)\s*(?:[:|-]|à)\s*(\d+(?:[.,]\d+)?)\s*(?:f|fcfa|xof)?$/i);
    
    if (!productPriceMatch) {
      return {
        message: this.onboardingMessagesService.getProductSetupErrorMessage(),
        completed: false,
        nextStep: 'product_setup'
      };
    }

    const productName = productPriceMatch[1].trim();
    const priceStr = productPriceMatch[2].replace(',', '.');
    const price = parseFloat(priceStr);

    if (isNaN(price) || price <= 0) {
      return {
        message: this.onboardingMessagesService.getProductSetupErrorMessage(),
        completed: false,
        nextStep: 'product_setup'
      };
    }

    if (!businessId) {
      this.logger.error(`Business ID not found for ${phoneNumber} during product setup`);
      return {
        message: this.onboardingMessagesService.getErrorMessage({
          errorType: 'technical',
          details: 'Erreur lors de la configuration des produits'
        }),
        completed: false,
        nextStep: 'product_setup'
      };
    }

    try {
      // Create product with price using StockService
      await this.stockService.setUnitPrice(businessId, productName, price);

      // Update state with new product
      const currentProducts = state.products || [];
      currentProducts.push({ name: productName, price: price });

      this.conversationStateService.setRegistrationState(phoneNumber, {
        ...state,
        products: currentProducts
      });

      this.logger.debug(`Product "${productName}" with price ${price} added for business ${businessId}`);

      return {
        message: this.onboardingMessagesService.getProductAddedMessage(productName, price, currentProducts.length),
        completed: false,
        nextStep: 'product_setup'
      };
    } catch (error) {
      this.logger.error(`Error adding product for ${phoneNumber}:`, error);
      return {
        message: this.onboardingMessagesService.getErrorMessage({
          errorType: 'technical',
          details: `Erreur lors de l'ajout du produit "${productName}"`
        }),
        completed: false,
        nextStep: 'product_setup'
      };
    }
  }

  /**
   * Complete product setup and finish onboarding
   */
  async completeProductSetup(
    phoneNumber: string,
    state: RegistrationState,
    skipped: boolean = false
  ): Promise<RegistrationResponse> {
    const businessName = state.businessName || '';
    const ownerName = state.ownerName || '';
    const businessCode = state.businessCode || '';
    const products = state.products || [];

    // Clear registration state
    this.conversationStateService.clearState(phoneNumber);

    this.logger.debug(`Product setup ${skipped ? 'skipped' : 'completed'} for ${phoneNumber}, onboarding finished`);

    const businessDetails: BusinessDetails = {
      businessName,
      ownerName,
      businessCode,
      phoneNumber,
      country: state.country
    };

    return {
      message: this.onboardingMessagesService.getSuccessConfirmationMessage(businessDetails, products, skipped),
      completed: true,
      nextStep: 'completed',
      data: {
        businessCode: businessCode,
        productsAdded: products.length,
        skipped: skipped
      }
    };
  }

  /**
   * Cancel registration and clear state
   */
  cancelRegistration(phoneNumber: string): void {
    this.conversationStateService.clearState(phoneNumber);
    this.logger.debug(`Registration cancelled for ${phoneNumber}`);
  }

  /**
   * Detect registration intent from user message using NLP patterns
   */
  private detectRegistrationIntent(message: string): boolean {
    const normalizedMessage = message.toLowerCase().trim();

    // Check for merchant onboarding intent first
    if (this.detectMerchantOnboardingIntent(normalizedMessage)) {
      return true;
    }

    // Registration keywords in French and Wolof
    const registrationKeywords = [
      // French
      'bonjour', 'salut', 'bonsoir', 'hello', 'hi',
      'inscription', 'enregistrement', 'créer compte', 'nouveau compte',
      'commencer', 'démarrer', 'aide', 'help',
      'propriétaire', 'employé', 'patron', 'boss',
      'code entreprise', 'code business', 'code invitation',

      // Wolof
      // 'nanga def', 'asalamu aleykum', 'salaam aleykum',
      // 'damay bëgg', 'bëgg naa'
    ];

    // Check for exact matches or partial matches
    const hasKeyword = registrationKeywords.some(keyword =>
      normalizedMessage.includes(keyword)
    );

    // Check for business code pattern (6 alphanumeric characters)
    const businessCodePattern = /\b[A-Z0-9]{6}\b/i;
    const hasBusinessCode = businessCodePattern.test(normalizedMessage);

    // Check for greeting patterns
    const greetingPatterns = [
      /^(bonjour|salut|bonsoir|hello|hi)$/i,
      /^(nanga def|asalamu aleykum|salaam aleykum)$/i
    ];
    const isGreeting = greetingPatterns.some(pattern => pattern.test(normalizedMessage));

    return hasKeyword || hasBusinessCode || isGreeting;
  }

  /**
   * Detect merchant onboarding intent specifically
   */
  private detectMerchantOnboardingIntent(message: string): boolean {
    const normalizedMessage = message.toLowerCase().trim();

    // Merchant onboarding keywords and phrases
    const merchantKeywords = [
      'créer une nouvelle entreprise',
      'créer nouvelle entreprise',
      'nouvelle entreprise',
      'créer entreprise',
      'créer business',
      'nouveau business',
      'nouvelle business',
      'ouvrir entreprise',
      'démarrer entreprise',
      'commencer entreprise'
    ];

    return merchantKeywords.some(keyword =>
      normalizedMessage.includes(keyword)
    );
  }

  /**
   * Handle user type selection (owner vs employee)
   */
  private async handleTypeSelection(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    const normalizedMessage = message.toLowerCase().trim();

    // Check for owner selection - multiple ways to express it
    const ownerKeywords = ['1', 'propriétaire', 'patron', 'boss', 'owner', 'chef', 'directeur'];
    const isOwnerSelection = ownerKeywords.some(keyword =>
      normalizedMessage === keyword || normalizedMessage.includes(keyword)
    );

    if (isOwnerSelection) {
      // Update state to business owner flow
      this.conversationStateService.setRegistrationState(phoneNumber, {
        step: 'business_info',
        type: 'owner',
        phoneNumber: phoneNumber
      });

      this.logger.debug(`User ${phoneNumber} selected owner type`);

      const completionMessage = this.getStepCompletionMessage('type_selection', 'owner');
      const progressBar = this.getProgressIndicator('business_info', 'owner');

      return {
        message: `${completionMessage}\n\n🏢 Parfait ! Créons votre entreprise.\n\n${progressBar}\n\n📝 Quel est le nom de votre entreprise ?\n\n💡 Exemple : \"Boutique Fatou\" ou \"Restaurant Chez Amadou\"`,
        completed: false,
        nextStep: 'business_info'
      };
    }

    // Check for employee selection - multiple ways to express it
    const employeeKeywords = ['2', 'employé', 'employee', 'travailleur', 'salarié', 'ouvrier'];
    const isEmployeeSelection = employeeKeywords.some(keyword =>
      normalizedMessage === keyword || normalizedMessage.includes(keyword)
    );

    if (isEmployeeSelection) {
      // Update state to employee flow
      this.conversationStateService.setRegistrationState(phoneNumber, {
        step: 'employee_info',
        type: 'employee',
        phoneNumber: phoneNumber
      });

      this.logger.debug(`User ${phoneNumber} selected employee type`);

      const completionMessage = this.getStepCompletionMessage('type_selection', 'employee');
      const progressBar = this.getProgressIndicator('employee_info', 'employee');

      return {
        message: `${completionMessage}\n\n👤 Parfait ! Rejoignons votre entreprise.\n\n${progressBar}\n\n🔑 Veuillez saisir le code d'entreprise que votre patron vous a donné :\n\n💡 Format attendu : 6 caractères (ex: ABC123)`,
        completed: false,
        nextStep: 'employee_info'
      };
    }

    // Check for help or cancel requests
    if (normalizedMessage.includes('aide') || normalizedMessage.includes('help') ||
      normalizedMessage.includes('annuler') || normalizedMessage.includes('cancel')) {

      return {
        message: "ℹ️ **Aide - Sélection du type de compte**\n\n" +
          "🏢 **Propriétaire d'entreprise** : Vous voulez créer un nouveau compte pour votre business\n" +
          "👤 **Employé** : Vous voulez rejoindre l'entreprise de votre patron avec un code d'invitation\n\n" +
          "Tapez '1' pour propriétaire ou '2' pour employé.\n\n" +
          "Pour annuler, tapez 'stop'.",
        completed: false,
        nextStep: 'type_selection'
      };
    }

    // Check for stop/cancel
    if (normalizedMessage === 'stop' || normalizedMessage === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: "❌ Inscription annulée. Tapez 'bonjour' pour recommencer quand vous voulez.",
        completed: true,
        nextStep: 'cancelled'
      };
    }

    // Invalid response, provide clear guidance with examples
    const attempts = (state.data?.typeSelectionAttempts || 0) + 1;

    // Update attempt count
    this.conversationStateService.updateState(phoneNumber, {
      typeSelectionAttempts: attempts
    });

    if (attempts >= 3) {
      // After 3 attempts, provide more detailed help
      return {
        message: "🤔 Je vois que vous avez des difficultés. Laissez-moi vous expliquer :\n\n" +
          "✅ **Pour créer une nouvelle entreprise** → Tapez **1**\n" +
          "✅ **Pour rejoindre une entreprise existante** → Tapez **2**\n\n" +
          "Ou tapez 'aide' pour plus d'informations.",
        completed: false,
        nextStep: 'type_selection'
      };
    }

    return {
      message: `Bienvenue ! Pour commencer, dites-moi qui vous êtes :\n\n` +
        "Veuillez choisir :\n" +
        "1️⃣ Propriétaire d'entreprise\n" +
        "2️⃣ Employé\n\n" +
        "Tapez '1' ou '2' pour continuer, ou 'aide' pour plus d'informations.",
      completed: false,
      nextStep: 'type_selection'
    };
  }

  /**
   * Get the type selection message with progress indicator
   */
  private getTypeSelectionMessage(): string {
    const progressBar = this.getProgressIndicator('type_selection', 'owner');
    return `👋 Bienvenue ! Pour commencer, dites-moi qui vous êtes :\n\n${progressBar}\n\n1️⃣ Propriétaire d'entreprise\n2️⃣ Employé\n\nTapez '1' ou '2' pour continuer.`;
  }

  /**
   * Get progress indicator for current step
   */
  private getProgressIndicator(currentStep: string, userType?: 'owner' | 'employee'): string {
    const ownerSteps = [
      { key: 'type_selection', name: 'Type de compte', emoji: '👤' },
      { key: 'business_info', name: 'Info entreprise', emoji: '🏢' },
      { key: 'owner_name', name: 'Nom propriétaire', emoji: '📝' }
    ];

    const employeeSteps = [
      { key: 'type_selection', name: 'Type de compte', emoji: '👤' },
      { key: 'employee_info', name: 'Code entreprise', emoji: '🔑' },
      { key: 'role_selection', name: 'Choix du rôle', emoji: '👔' }
    ];

    // Determine which steps to use based on user type
    let steps = ownerSteps;
    if (userType === 'employee') {
      steps = employeeSteps;
    } else if (currentStep === 'employee_info' || currentStep === 'role_selection') {
      steps = employeeSteps;
    }

    const currentIndex = steps.findIndex(step => step.key === currentStep);
    if (currentIndex === -1) return '';

    const progressItems = steps.map((step, index) => {
      if (index < currentIndex) {
        return `✅ ${step.emoji} ${step.name}`;
      } else if (index === currentIndex) {
        return `🔄 ${step.emoji} ${step.name}`;
      } else {
        return `⏳ ${step.emoji} ${step.name}`;
      }
    });

    const progressPercentage = Math.round(((currentIndex + 1) / steps.length) * 100);

    return `📊 **Progression: ${currentIndex + 1}/${steps.length} (${progressPercentage}%)**\n${progressItems.join('\n')}`;
  }

  /**
   * Get step completion confirmation message
   */
  private getStepCompletionMessage(completedStep: string, userType: 'owner' | 'employee'): string {
    const stepMessages = {
      'type_selection': {
        owner: '✅ Type de compte confirmé: Propriétaire d\'entreprise',
        employee: '✅ Type de compte confirmé: Employé'
      },
      'business_info': {
        owner: '✅ Nom d\'entreprise enregistré',
        employee: ''
      },
      'owner_name': {
        owner: '✅ Nom du propriétaire confirmé',
        employee: ''
      },
      'employee_info': {
        owner: '',
        employee: '✅ Code d\'entreprise validé'
      },
      'role_selection': {
        owner: '',
        employee: '✅ Rôle sélectionné'
      }
    };

    return stepMessages[completedStep]?.[userType] || '';
  }

  /**
   * Handle business info collection for business owner registration
   */
  private async handleBusinessInfo(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    const trimmedMessage = message.trim();

    // Check for cancel/help requests
    if (trimmedMessage.toLowerCase() === 'stop' || trimmedMessage.toLowerCase() === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: "❌ Inscription annulée. Tapez 'bonjour' pour recommencer quand vous voulez.",
        completed: true,
        nextStep: 'cancelled'
      };
    }

    if (trimmedMessage.toLowerCase().includes('aide') || trimmedMessage.toLowerCase().includes('help')) {
      return {
        message: "ℹ️ **Aide - Nom de l'entreprise**\n\n" +
          "Saisissez le nom de votre entreprise tel que vous voulez qu'il apparaisse.\n\n" +
          "💡 Exemples :\n" +
          "• Boutique Fatou\n" +
          "• Restaurant Chez Amadou\n" +
          "• Salon de Coiffure Aïcha\n\n" +
          "Le nom doit faire entre 2 et 100 caractères.",
        completed: false,
        nextStep: 'business_info'
      };
    }

    // Validate business name
    if (!trimmedMessage || trimmedMessage.length < 2) {
      return {
        message: "❌ Le nom de l'entreprise est trop court.\n\n" +
          "Veuillez saisir un nom d'au moins 2 caractères.\n\n" +
          "💡 Exemple : \"Boutique Fatou\"",
        completed: false,
        nextStep: 'business_info'
      };
    }

    if (trimmedMessage.length > 100) {
      return {
        message: "❌ Le nom de l'entreprise est trop long (maximum 100 caractères).\n\n" +
          "Veuillez raccourcir le nom de votre entreprise.",
        completed: false,
        nextStep: 'business_info'
      };
    }

    // Check if business name already exists (basic validation)
    const businessName = trimmedMessage;

    // Store business name and ask for owner name
    this.conversationStateService.updateState(phoneNumber, {
      businessName: businessName
    });

    this.logger.debug(`Business name collected for ${phoneNumber}: ${businessName}`);

    const completionMessage = this.getStepCompletionMessage('business_info', 'owner');
    const progressBar = this.getProgressIndicator('owner_name', 'owner');

    return {
      message: `${completionMessage}\n✅ Entreprise : "${businessName}"\n\n${progressBar}\n\n📝 Quel est votre nom complet ?\n\n💡 Ce nom apparaîtra comme propriétaire de l'entreprise.`,
      completed: false,
      nextStep: 'owner_name'
    };
  }

  /**
   * Handle employee info collection - business code validation and employee name
   */
  private async handleEmployeeInfo(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    const trimmedMessage = message.trim();

    // Check for cancel/help requests
    if (trimmedMessage.toLowerCase() === 'stop' || trimmedMessage.toLowerCase() === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: "❌ Inscription annulée. Tapez 'bonjour' pour recommencer quand vous voulez.",
        completed: true,
        nextStep: 'cancelled'
      };
    }

    if (trimmedMessage.toLowerCase().includes('aide') || trimmedMessage.toLowerCase().includes('help')) {
      return {
        message: "ℹ️ **Aide - Code d'entreprise**\n\n" +
          "Le code d'entreprise est fourni par votre patron. Il fait exactement 6 caractères.\n\n" +
          "💡 Format : 6 caractères alphanumériques\n" +
          "✅ Exemples valides : ABC123, XYZ789, DEF456\n" +
          "❌ Exemples invalides : abc123 (trop court), ABCD1234 (trop long)\n\n" +
          "Si vous n'avez pas le code, demandez-le à votre patron.",
        completed: false,
        nextStep: 'employee_info'
      };
    }

    // If we don't have a business code yet, collect it
    if (!state.businessCode) {
      return await this.handleBusinessCodeCollection(phoneNumber, trimmedMessage, state);
    }

    // If we have business code but no employee name, collect employee name
    if (!state.employeeName) {
      return await this.handleEmployeeNameCollection(phoneNumber, trimmedMessage, state);
    }

    // This shouldn't happen, but handle gracefully
    this.logger.warn(`Unexpected state in handleEmployeeInfo for ${phoneNumber}`);
    return {
      message: "❌ État inattendu. Recommençons la saisie du code d'entreprise.",
      completed: false,
      nextStep: 'employee_info'
    };
  }

  /**
   * Handle business code collection and validation
   */
  private async handleBusinessCodeCollection(
    phoneNumber: string,
    businessCode: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    // Validate business code format
    const codePattern = /^[A-Z0-9]{6}$/i;
    const normalizedCode = businessCode.toUpperCase();

    if (!codePattern.test(normalizedCode)) {
      const attempts = (state.data?.businessCodeAttempts || 0) + 1;

      // Update attempt count
      this.conversationStateService.updateState(phoneNumber, {
        businessCodeAttempts: attempts
      });

      if (attempts >= 3) {
        return {
          message: "❌ **Format de code incorrect (tentative 3/3)**\n\n" +
            "Le code d'entreprise doit faire exactement 6 caractères alphanumériques.\n\n" +
            "💡 **Exemples corrects :** ABC123, XYZ789, DEF456\n\n" +
            "Vérifiez le code avec votre patron et réessayez.",
          completed: false,
          nextStep: 'employee_info'
        };
      }

      return {
        message: `❌ **Format de code incorrect (tentative ${attempts}/3)**\n\n` +
          "Le code doit faire exactement 6 caractères (lettres et chiffres).\n\n" +
          "💡 Exemple : ABC123\n\n" +
          "Réessayez :",
        completed: false,
        nextStep: 'employee_info'
      };
    }

    try {
      // Validate business code exists using AuthService
      const businessInfo = await this.authService.getBusinessByCode(normalizedCode);

      if (!businessInfo) {
        const attempts = (state.data?.businessCodeAttempts || 0) + 1;

        // Update attempt count
        this.conversationStateService.updateState(phoneNumber, {
          businessCodeAttempts: attempts
        });

        if (attempts >= 3) {
          return {
            message: "❌ **Code d'entreprise introuvable (tentative 3/3)**\n\n" +
              "Ce code n'existe pas dans notre système.\n\n" +
              "🔍 **Vérifications à faire :**\n" +
              "• Le code est-il correct ?\n" +
              "• Votre patron a-t-il bien créé son compte ?\n" +
              "• Le code n'a-t-il pas expiré ?\n\n" +
              "Contactez votre patron pour vérifier le code.",
            completed: false,
            nextStep: 'employee_info'
          };
        }

        return {
          message: `❌ **Code d'entreprise introuvable (tentative ${attempts}/3)**\n\n` +
            "Ce code n'existe pas. Vérifiez avec votre patron.\n\n" +
            "Réessayez avec le bon code :",
          completed: false,
          nextStep: 'employee_info'
        };
      }

      // Business code is valid, store it and ask for employee name
      this.conversationStateService.updateState(phoneNumber, {
        businessCode: normalizedCode,
        businessName: businessInfo.business.name
      });

      this.logger.debug(`Valid business code ${normalizedCode} for ${phoneNumber}, business: ${businessInfo.business.name}`);

      const completionMessage = this.getStepCompletionMessage('employee_info', 'employee');

      return {
        message: `${completionMessage}\n✅ **Entreprise trouvée !**\n\n` +
          `🏢 **${businessInfo.business.name}**\n` +
          `👥 ${businessInfo.employeeCount} employé(s) déjà inscrit(s)\n\n` +
          `📝 Maintenant, quel est votre nom complet ?\n\n` +
          `💡 Ce nom apparaîtra dans l'entreprise.`,
        completed: false,
        nextStep: 'employee_info'
      };

    } catch (error) {
      this.logger.error(`Error validating business code ${normalizedCode} for ${phoneNumber}:`, error);

      return {
        message: "❌ **Erreur technique**\n\n" +
          "Impossible de vérifier le code d'entreprise pour le moment.\n\n" +
          "Veuillez réessayer dans quelques minutes.",
        completed: false,
        nextStep: 'employee_info'
      };
    }
  }

  /**
   * Handle employee name collection
   */
  private async handleEmployeeNameCollection(
    phoneNumber: string,
    employeeName: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    // Validate employee name
    if (!employeeName || employeeName.length < 2) {
      return {
        message: "❌ Le nom est trop court.\n\n" +
          "Veuillez saisir votre nom complet (au moins 2 caractères).\n\n" +
          "💡 Exemple : \"Fabrice Ilboudo\"",
        completed: false,
        nextStep: 'employee_info'
      };
    }

    if (employeeName.length > 100) {
      return {
        message: "❌ Le nom est trop long (maximum 100 caractères).\n\n" +
          "Veuillez raccourcir votre nom.",
        completed: false,
        nextStep: 'employee_info'
      };
    }

    // Store employee name and move to role selection
    this.conversationStateService.setRegistrationState(phoneNumber, {
      step: 'role_selection',
      type: 'employee',
      phoneNumber: phoneNumber,
      businessCode: state.businessCode,
      businessName: state.businessName,
      employeeName: employeeName
    });

    this.logger.debug(`Employee name collected for ${phoneNumber}: ${employeeName}`);

    const progressBar = this.getProgressIndicator('role_selection', 'employee');

    return {
      message: `✅ **Nom :** ${employeeName}\n\n` +
        `🏢 **Entreprise :** ${state.businessName}\n\n` +
        `${progressBar}\n\n` +
        `👔 **Choisissez votre rôle :**\n\n` +
        `1️⃣ **Vendeur** - Enregistrer des ventes et consulter le stock\n` +
        `2️⃣ **Manager** - Toutes les fonctions (ventes, dépenses, stock, rapports)\n\n` +
        `Tapez '1' ou '2' pour continuer.`,
      completed: false,
      nextStep: 'role_selection'
    };
  }

  /**
   * Handle owner name collection and complete business owner registration
   */
  private async handleOwnerName(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    const trimmedMessage = message.trim();

    // Check for cancel/help requests
    if (trimmedMessage.toLowerCase() === 'stop' || trimmedMessage.toLowerCase() === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: "❌ Inscription annulée. Tapez 'bonjour' pour recommencer quand vous voulez.",
        completed: true,
        nextStep: 'cancelled'
      };
    }

    if (trimmedMessage.toLowerCase().includes('aide') || trimmedMessage.toLowerCase().includes('help')) {
      return {
        message: "ℹ️ **Aide - Nom du propriétaire**\n\n" +
          "Saisissez votre nom complet tel que vous voulez qu'il apparaisse.\n\n" +
          "💡 Exemples :\n" +
          "• Fabrice Ilboudo\n" +
          "Le nom doit faire entre 2 et 100 caractères.",
        completed: false,
        nextStep: 'owner_name'
      };
    }

    // Validate owner name
    if (!trimmedMessage || trimmedMessage.length < 2) {
      return {
        message: "❌ Le nom est trop court.\n\n" +
          "Veuillez saisir votre nom complet (au moins 2 caractères).\n\n" +
          "💡 Exemple : \"Fabrice Ilboudo\"",
        completed: false,
        nextStep: 'owner_name'
      };
    }

    if (trimmedMessage.length > 100) {
      return {
        message: "❌ Le nom est trop long (maximum 100 caractères).\n\n" +
          "Veuillez raccourcir votre nom.",
        completed: false,
        nextStep: 'owner_name'
      };
    }

    const ownerName = trimmedMessage;
    const businessName = state.businessName;

    if (!businessName) {
      this.logger.error(`Missing business name for ${phoneNumber} during owner registration`);
      return {
        message: "❌ Erreur : nom d'entreprise manquant. Recommençons.\n\n" +
          "Quel est le nom de votre entreprise ?",
        completed: false,
        nextStep: 'business_info'
      };
    }

    try {
      // Create business owner using AuthService
      const registrationResult = await this.authService.registerBusinessOwner({
        phoneNumber: phoneNumber,
        businessName: businessName,
        role: 'owner' as any, // The AuthService expects UserRole.OWNER
        language: 'fr'
      });

      // Clear registration state
      this.conversationStateService.clearState(phoneNumber);

      this.logger.debug(`Business owner registration completed for ${phoneNumber}`);

      // Get business code from the created business
      const businessCode = registrationResult.user.business?.businessCode;

      return {
        message: this.getBusinessOwnerCompletionSummary(businessName, ownerName, businessCode),
        completed: true,
        nextStep: 'completed',
        data: {
          user: registrationResult.user,
          accessToken: registrationResult.accessToken,
          businessCode: businessCode
        }
      };

    } catch (error) {
      this.logger.error(`Error during business owner registration for ${phoneNumber}:`, error);

      // Handle specific error types
      if (error.message?.includes('already exists')) {
        return {
          message: "❌ Ce numéro de téléphone est déjà enregistré.\n\n" +
            "Si c'est votre numéro, contactez le support.\n" +
            "Sinon, vérifiez que vous utilisez le bon numéro.",
          completed: true,
          nextStep: 'error'
        };
      }

      return {
        message: "❌ **Erreur lors de la création de l'entreprise**\n\n" +
          "Une erreur technique s'est produite. Veuillez réessayer dans quelques minutes.\n\n" +
          "Si le problème persiste, contactez le support.\n\n" +
          "💡 Tapez 'bonjour' pour recommencer l'inscription.",
        completed: true,
        nextStep: 'error'
      };
    }
  }

  /**
   * Handle role selection and complete employee registration
   */
  private async handleRoleSelection(
    phoneNumber: string,
    message: string,
    state: RegistrationState
  ): Promise<RegistrationResponse> {
    const normalizedMessage = message.toLowerCase().trim();

    // Check for cancel/help requests
    if (normalizedMessage === 'stop' || normalizedMessage === 'annuler') {
      this.cancelRegistration(phoneNumber);
      return {
        message: "❌ Inscription annulée. Tapez 'bonjour' pour recommencer quand vous voulez.",
        completed: true,
        nextStep: 'cancelled'
      };
    }

    if (normalizedMessage.includes('aide') || normalizedMessage.includes('help')) {
      return {
        message: "ℹ️ **Aide - Choix du rôle**\n\n" +
          "**1️⃣ Vendeur :**\n" +
          "• Enregistrer des ventes\n" +
          "• Consulter le stock\n" +
          "• Gérer les produits\n\n" +
          "**2️⃣ Manager :**\n" +
          "• Toutes les fonctions du vendeur\n" +
          "• Enregistrer des dépenses\n" +
          "• Voir les rapports financiers\n" +
          "• Générer des bilans\n\n" +
          "Tapez '1' pour vendeur ou '2' pour manager.",
        completed: false,
        nextStep: 'role_selection'
      };
    }

    let selectedRole: 'seller' | 'manager';
    let roleDisplayName: string;

    // Check for seller selection
    if (normalizedMessage === '1' ||
      normalizedMessage.includes('vendeur') ||
      normalizedMessage.includes('seller') ||
      normalizedMessage.includes('vente')) {

      selectedRole = 'seller';
      roleDisplayName = 'Vendeur';
    }
    // Check for manager selection
    else if (normalizedMessage === '2' ||
      normalizedMessage.includes('manager') ||
      normalizedMessage.includes('gestionnaire') ||
      normalizedMessage.includes('responsable')) {

      selectedRole = 'manager';
      roleDisplayName = 'Manager';
    }
    // Invalid selection
    else {
      const attempts = (state.data?.roleSelectionAttempts || 0) + 1;

      // Update attempt count
      this.conversationStateService.updateState(phoneNumber, {
        roleSelectionAttempts: attempts
      });

      if (attempts >= 3) {
        return {
          message: "🤔 **Difficultés avec le choix du rôle (tentative 3/3)**\n\n" +
            "Laissez-moi vous expliquer simplement :\n\n" +
            "✅ **Tapez 1** → Vous êtes vendeur (ventes + stock)\n" +
            "✅ **Tapez 2** → Vous êtes manager (tout gérer)\n\n" +
            "Quel chiffre choisissez-vous ?",
          completed: false,
          nextStep: 'role_selection'
        };
      }

      return {
        message: `❌ **Choix non reconnu (tentative ${attempts}/3)**\n\n` +
          "Veuillez choisir :\n" +
          "1️⃣ Vendeur\n" +
          "2️⃣ Manager\n\n" +
          "Tapez '1' ou '2' pour continuer.",
        completed: false,
        nextStep: 'role_selection'
      };
    }

    // Validate required data
    if (!state.businessCode || !state.employeeName) {
      this.logger.error(`Missing required data for employee registration: ${phoneNumber}`);
      return {
        message: "❌ Erreur : données manquantes. Recommençons l'inscription.\n\n" +
          "Tapez 'bonjour' pour recommencer.",
        completed: true,
        nextStep: 'error'
      };
    }

    try {
      // Complete employee registration using AuthService
      const registrationResult = await this.authService.registerEmployee(
        phoneNumber,
        state.businessCode,
        state.employeeName,
        selectedRole,
        'fr'
      );

      // Clear registration state
      this.conversationStateService.clearState(phoneNumber);

      this.logger.debug(`Employee registration completed for ${phoneNumber} as ${selectedRole}`);

      return {
        message: this.getEmployeeCompletionSummary(state.employeeName, state.businessName, roleDisplayName, selectedRole),
        completed: true,
        nextStep: 'completed',
        data: {
          user: registrationResult.user,
          accessToken: registrationResult.accessToken,
          role: selectedRole
        }
      };

    } catch (error) {
      this.logger.error(`Error during employee registration for ${phoneNumber}:`, error);

      // Handle specific error types
      if (error.message?.includes('already exists')) {
        return {
          message: "❌ **Numéro déjà enregistré**\n\n" +
            "Ce numéro de téléphone est déjà inscrit dans une entreprise.\n\n" +
            "Si c'est votre numéro, contactez le support.\n" +
            "Sinon, vérifiez que vous utilisez le bon numéro.",
          completed: true,
          nextStep: 'error'
        };
      }

      if (error.message?.includes('Invalid business code')) {
        return {
          message: "❌ **Code d'entreprise invalide**\n\n" +
            "Le code d'entreprise n'est plus valide. Cela peut arriver si :\n" +
            "• L'entreprise a été supprimée\n" +
            "• Le code a été modifié\n\n" +
            "Contactez votre patron pour obtenir le nouveau code.",
          completed: true,
          nextStep: 'error'
        };
      }

      return {
        message: "❌ **Erreur lors de l'inscription**\n\n" +
          "Une erreur technique s'est produite. Veuillez réessayer dans quelques minutes.\n\n" +
          "Si le problème persiste, contactez le support.\n\n" +
          "💡 Tapez 'bonjour' pour recommencer l'inscription.",
        completed: true,
        nextStep: 'error'
      };
    }
  }

  /**
   * Get role-specific permissions message
   */
  private getRolePermissionsMessage(role: 'seller' | 'manager'): string {
    if (role === 'manager') {
      return "• ✅ Enregistrer des ventes\n" +
        "• ✅ Enregistrer des dépenses\n" +
        "• ✅ Gérer le stock\n" +
        "• ✅ Voir les rapports\n" +
        "• ✅ Générer des bilans PDF";
    } else {
      return "• ✅ Enregistrer des ventes\n" +
        "• ✅ Consulter le stock\n" +
        "• ❌ Dépenses (réservé au manager/propriétaire)\n" +
        "• ❌ Rapports (réservé au manager/propriétaire)";
    }
  }

  /**
   * Handle system errors with user-friendly messages and recovery options
   */
  private handleSystemError(phoneNumber: string, error: any, context: string): RegistrationResponse {
    this.logger.error(`System error in ${context} for ${phoneNumber}:`, error);

    // Determine error type and provide appropriate response
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        message: "🔧 **Problème de connexion**\n\n" +
          "Nous avons des difficultés à nous connecter à nos serveurs.\n\n" +
          "⏰ Veuillez réessayer dans quelques minutes.\n\n" +
          "💡 Si le problème persiste, contactez le support.",
        completed: false,
        nextStep: 'retry_later'
      };
    }

    if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
      return {
        message: "⏱️ **Délai d'attente dépassé**\n\n" +
          "L'opération prend plus de temps que prévu.\n\n" +
          "🔄 Voulez-vous réessayer ?\n\n" +
          "Tapez 'oui' pour réessayer ou 'stop' pour annuler.",
        completed: false,
        nextStep: 'retry_prompt'
      };
    }

    // Generic system error
    return {
      message: "❌ **Erreur technique**\n\n" +
        "Une erreur inattendue s'est produite.\n\n" +
        "🔄 **Options de récupération :**\n" +
        "• Tapez 'retry' pour réessayer\n" +
        "• Tapez 'restart' pour recommencer l'inscription\n" +
        "• Tapez 'support' pour contacter l'aide\n\n" +
        "Nous nous excusons pour la gêne occasionnée.",
      completed: false,
      nextStep: 'error_recovery'
    };
  }

  /**
   * Provide contextual help based on current registration step
   */
  private getContextualHelp(step: string): string {
    switch (step) {
      case 'type_selection':
        return "ℹ️ **Aide - Choix du type de compte**\n\n" +
          "🏢 **Propriétaire** : Vous créez une nouvelle entreprise\n" +
          "👤 **Employé** : Vous rejoignez une entreprise existante avec un code\n\n" +
          "💡 Si vous n'êtes pas sûr, demandez à votre patron s'il a déjà créé un compte.";

      case 'business_info':
        return "ℹ️ **Aide - Nom de l'entreprise**\n\n" +
          "Saisissez le nom tel que vous voulez qu'il apparaisse.\n\n" +
          "📝 **Conseils :**\n" +
          "• Utilisez un nom clair et professionnel\n" +
          "• Entre 2 et 100 caractères\n" +
          "• Évitez les caractères spéciaux\n\n" +
          "💡 Exemples : \"Boutique Fatou\", \"Restaurant Chez Amadou\"";

      case 'owner_name':
        return "ℹ️ **Aide - Nom du propriétaire**\n\n" +
          "Saisissez votre nom complet tel que vous voulez qu'il apparaisse.\n\n" +
          "📝 **Format :**\n" +
          "• Prénom et nom de famille\n" +
          "• Entre 2 et 100 caractères\n\n" +
          "💡 Exemples : \"Fabrice Ilboudo\"";

      case 'employee_info':
        return "ℹ️ **Aide - Code d'entreprise**\n\n" +
          "Le code est fourni par votre patron lors de la création de son compte.\n\n" +
          "📝 **Format :**\n" +
          "• Exactement 6 caractères\n" +
          "• Lettres et chiffres uniquement\n" +
          "• Insensible à la casse\n\n" +
          "💡 Exemples : ABC123, XYZ789, DEF456";

      case 'role_selection':
        return "ℹ️ **Aide - Choix du rôle**\n\n" +
          "**Vendeur :** Ventes et gestion du stock uniquement\n" +
          "**Manager :** Toutes les fonctions (ventes, dépenses, rapports)\n\n" +
          "💡 Choisissez selon les responsabilités que votre patron vous a données.";

      default:
        return "ℹ️ **Aide générale**\n\n" +
          "Vous êtes en cours d'inscription. Suivez les instructions à l'écran.\n\n" +
          "🔄 Tapez 'restart' pour recommencer\n" +
          "❌ Tapez 'stop' pour annuler";
    }
  }

  /**
   * Validate input length and provide specific feedback
   */
  private validateInputLength(input: string, fieldName: string, minLength: number = 2, maxLength: number = 100): {
    isValid: boolean;
    message?: string;
  } {
    if (!input || input.trim().length === 0) {
      return {
        isValid: false,
        message: `❌ **${fieldName} requis**\n\nVeuillez saisir ${fieldName.toLowerCase()}.\n\n💡 Ne laissez pas le champ vide.`
      };
    }

    const trimmed = input.trim();

    if (trimmed.length < minLength) {
      return {
        isValid: false,
        message: `❌ **${fieldName} trop court**\n\n` +
          `Minimum ${minLength} caractères requis (vous avez saisi ${trimmed.length}).\n\n` +
          `💡 Soyez plus précis dans votre saisie.`
      };
    }

    if (trimmed.length > maxLength) {
      return {
        isValid: false,
        message: `❌ **${fieldName} trop long**\n\n` +
          `Maximum ${maxLength} caractères autorisés (vous avez saisi ${trimmed.length}).\n\n` +
          `💡 Raccourcissez votre saisie.`
      };
    }

    return { isValid: true };
  }

  /**
   * Generate recovery suggestions based on error context
   */
  private getRecoverySuggestions(errorType: string, step: string): string {
    const suggestions = {
      'validation_error': [
        "🔍 Vérifiez le format de votre saisie",
        "💡 Consultez les exemples fournis",
        "🔄 Réessayez avec une saisie différente"
      ],
      'network_error': [
        "📶 Vérifiez votre connexion internet",
        "⏰ Attendez quelques minutes et réessayez",
        "🔄 Redémarrez l'application WhatsApp"
      ],
      'business_code_error': [
        "📞 Contactez votre patron pour vérifier le code",
        "🔍 Vérifiez que le code fait bien 6 caractères",
        "⏰ Assurez-vous que le code n'a pas expiré"
      ],
      'duplicate_user': [
        "📞 Contactez le support si c'est votre numéro",
        "🔍 Vérifiez que vous utilisez le bon numéro",
        "❓ Demandez à votre patron si vous êtes déjà inscrit"
      ]
    };

    const contextSuggestions = suggestions[errorType] || suggestions['validation_error'];

    return "🛠️ **Suggestions de résolution :**\n" +
      contextSuggestions.map(suggestion => `• ${suggestion}`).join('\n') +
      "\n\n💬 Tapez 'aide' pour plus d'informations.";
  }

  /**
   * Generate comprehensive completion summary for business owners
   */
  private getBusinessOwnerCompletionSummary(businessName: string, ownerName: string, businessCode: string): string {
    const progressBar = '✅ 👤 Type de compte\n✅ 🏢 Info entreprise\n✅ 📝 Nom propriétaire';

    return `🎉 **INSCRIPTION TERMINÉE AVEC SUCCÈS !**\n\n` +
      `📊 **Progression: 3/3 (100%)**\n${progressBar}\n\n` +
      `📋 **RÉCAPITULATIF DE VOTRE COMPTE :**\n` +
      `✅ **Entreprise :** ${businessName}\n` +
      `✅ **Propriétaire :** ${ownerName}\n` +
      `✅ **Statut :** Propriétaire (accès complet)\n` +
      `🔑 **Code d'entreprise :** \`${businessCode}\`\n\n` +
      `👥 **COMMENT INVITER VOS EMPLOYÉS :**\n` +
      `1️⃣ Partagez ce code : **${businessCode}**\n` +
      `2️⃣ Demandez-leur de contacter ce bot WhatsApp\n` +
      `3️⃣ Ils choisiront "Employé" et saisiront votre code\n` +
      `4️⃣ Ils sélectionneront leur rôle (Vendeur/Manager)\n\n` +
      `🔐 **VOS PERMISSIONS COMPLÈTES :**\n` +
      `• 💰 Enregistrer des ventes\n` +
      `• 💸 Enregistrer des dépenses\n` +
      `• 📦 Gérer le stock et les produits\n` +
      `• 📊 Voir tous les rapports financiers\n` +
      `• 📄 Générer des bilans PDF\n` +
      `• 👥 Gérer les employés\n` +
      `• ⚙️ Modifier les paramètres de l'entreprise\n\n` +
      `🚀 **COMMANDES PRINCIPALES À ESSAYER :**\n` +
      `• \`vente\` - Enregistrer une nouvelle vente\n` +
      `• \`depense\` - Enregistrer une dépense\n` +
      `• \`stock\` - Consulter le stock\n` +
      `• \`rapport\` - Voir les rapports\n` +
      `• \`aide\` - Liste complète des commandes\n\n` +
      `💡 **Conseil :** Sauvegardez votre code d'entreprise **${businessCode}** dans un endroit sûr !`;
  }

  /**
   * Get merchant completion message after business creation
   */
  private getMerchantCompletionMessage(businessName: string, ownerName: string, businessCode: string): string {
    return `🎉 **Félicitations ! Votre entreprise a été créée avec succès !**\n\n` +
      `✅ **Détails de votre entreprise :**\n` +
      `🏢 **Nom :** ${businessName}\n` +
      `👤 **Propriétaire :** ${ownerName}\n` +
      `🔑 **Code entreprise :** ${businessCode}\n\n` +
      `📦 **Ajouter des produits :**\n` +
      `Vous pouvez ajouter des produits à tout moment avec la commande :\n` +
      `\`ajouter produit [nom_produit]\`\n\n` +
      `*Exemple :* \`ajouter produit Pain\`\n\n` +
      `📋 **Prochaines étapes :**\n` +
      `• Partagez le code ${businessCode} avec vos employés\n` +
      `• Commencez à enregistrer vos ventes avec "vente"\n` +
      `• Gérez votre stock avec "stock"\n` +
      `• Consultez vos rapports avec "rapport"\n\n` +
      `💡 Tapez "aide" à tout moment pour voir toutes les commandes disponibles.\n\n` +
      `Bienvenue dans votre nouveau système de gestion ! 🚀`;
  }

  /**
   * Generate comprehensive completion summary for employees
   */
  private getEmployeeCompletionSummary(employeeName: string, businessName: string, roleDisplayName: string, role: 'seller' | 'manager'): string {
    const progressBar = '✅ 👤 Type de compte\n✅ 🔑 Code entreprise\n✅ 👔 Choix du rôle';
    const permissionsMessage = this.getRolePermissionsMessage(role);
    const commandsMessage = this.getRoleCommandsMessage(role);

    return `🎉 **INSCRIPTION TERMINÉE AVEC SUCCÈS !**\n\n` +
      `📊 **Progression: 3/3 (100%)**\n${progressBar}\n\n` +
      `📋 **RÉCAPITULATIF DE VOTRE COMPTE :**\n` +
      `✅ **Nom :** ${employeeName}\n` +
      `✅ **Entreprise :** ${businessName}\n` +
      `✅ **Rôle :** ${roleDisplayName}\n\n` +
      `🔐 **VOS PERMISSIONS :**\n${permissionsMessage}\n\n` +
      `🚀 **COMMANDES DISPONIBLES POUR VOUS :**\n${commandsMessage}\n\n` +
      `💡 **CONSEILS POUR BIEN COMMENCER :**\n` +
      `• Tapez \`aide\` pour voir toutes vos commandes\n` +
      `• Commencez par consulter le stock avec \`stock\`\n` +
      `• Pour enregistrer une vente, tapez \`vente\`\n` +
      `• En cas de problème, contactez votre patron\n\n` +
      `🎯 **Vous êtes maintenant prêt(e) à utiliser le bot !**`;
  }



  /**
   * Get role-specific commands message
   */
  private getRoleCommandsMessage(role: 'seller' | 'manager'): string {
    const commonCommands = [
      '• `vente` - Enregistrer une nouvelle vente',
      '• `stock` - Consulter le stock disponible',
      '• `produit` - Ajouter/modifier des produits',
      '• `aide` - Voir toutes les commandes'
    ];

    if (role === 'manager') {
      const managerCommands = [
        '• `depense` - Enregistrer une dépense',
        '• `rapport` - Voir les rapports financiers',
        '• `bilan` - Générer un bilan PDF'
      ];
      return [...commonCommands, ...managerCommands].join('\n');
    }

    return commonCommands.join('\n');
  }

  /**
   * Check if message is a session extension request
   */
  private isSessionExtensionRequest(message: string): boolean {
    const normalizedMessage = message.toLowerCase().trim();

    // More specific session extension patterns to avoid conflicts with merchant onboarding
    const extensionPatterns = [
      /^(continuer|continue)\s+(session|inscription)$/i,
      /^(prolonger|extend)\s*(session|inscription)?$/i,
      /^(encore|plus de temps|attendre)$/i
    ];

    return extensionPatterns.some(pattern => pattern.test(normalizedMessage));
  }

  /**
   * Handle session extension request
   */
  private handleSessionExtension(phoneNumber: string): RegistrationResponse {
    const extended = this.conversationStateService.extendSession(phoneNumber);

    if (extended) {
      const state = this.conversationStateService.getRegistrationState(phoneNumber);
      const stepName = this.getStepDisplayName(state?.step || '');

      return {
        message: `✅ **Session prolongée de 30 minutes !**\n\n` +
          `Vous pouvez continuer votre inscription.\n` +
          `Étape actuelle: ${stepName}\n\n` +
          `💡 Tapez 'aide' si vous avez besoin d'assistance.`,
        completed: false,
        nextStep: state?.step || 'unknown'
      };
    } else {
      return {
        message: `❌ **Impossible de prolonger la session**\n\n` +
          `Aucune inscription en cours trouvée.\n\n` +
          `🔄 Pour commencer une nouvelle inscription, tapez 'bonjour'.`,
        completed: false,
        nextStep: 'no_session'
      };
    }
  }

  /**
   * Handle expired session scenario
   */
  private handleExpiredSession(phoneNumber: string): RegistrationResponse {
    // Clear the expired state
    this.conversationStateService.clearState(phoneNumber);

    return {
      message: this.onboardingMessagesService.getSessionExpiredMessage(),
      completed: true,
      nextStep: 'expired'
    };
  }

  /**
   * Get display name for a registration step
   */
  private getStepDisplayName(step: string): string {
    const stepNames = {
      'type_selection': 'Choix du type de compte',
      'phone_verification': 'Vérification du téléphone',
      'business_info': 'Informations de l\'entreprise',
      'owner_name': 'Nom du propriétaire',
      'employee_info': 'Code d\'entreprise',
      'role_selection': 'Choix du rôle'
    };
    return stepNames[step] || step;
  }

  /**
   * Check if user wants to restart registration after timeout
   */
  isRestartRequest(message: string): boolean {
    const normalizedMessage = message.toLowerCase().trim();
    const restartKeywords = [
      'bonjour', 'salut', 'hello', 'hi', 'restart',
      'recommencer', 'nouvelle inscription', 'inscription'
    ];

    return restartKeywords.some(keyword => normalizedMessage.includes(keyword));
  }

  /**
   * Get merchant onboarding start message
   */
  private getMerchantOnboardingStartMessage(): string {
    return `🏢 **CRÉATION D'UNE NOUVELLE ENTREPRISE**\n\n` +
      `👋 Parfait ! Vous allez créer votre propre entreprise.\n\n` +
      `📋 **Le processus comprend :**\n` +
      `1️⃣ Nom de votre entreprise\n` +
      `2️⃣ Votre nom en tant que propriétaire\n` +
      `3️⃣ Création automatique de votre compte\n\n` +
      `⏱️ **Durée estimée :** 2-3 minutes\n\n` +
      `🔐 **Avantages :**\n` +
      `• Accès complet à toutes les fonctions\n` +
      `• Gestion des ventes et dépenses\n` +
      `• Rapports financiers détaillés\n` +
      `• Invitation d'employés avec codes\n\n` +
      `✅ Tapez 'continuer' pour commencer\n` +
      `❌ Tapez 'stop' pour annuler`;
  }

  /**
   * Get merchant business name collection message
   */
  private getMerchantBusinessNameMessage(): string {
    return `📝 **ÉTAPE 1/2 - NOM DE L'ENTREPRISE**\n\n` +
      `🏢 Quel est le nom de votre entreprise ?\n\n` +
      `💡 **Exemples :**\n` +
      `• Boutique Fatou\n` +
      `• Restaurant Chez Amadou\n` +
      `• Salon de Coiffure Aïcha\n` +
      `📏 **Format :** Entre 2 et 100 caractères\n\n` +
      `💬 Saisissez le nom de votre entreprise :`;
  }

  /**
   * Get merchant owner name collection message
   */
  private getMerchantOwnerNameMessage(businessName: string): string {
    return `✅ **Entreprise :** "${businessName}"\n\n` +
      `📝 **ÉTAPE 2/2 - NOM DU PROPRIÉTAIRE**\n\n` +
      `👤 Quel est votre nom complet ?\n\n` +
      `💡 **Exemples :**\n` +
      `• Fabrice Ilboudo\n` +
      `📏 **Format :** Entre 2 et 100 caractères\n\n` +
      `💬 Saisissez votre nom complet :`;
  }

  /**
   * Get merchant confirmation message
   */
  private getMerchantConfirmationMessage(businessName: string, ownerName: string): string {
    return `📋 **CONFIRMATION DES INFORMATIONS**\n\n` +
      `🏢 **Entreprise :** ${businessName}\n` +
      `👤 **Propriétaire :** ${ownerName}\n` +
      `📱 **Numéro :** ${this.formatPhoneNumber()}\n\n` +
      `⚠️ **Important :** Ces informations ne pourront plus être modifiées après création.\n\n` +
      `✅ **Tapez 'confirmer'** pour créer votre entreprise\n` +
      `🔄 **Tapez 'modifier'** pour changer les informations\n` +
      `❌ **Tapez 'stop'** pour annuler`;
  }

  /**
   * Get merchant completion summary
   */
  private getMerchantCompletionSummary(businessName: string, ownerName: string, businessCode: string): string {
    return `🎉 **ENTREPRISE CRÉÉE AVEC SUCCÈS !**\n\n` +
      `📋 **RÉCAPITULATIF :**\n` +
      `✅ **Entreprise :** ${businessName}\n` +
      `✅ **Propriétaire :** ${ownerName}\n` +
      `✅ **Statut :** Propriétaire (accès complet)\n` +
      `🔑 **Code d'entreprise :** \`${businessCode}\`\n\n` +
      `👥 **INVITER VOS EMPLOYÉS :**\n` +
      `1️⃣ Partagez ce code : **${businessCode}**\n` +
      `2️⃣ Demandez-leur de contacter ce bot WhatsApp\n` +
      `3️⃣ Ils choisiront "Employé" et saisiront votre code\n` +
      `4️⃣ Ils sélectionneront leur rôle (Vendeur/Manager)\n\n` +
      `🔐 **VOS PERMISSIONS COMPLÈTES :**\n` +
      `• 💰 Enregistrer des ventes\n` +
      `• 💸 Enregistrer des dépenses\n` +
      `• 📦 Gérer le stock et les produits\n` +
      `• 📊 Voir tous les rapports financiers\n` +
      `• 📄 Générer des bilans PDF\n` +
      `• 👥 Gérer les employés\n` +
      `• ⚙️ Modifier les paramètres de l'entreprise\n\n` +
      `🚀 **COMMANDES PRINCIPALES À ESSAYER :**\n` +
      `• \`vente\` - Enregistrer une nouvelle vente\n` +
      `• \`depense\` - Enregistrer une dépense\n` +
      `• \`stock\` - Consulter le stock\n` +
      `• \`rapport\` - Voir les rapports\n` +
      `• \`aide\` - Liste complète des commandes\n\n` +
      `💡 **Conseil :** Sauvegardez votre code d'entreprise **${businessCode}** dans un endroit sûr !`;
  }

  /**
   * Format phone number for display (placeholder implementation)
   */
  private formatPhoneNumber(): string {
    // This would normally format the actual phone number
    // For now, return a placeholder
    return "Votre numéro WhatsApp";
  }
}