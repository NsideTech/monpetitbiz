import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { ProcessedMessage } from '../interfaces/webhook.interface';

export interface OnboardingStatus {
    isOnboarded: boolean;
    userType?: 'owner' | 'employee';
    businessName?: string;
    requiresOnboarding: boolean;
}

export interface ActionValidationResult {
    allowed: boolean;
    reason?: string;
    onboardingPrompt?: string;
}

@Injectable()
export class OnboardingCheckMiddleware {
    private readonly logger = new Logger(OnboardingCheckMiddleware.name);

    // Messages that trigger onboarding prompts based on action type
    private readonly ONBOARDING_PROMPTS = {
        general: "👋 Bienvenue ! Pour utiliser ce service, vous devez d'abord créer votre compte.\n\n📝 Tapez 'créer une nouvelle entreprise' pour commencer.",

        afterSaleAttempt: "💰 Pour enregistrer des ventes, vous devez d'abord créer votre entreprise.\n\n📝 Tapez 'créer une nouvelle entreprise' pour commencer l'inscription.",

        afterStockAttempt: "📦 Pour gérer votre stock, vous devez d'abord créer votre entreprise.\n\n📝 Tapez 'créer une nouvelle entreprise' pour commencer l'inscription.",

        afterReportAttempt: "📊 Pour consulter vos rapports, vous devez d'abord créer votre entreprise.\n\n📝 Tapez 'créer une nouvelle entreprise' pour commencer l'inscription.",

        afterExpenseAttempt: "💸 Pour enregistrer des dépenses, vous devez d'abord créer votre entreprise.\n\n📝 Tapez 'créer une nouvelle entreprise' pour commencer l'inscription.",

        afterBalanceAttempt: "📈 Pour consulter votre bilan, vous devez d'abord créer votre entreprise.\n\n📝 Tapez 'créer une nouvelle entreprise' pour commencer l'inscription."
    };

    constructor(
        private readonly authService: AuthService,
    ) { }

    /**
     * Check user onboarding status
     */
    async checkUserOnboardingStatus(phoneNumber: string): Promise<OnboardingStatus> {
        try {
            const user = await this.authService.getUserByPhone(phoneNumber);

            if (!user || !user.isActive) {
                return {
                    isOnboarded: false,
                    requiresOnboarding: true
                };
            }

            // User exists and is active
            const userType = user.role === 'owner' ? 'owner' : 'employee';

            return {
                isOnboarded: true,
                userType,
                businessName: user.business?.name,
                requiresOnboarding: false
            };

        } catch (error) {
            this.logger.error(`Error checking onboarding status for ${phoneNumber}:`, error);

            // On error, assume user needs onboarding for safety
            return {
                isOnboarded: false,
                requiresOnboarding: true
            };
        }
    }

    /**
     * Generate contextual onboarding prompt based on attempted action
     */
    async generateOnboardingPrompt(phoneNumber: string, attemptedAction?: string): Promise<string> {
        this.logger.debug(`Generating onboarding prompt for ${phoneNumber}, attempted action: ${attemptedAction}`);

        // Determine the appropriate prompt based on the attempted action
        if (attemptedAction) {
            const actionType = this.detectActionType(attemptedAction);

            switch (actionType) {
                case 'sale':
                    return this.ONBOARDING_PROMPTS.afterSaleAttempt;
                case 'stock':
                    return this.ONBOARDING_PROMPTS.afterStockAttempt;
                case 'report':
                    return this.ONBOARDING_PROMPTS.afterReportAttempt;
                case 'expense':
                    return this.ONBOARDING_PROMPTS.afterExpenseAttempt;
                case 'balance':
                    return this.ONBOARDING_PROMPTS.afterBalanceAttempt;
                default:
                    return this.ONBOARDING_PROMPTS.general;
            }
        }

        return this.ONBOARDING_PROMPTS.general;
    }

    /**
     * Check if a message indicates onboarding action
     * Requirements: 1.1
     */
    isOnboardingAction(message: string): boolean {
        const normalizedMessage = message.toLowerCase().trim();

        // Check for various onboarding trigger phrases
        const onboardingTriggers = [
            'créer une nouvelle entreprise',
            'nouvelle entreprise',
            'créer entreprise',
            'inscription',
            'commencer',
            'bonjour',
            'salut',
            'hello',
            'hi'
        ];

        return onboardingTriggers.some(trigger =>
            normalizedMessage.includes(trigger)
        );
    }

    /**
     * Validate if user can execute a specific action
     * Requirements: 1.1, 1.3
     */
    async canExecuteAction(phoneNumber: string, action: string): Promise<ActionValidationResult> {
        const onboardingStatus = await this.checkUserOnboardingStatus(phoneNumber);

        // If user is onboarded, they can execute any action
        if (onboardingStatus.isOnboarded) {
            return { allowed: true };
        }

        // If user is not onboarded, check if this is an onboarding action
        if (this.isOnboardingAction(action)) {
            return { allowed: true };
        }

        // User is not onboarded and trying to perform a business action
        const onboardingPrompt = await this.generateOnboardingPrompt(phoneNumber, action);

        return {
            allowed: false,
            reason: 'User not onboarded',
            onboardingPrompt
        };
    }

    /**
     * Intercept and validate message before processing
     * This is the main middleware function that should be called before bot processing
     * Requirements: 1.1, 1.3
     */
    async interceptMessage(phoneNumber: string, message: string): Promise<{
        shouldProcess: boolean;
        response?: string;
        redirectToOnboarding?: boolean;
    }> {
        try {
            this.logger.debug(`Intercepting message from ${phoneNumber}: "${message}"`);

            // Check if user can execute this action
            const actionValidation = await this.canExecuteAction(phoneNumber, message);

            if (actionValidation.allowed) {
                // User can proceed with the action
                return { shouldProcess: true };
            }

            // User cannot execute the action, needs onboarding
            return {
                shouldProcess: false,
                response: actionValidation.onboardingPrompt,
                redirectToOnboarding: true
            };

        } catch (error) {
            this.logger.error(`Error intercepting message from ${phoneNumber}:`, error);

            // On error, check if this is an onboarding action to allow it through
            if (this.isOnboardingAction(message)) {
                return { shouldProcess: true };
            }

            // For non-onboarding actions, provide general onboarding prompt
            return {
                shouldProcess: false,
                response: this.ONBOARDING_PROMPTS.general,
                redirectToOnboarding: true
            };
        }
    }

    /**
     * Detect the type of action from a message
     * Private helper method to categorize user intents
     */
    private detectActionType(message: string): string {
        const normalizedMessage = message.toLowerCase().trim();

        // Expense patterns (check first to avoid confusion with sales)
        if (normalizedMessage.includes('dépense') ||
            normalizedMessage.includes('depense') ||
            normalizedMessage.includes('achat')) {
            return 'expense';
        }

        // Stock patterns
        if (normalizedMessage.includes('stock')) {
            return 'stock';
        }

        // Report patterns
        if (normalizedMessage.includes('rapport') ||
            normalizedMessage.includes('pdf')) {
            return 'report';
        }

        // Balance patterns
        if (normalizedMessage.includes('bilan') ||
            normalizedMessage.includes('balance') ||
            normalizedMessage.includes('résultat')) {
            return 'balance';
        }

        // Sale patterns (check last as it's more general)
        if (normalizedMessage.includes('vente') ||
            (normalizedMessage.match(/\d+/) && !normalizedMessage.includes('stock'))) {
            return 'sale';
        }

        return 'unknown';
    }
}