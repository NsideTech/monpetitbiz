import { Injectable, Logger } from '@nestjs/common';
import { CommandParserService, ParsedCommand } from './command-parser.service';
import { ConversationStateService } from './conversation-state.service';
import { ProcessedMessage } from '../interfaces/webhook.interface';

export interface NLPResult {
  command: ParsedCommand;
  isValid: boolean;
  errors: string[];
  suggestedResponse?: string;
  requiresAuth?: boolean;
  requiresPermission?: string[];
  isRegistrationIntent?: boolean;
  registrationContext?: {
    hasBusinessCode?: boolean;
    businessCode?: string;
    isRoleSelection?: boolean;
    selectedRole?: 'seller' | 'manager';
    isTypeSelection?: boolean;
    selectedType?: 'owner' | 'employee';
  };
}

export interface UserContext {
  userId?: string;
  businessId?: string;
  businessName?: string;
  language?: string;
  role?: 'owner' | 'seller' | 'manager';
  isAuthenticated: boolean;
  dbError?: boolean; // Indicates if there was a database connection error
}

@Injectable()
export class NLPService {
  private readonly logger = new Logger(NLPService.name);

  constructor(
    private readonly commandParser: CommandParserService,
    private readonly conversationStateService: ConversationStateService,
  ) { }

  /**
   * Process a message and return NLP analysis
   */
  async processMessage(
    message: ProcessedMessage,
    userContext: UserContext = { isAuthenticated: false }
  ): Promise<NLPResult> {
    this.logger.debug(`Processing message from ${message.from}: "${message.body}"`);

    try {
      // Check if user is in registration flow
      const isInRegistration = this.conversationStateService.isInRegistration(message.from);
      const registrationState = this.conversationStateService.getRegistrationState(message.from);

      // Detect registration intent
      const registrationContext = this.detectRegistrationIntent(message.body, registrationState);
      const isRegistrationIntent = registrationContext.isRegistrationIntent || isInRegistration;

      // Parse the command
      const command = this.commandParser.parseMessage(message.body, userContext.language);

      // If it's a registration intent, override command type
      if (isRegistrationIntent && !userContext.isAuthenticated) {
        command.type = 'registration';
        command.confidence = 0.9;
      }

      // Validate the command
      const validation = this.commandParser.validateCommand(command);

      // Check authentication and permissions
      const authCheck = this.checkAuthAndPermissions(command, userContext);

      // Generate suggested response if needed
      const suggestedResponse = this.generateSuggestedResponse(command, validation, userContext);

      const result: NLPResult = {
        command,
        isValid: validation.isValid && authCheck.hasPermission,
        errors: [...validation.errors, ...authCheck.errors],
        suggestedResponse,
        requiresAuth: authCheck.requiresAuth,
        requiresPermission: authCheck.requiredPermissions,
        isRegistrationIntent,
        registrationContext,
      };

      this.logger.debug(`NLP result for message ${message.messageId}:`, {
        type: command.type,
        confidence: command.confidence,
        isValid: result.isValid,
        requiresAuth: result.requiresAuth,
        isRegistrationIntent: result.isRegistrationIntent,
      });

      return result;
    } catch (error) {
      this.logger.error(`Error processing message ${message.messageId}:`, error);

      return {
        command: {
          type: 'unknown',
          confidence: 0,
          originalText: message.body,
          language: userContext.language || 'fr',
        },
        isValid: false,
        errors: ['Erreur lors du traitement du message'],
        suggestedResponse: this.commandParser.getHelpMessage(userContext.language),
      };
    }
  }

