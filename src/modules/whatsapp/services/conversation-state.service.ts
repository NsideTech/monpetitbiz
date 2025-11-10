import { Injectable, Logger } from '@nestjs/common';

export interface ConversationState {
  step: string;
  data: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
  timeoutWarningsSent?: number;
  lastActivityAt?: Date;
}

export interface RegistrationState {
  step: 'type_selection' | 'phone_verification' | 'business_info' | 'owner_name' | 'employee_info' | 'role_selection' | 'merchant_onboarding_start' | 'merchant_conflict_resolution' | 'merchant_business_name' | 'merchant_owner_name' | 'merchant_confirmation' | 'product_setup';
  type?: 'owner' | 'employee' | 'merchant';
  phoneNumber?: string;
  businessCode?: string;
  businessName?: string;
  employeeName?: string;
  ownerName?: string;
  country?: string;
  extractedPhoneNumber?: string;
  role?: 'owner' | 'seller' | 'manager';
  conflictType?: 'owner_exists' | 'employee_exists';
  products?: Array<{ name: string; price: number }>;
  data?: Record<string, any>;
}

export interface MerchantOnboardingState extends RegistrationState {
  step: 'merchant_onboarding_start' | 'merchant_conflict_resolution' | 'merchant_business_name' | 'merchant_owner_name' | 'merchant_confirmation';
  type: 'merchant';
  businessName?: string;
  ownerName?: string;
  phoneNumber: string;
  country?: string;
  extractedPhoneNumber?: string;
  conflictType?: 'owner_exists' | 'employee_exists';
}

@Injectable()
export class ConversationStateService {
  private readonly logger = new Logger(ConversationStateService.name);
  private readonly states = new Map<string, ConversationState>();
  private readonly EXPIRATION_TIME_MS = 30 * 60 * 1000; // 30 minutes
  private readonly WARNING_TIME_MS = 25 * 60 * 1000; // 25 minutes (5 min before expiry)
  private readonly FINAL_WARNING_TIME_MS = 28 * 60 * 1000; // 28 minutes (2 min before expiry)
  private cleanupInterval: NodeJS.Timeout;
  private timeoutCheckInterval: NodeJS.Timeout;

  constructor() {
    // Start cleanup interval to remove expired states every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 5 * 60 * 1000);

    // Start timeout warning check every minute
    this.timeoutCheckInterval = setInterval(() => {
      this.checkForTimeoutWarnings();
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
    }
  }

  /**
   * Get conversation state for a phone number
   */
  getState(phoneNumber: string): ConversationState | null {
    const state = this.states.get(phoneNumber);
    
    if (!state) {
      return null;
    }

    // Check if state has expired
    if (new Date() > state.expiresAt) {
      this.clearState(phoneNumber);
      this.logger.debug(`Expired state removed for ${phoneNumber}`);
      return null;
    }

    return state;
  }

  /**
   * Set conversation state for a phone number
   */
  setState(phoneNumber: string, step: string, data: Record<string, any> = {}): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.EXPIRATION_TIME_MS);

    const state: ConversationState = {
      step,
      data,
      createdAt: now,
      expiresAt,
      timeoutWarningsSent: 0,
      lastActivityAt: now,
    };