  /**
   * Detect registration intent from message content and conversation state
   */
  private detectRegistrationIntent(
    message: string,
    registrationState: any
  ): {
    isRegistrationIntent: boolean;
    hasBusinessCode?: boolean;
    businessCode?: string;
    isRoleSelection?: boolean;
    selectedRole?: 'seller' | 'manager';
    isTypeSelection?: boolean;
    selectedType?: 'owner' | 'employee';
  } {
    const normalizedMessage = message.toLowerCase().trim();

    // If user is already in registration flow, it's always a registration intent
    if (registrationState) {
      const context: any = { isRegistrationIntent: true };

      // Detect specific registration contexts based on current step
      switch (registrationState.step) {
        case 'type_selection':
          context.isTypeSelection = true;
          if (normalizedMessage === '1' || normalizedMessage.includes('propriétaire')) {
            context.selectedType = 'owner';
          } else if (normalizedMessage === '2' || normalizedMessage.includes('employé')) {
            context.selectedType = 'employee';
          }
          break;

        case 'role_selection':
          context.isRoleSelection = true;
          if (normalizedMessage === '1' || normalizedMessage.includes('vendeur')) {
            context.selectedRole = 'seller';
          } else if (normalizedMessage === '2' || normalizedMessage.includes('manager')) {
            context.selectedRole = 'manager';
          }
          break;

        case 'employee_info':
          // Check if message contains a business code
          const businessCodePattern = /\b[A-Z0-9]{6}\b/i;
          const businessCodeMatch = message.match(businessCodePattern);
          if (businessCodeMatch) {
            context.hasBusinessCode = true;
            context.businessCode = businessCodeMatch[0].toUpperCase();
          }
          break;
      }

      return context;
    }

    // Registration keywords in French and Wolof
    const registrationKeywords = [
      // French greetings and registration terms
      'bonjour', 'salut', 'bonsoir', 'hello', 'hi',
      'inscription', 'enregistrement', 'créer compte', 'nouveau compte',
      'commencer', 'démarrer',
      'propriétaire', 'employé', 'patron', 'boss',
      'code entreprise', 'code business', 'code invitation',

      // Wolof greetings
      // 'nanga def', 'asalamu aleykum', 'salaam aleykum',
      // 'damay bëgg', 'bëgg naa'
    ];

    // Check for exact matches or partial matches
    const hasKeyword = registrationKeywords.some(keyword =>
      normalizedMessage.includes(keyword)
    );

    // Check for business code pattern (6 alphanumeric characters)
    const businessCodePattern = /\b[A-Z0-9]{6}\b/i;
    const businessCodeMatch = message.match(businessCodePattern);
    const hasBusinessCode = !!businessCodeMatch;

    // Check for greeting patterns
    const greetingPatterns = [
      /^(bonjour|salut|bonsoir|hello|hi)$/i,
      /^(nanga def|asalamu aleykum|salaam aleykum)$/i
    ];
    const isGreeting = greetingPatterns.some(pattern => pattern.test(normalizedMessage));

    const isRegistrationIntent = hasKeyword || hasBusinessCode || isGreeting;

    const context: any = { isRegistrationIntent };

    if (hasBusinessCode && businessCodeMatch) {
      context.hasBusinessCode = true;
      context.businessCode = businessCodeMatch[0].toUpperCase();
    }

    return context;
  }

  /**
   * Check authentication and permissions for a command
   */
  private checkAuthAndPermissions(
    command: ParsedCommand,
    userContext: UserContext
  ): {
    hasPermission: boolean;
    requiresAuth: boolean;
    requiredPermissions: string[];
    errors: string[];
  } {
    const errors: string[] = [];
    let requiresAuth = false;
    let hasPermission = true;
    const requiredPermissions: string[] = [];

    // Commands that don't require authentication
    const publicCommands = ['unknown', 'registration', 'help'];

    if (!publicCommands.includes(command.type)) {
      requiresAuth = true;

      if (!userContext.isAuthenticated) {
        hasPermission = false;
        errors.push('Authentification requise');
        return { hasPermission, requiresAuth, requiredPermissions, errors };
      }
    }

    // Check role-based permissions
    switch (command.type) {
      case 'sale':
      case 'stock':
      case 'stock_query':
        // Both owner and seller can perform these actions
        requiredPermissions.push('transaction:create', 'stock:manage');
        break;

      case 'expense':
      case 'balance':
      case 'report':
        // Only owner and manager can perform these actions
        requiredPermissions.push('finance:manage');
        if (userContext.role !== 'owner' && userContext.role !== 'manager') {
          hasPermission = false;
          errors.push('Action réservée au propriétaire et aux managers');
        }
        break;

      case 'registration':
        // Registration doesn't require specific permissions
        break;

      case 'help':
        // Help commands don't require specific permissions
        break;

      case 'unknown':
        // No specific permissions needed
        break;
    }

    return { hasPermission, requiresAuth, requiredPermissions, errors };
  }

  /**
   * Generate suggested response based on command and validation
   */
  private generateSuggestedResponse(
    command: ParsedCommand,
    validation: { isValid: boolean; errors: string[] },
    userContext: UserContext
  ): string | undefined {
    const language = userContext.language || 'fr';

    // If command is unknown or has low confidence, provide help
    if (command.type === 'unknown' || command.confidence < 0.3) {
      return this.commandParser.getHelpMessage(language);
    }

    // If validation failed, return error message
    if (!validation.isValid) {
      return validation.errors.join('. ');
    }

    // Generate confirmation messages for valid commands
    switch (command.type) {
      case 'sale':
        if (command.amount && command.product) {
          return `Vente enregistrée: ${command.product} pour ${command.amount} CFA`;
        } else if (command.amount) {
          return `Vente de ${command.amount} CFA enregistrée`;
        }
        break;

      case 'expense':
        if (command.amount && command.description) {
          return `Dépense enregistrée: ${command.description} pour ${command.amount} CFA`;
        } else if (command.amount) {
          return `Dépense de ${command.amount} CFA enregistrée`;
        }
        break;

      case 'stock':
        if (command.product && command.stockQuantity !== undefined) {
          return `Stock mis à jour: ${command.product} = ${command.stockQuantity} unités`;
        }
        break;

      case 'stock_query':
        if (command.product) {
          return `Consultation du stock pour: ${command.product}`;
        } else {
          return 'Consultation de tout le stock';
        }
        break;

      case 'balance':
        const periodText = this.getPeriodText(command.period, language);
        return `Génération du bilan ${periodText}...`;

      case 'report':
        const reportPeriodText = this.getPeriodText(command.period, language);
        return `Génération du rapport ${reportPeriodText}...`;
    }

    return undefined;
  }

  /**
   * Get period text in specified language
   */
  private getPeriodText(period: string | undefined, language: string): string {
    if (!period) period = 'day';

    const translations = {
      fr: {
        day: 'du jour',
        week: 'de la semaine',
        month: 'du mois',
      },
      wo: {
        day: 'tey',
        week: 'ayu-bis',
        month: 'weer',
      },
    };

    return translations[language]?.[period] || translations.fr[period];
  }

  /**
   * Extract business context from message
   */
  extractBusinessContext(message: ProcessedMessage): {
    possibleBusinessName?: string;
    possibleLocation?: string;
    businessType?: string;
  } {
    const text = message.body.toLowerCase();
    const context: any = {};

    // Try to extract business type from common patterns
    if (/boutique|magasin|shop|store/.test(text)) {
      context.businessType = 'retail';
    } else if (/restaurant|resto|food/.test(text)) {
      context.businessType = 'restaurant';
    } else if (/salon|coiffure|beauty/.test(text)) {
      context.businessType = 'beauty';
    }

    return context;
  }

  /**
   * Get command statistics for analytics
   */
  getCommandStats(commands: ParsedCommand[]): {
    totalCommands: number;
    commandTypes: Record<string, number>;
    averageConfidence: number;
    languageDistribution: Record<string, number>;
    validCommands: number;
  } {
    const stats = {
      totalCommands: commands.length,
      commandTypes: {} as Record<string, number>,
      averageConfidence: 0,
      languageDistribution: {} as Record<string, number>,
      validCommands: 0,
    };

    if (commands.length === 0) return stats;

    let totalConfidence = 0;

    for (const command of commands) {
      // Count command types
      stats.commandTypes[command.type] = (stats.commandTypes[command.type] || 0) + 1;

      // Count languages
      stats.languageDistribution[command.language] = (stats.languageDistribution[command.language] || 0) + 1;

      // Sum confidence
      totalConfidence += command.confidence;

      // Count valid commands (confidence > 0.5)
      if (command.confidence > 0.5) {
        stats.validCommands++;
      }
    }

    stats.averageConfidence = totalConfidence / commands.length;

    return stats;
  }

  /**
   * Suggest improvements for low-confidence commands
   */
  suggestImprovements(command: ParsedCommand): string[] {
    const suggestions: string[] = [];

    if (command.confidence < 0.5) {
      switch (command.type) {
        case 'sale':
        case 'expense':
          if (!command.amount) {
            suggestions.push('Précisez le montant (ex: "vente 1000")');
          }
          if (!command.product && !command.description) {
            suggestions.push('Ajoutez une description (ex: "vente pain 1000")');
          }
          break;

        case 'stock':
          if (!command.product) {
            suggestions.push('Précisez le nom du produit');
          }
          if (command.stockQuantity === undefined) {
            suggestions.push('Précisez la quantité');
          }
          break;

        case 'unknown':
          suggestions.push('Utilisez des mots-clés comme "vente", "dépense", "stock", "bilan"');
          break;
      }
    }

    return suggestions;
  }
}