    this.states.set(phoneNumber, state);
    this.logger.debug(`State set for ${phoneNumber}: step=${step}`);
  }

  /**
   * Update existing conversation state data
   */
  updateState(phoneNumber: string, data: Record<string, any>): void {
    const existingState = this.getState(phoneNumber);
    
    if (!existingState) {
      this.logger.warn(`Attempted to update non-existent state for ${phoneNumber}`);
      return;
    }

    // Merge new data with existing data
    existingState.data = { ...existingState.data, ...data };
    
    // Update expiration time and last activity
    const now = new Date();
    existingState.expiresAt = new Date(now.getTime() + this.EXPIRATION_TIME_MS);
    existingState.lastActivityAt = now;
    existingState.timeoutWarningsSent = 0; // Reset warnings on activity
    
    this.states.set(phoneNumber, existingState);
    this.logger.debug(`State updated for ${phoneNumber}`);
  }

  /**
   * Clear conversation state for a phone number
   */
  clearState(phoneNumber: string): void {
    const deleted = this.states.delete(phoneNumber);
    if (deleted) {
      this.logger.debug(`State cleared for ${phoneNumber}`);
    }
  }

  /**
   * Force clear state and restart onboarding (for debugging)
   */
  forceRestartOnboarding(phoneNumber: string): void {
    this.clearState(phoneNumber);
    this.logger.log(`Forced restart of onboarding for ${phoneNumber}`);
  }

  /**
   * Get debug info about current state (for troubleshooting)
   */
  getDebugInfo(phoneNumber: string): any {
    const state = this.states.get(phoneNumber);
    return {
      hasState: !!state,
      step: state?.step,
      data: state?.data,
      expiresAt: state?.expiresAt,
      isExpired: state ? new Date() > state.expiresAt : false
    };
  }

  /**
   * Check if user is currently in registration flow
   */
  isInRegistration(phoneNumber: string): boolean {
    const state = this.getState(phoneNumber);
    return state !== null && this.isRegistrationStep(state.step);
  }

  /**
   * Get registration-specific state
   */
  getRegistrationState(phoneNumber: string): RegistrationState | null {
    const state = this.getState(phoneNumber);
    
    if (!state || !this.isRegistrationStep(state.step)) {
      return null;
    }

    return {
      step: state.step as RegistrationState['step'],
      type: state.data.type,
      phoneNumber: state.data.phoneNumber,
      businessCode: state.data.businessCode,
      businessName: state.data.businessName,
      employeeName: state.data.employeeName,
      ownerName: state.data.ownerName,
      role: state.data.role,
      data: state.data,
    };
  }

  /**
   * Set registration-specific state
   */
  setRegistrationState(phoneNumber: string, registrationState: Partial<RegistrationState>): void {
    const { step, ...data } = registrationState;
    
    if (step) {
      // Get existing state to preserve data
      const existingState = this.getState(phoneNumber);
      const existingData = existingState?.data || {};
      
      // Merge existing data with new data
      const mergedData = { ...existingData, ...data };
      
      this.setState(phoneNumber, step, mergedData);
    } else {
      // If no step provided, update existing state
      this.updateState(phoneNumber, data);
    }
  }

  /**
   * Get all active conversation count (for monitoring)
   */
  getActiveConversationCount(): number {
    // Clean up expired states first
    this.cleanupExpiredStates();
    return this.states.size;
  }

  /**
   * Check if a step is part of registration flow
   */
  private isRegistrationStep(step: string): boolean {
    const registrationSteps = [
      'type_selection',
      'phone_verification', 
      'business_info',
      'owner_name',
      'employee_info',
      'role_selection',
      'merchant_onboarding_start',
      'merchant_business_name',
      'merchant_owner_name',
      'merchant_confirmation'
    ];
    return registrationSteps.includes(step);
  }

  /**
   * Check if a conversation state has expired
   */
  isStateExpired(phoneNumber: string): boolean {
    const state = this.states.get(phoneNumber);
    if (!state) return false;
    
    return new Date() > state.expiresAt;
  }

  /**
   * Get timeout notification message for a user
   */
  getTimeoutNotificationMessage(phoneNumber: string, warningType: 'first' | 'final' | 'expired'): string | null {
    const state = this.getState(phoneNumber);
    if (!state || !this.isRegistrationStep(state.step)) {
      return null;
    }

    const stepName = this.getStepDisplayName(state.step);
    
    switch (warningType) {
      case 'first':
        return `⏰ **Attention - Session bientôt expirée**\n\n` +
               `Vous êtes en cours d'inscription (étape: ${stepName}).\n` +
               `Votre session expirera dans 5 minutes d'inactivité.\n\n` +
               `💡 **Pour continuer :**\n` +
               `• Répondez à la question en cours\n` +
               `• Ou tapez 'aide' pour voir les instructions\n\n` +
               `⚠️ Si vous ne répondez pas, vous devrez recommencer l'inscription.`;

      case 'final':
        return `🚨 **URGENT - Session expire dans 2 minutes !**\n\n` +
               `Votre inscription (étape: ${stepName}) va bientôt expirer.\n\n` +
               `⚡ **Action requise MAINTENANT :**\n` +
               `• Répondez à la question en cours\n` +
               `• Ou tapez 'continuer' pour prolonger\n\n` +
               `❌ Sans réponse, vous devrez tout recommencer !`;

      case 'expired':
        return `❌ **Session d'inscription expirée**\n\n` +
               `Votre inscription a expiré après 30 minutes d'inactivité.\n` +
               `Vous étiez à l'étape: ${stepName}\n\n` +
               `🔄 **Pour recommencer :**\n` +
               `Tapez 'bonjour' ou 'inscription' pour relancer le processus.\n\n` +
               `💡 **Conseil :** Préparez vos informations à l'avance pour aller plus vite !`;

      default:
        return null;
    }
  }

  /**
   * Check for conversations that need timeout warnings
   */
  private checkForTimeoutWarnings(): void {
    const now = new Date();

    for (const [phoneNumber, state] of this.states.entries()) {
      if (!this.isRegistrationStep(state.step)) {
        continue;
      }

      const timeSinceCreation = now.getTime() - state.createdAt.getTime();
      const warningsSent = state.timeoutWarningsSent || 0;

      // Send first warning at 25 minutes
      if (timeSinceCreation >= this.WARNING_TIME_MS && warningsSent === 0) {
        this.sendTimeoutWarning(phoneNumber, 'first');
        state.timeoutWarningsSent = 1;
        this.states.set(phoneNumber, state);
      }
      // Send final warning at 28 minutes
      else if (timeSinceCreation >= this.FINAL_WARNING_TIME_MS && warningsSent === 1) {
        this.sendTimeoutWarning(phoneNumber, 'final');
        state.timeoutWarningsSent = 2;
        this.states.set(phoneNumber, state);
      }
    }
  }

  /**
   * Send timeout warning to user (this would integrate with WhatsApp service)
   */
  private sendTimeoutWarning(phoneNumber: string, warningType: 'first' | 'final'): void {
    const message = this.getTimeoutNotificationMessage(phoneNumber, warningType);
    if (message) {
      this.logger.debug(`Timeout warning (${warningType}) for ${phoneNumber}`);
      // In a real implementation, this would send the message via WhatsApp service
      // For now, we just log it - the actual sending would be handled by the bot controller
    }
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
      'role_selection': 'Choix du rôle',
      'merchant_onboarding_start': 'Début onboarding marchand',
      'merchant_business_name': 'Nom de l\'entreprise',
      'merchant_owner_name': 'Nom du propriétaire',
      'merchant_confirmation': 'Confirmation création'
    };
    return stepNames[step] || step;
  }

  /**
   * Handle user attempting to continue after timeout warning
   */
  extendSession(phoneNumber: string): boolean {
    const state = this.getState(phoneNumber);
    if (!state) {
      return false;
    }

    // Extend the session by resetting expiration time
    const now = new Date();
    state.expiresAt = new Date(now.getTime() + this.EXPIRATION_TIME_MS);
    state.lastActivityAt = now;
    state.timeoutWarningsSent = 0;
    
    this.states.set(phoneNumber, state);
    this.logger.debug(`Session extended for ${phoneNumber}`);
    return true;
  }

  /**
   * Clean up expired conversation states and send expiration notifications
   */
  private cleanupExpiredStates(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [phoneNumber, state] of this.states.entries()) {
      if (now > state.expiresAt) {
        // Send expiration notification for registration flows
        if (this.isRegistrationStep(state.step)) {
          const message = this.getTimeoutNotificationMessage(phoneNumber, 'expired');
          if (message) {
            this.logger.debug(`Sending expiration notification to ${phoneNumber}`);
            // In a real implementation, this would send the message via WhatsApp service
          }
        }
        
        this.states.delete(phoneNumber);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired conversation states`);
    }
  }
}