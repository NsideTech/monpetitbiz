import { OnboardingMessagesService, BusinessDetails, ErrorContext, ProgressContext } from '../onboarding-messages.service';

describe('OnboardingMessagesService - Examples', () => {
  let service: OnboardingMessagesService;

  beforeEach(() => {
    service = new OnboardingMessagesService();
  });

  describe('Message Examples for Requirements Verification', () => {
    it('should demonstrate success confirmation message (Requirement 5.1, 5.2)', () => {
      const businessDetails: BusinessDetails = {
        businessName: 'Boutique Fatou',
        ownerName: 'Fabrice Ilboudo',
        businessCode: 'FAT123',
        phoneNumber: '+226701234567',
        country: 'SN'
      };

      const message = service.getSuccessConfirmationMessage(businessDetails);
      
      console.log('\n=== SUCCESS CONFIRMATION MESSAGE (Requirements 5.1, 5.2) ===');
      console.log(message);
      console.log('=== END SUCCESS MESSAGE ===\n');

      // Verify requirements
      expect(message).toContain('🎉'); // Celebration
      expect(message).toContain('Félicitations'); // Confirmation message
      expect(message).toContain('Boutique Fatou'); // Business details
      expect(message).toContain('Fabrice Ilboudo'); // Owner details
      expect(message).toContain('FAT123'); // Business code details
    });

    it('should demonstrate validation error message (Requirement 5.3)', () => {
      const errorContext: ErrorContext = {
        errorType: 'validation',
        field: 'businessName',
        attemptCount: 2,
        maxAttempts: 3,
        details: 'Le nom doit contenir au moins 2 caractères'
      };

      const message = service.getErrorMessage(errorContext);
      
      console.log('\n=== VALIDATION ERROR MESSAGE (Requirement 5.3) ===');
      console.log(message);
      console.log('=== END ERROR MESSAGE ===\n');

      // Verify requirement - explains reason for failure
      expect(message).toContain('❌');
      expect(message).toContain('entreprise invalide');
      expect(message).toContain('Exemples');
      expect(message).toContain('Boutique Fatou');
    });

    it('should demonstrate conflict error message (Requirement 5.3)', () => {
      const errorContext: ErrorContext = {
        errorType: 'conflict',
        details: 'owner_exists'
      };

      const message = service.getErrorMessage(errorContext);
      
      console.log('\n=== CONFLICT ERROR MESSAGE (Requirement 5.3) ===');
      console.log(message);
      console.log('=== END CONFLICT MESSAGE ===\n');

      // Verify requirement - explains reason for failure
      expect(message).toContain('❌');
      expect(message).toContain('déjà enregistré comme propriétaire');
      expect(message).toContain('Options disponibles');
    });

    it('should demonstrate progress message (Requirement 5.4)', () => {
      const progressContext: ProgressContext = {
        currentStep: 'merchant_business_name',
        totalSteps: 4,
        stepName: 'Saisie du nom de l\'entreprise',
        completedSteps: ['merchant_onboarding_start']
      };

      const message = service.getProgressMessage(progressContext);
      
      console.log('\n=== PROGRESS MESSAGE (Requirement 5.4) ===');
      console.log(message);
      console.log('=== END PROGRESS MESSAGE ===\n');

      // Verify requirement - shows onboarding progress
      expect(message).toContain('📊');
      expect(message).toContain('Progression de l\'inscription');
      expect(message).toContain('25%'); // 1/4 completed
      expect(message).toContain('[███░░░░░░░]'); // Progress bar
    });

    it('should demonstrate help messages for different steps', () => {
      const steps = [
        'merchant_onboarding_start',
        'merchant_business_name', 
        'merchant_owner_name',
        'merchant_confirmation',
        'merchant_conflict_resolution'
      ];

      steps.forEach(step => {
        const message = service.getStepHelpMessage(step);
        
        console.log(`\n=== HELP MESSAGE FOR ${step.toUpperCase()} ===`);
        console.log(message);
        console.log(`=== END HELP MESSAGE FOR ${step.toUpperCase()} ===\n`);

        expect(message).toContain('ℹ️');
        expect(message).toContain('Aide');
      });
    });

    it('should demonstrate cancellation message', () => {
      const message = service.getCancellationMessage('merchant_business_name');
      
      console.log('\n=== CANCELLATION MESSAGE ===');
      console.log(message);
      console.log('=== END CANCELLATION MESSAGE ===\n');

      expect(message).toContain('❌');
      expect(message).toContain('Création d\'entreprise annulée');
      expect(message).toContain('merchant_business_name');
    });

    it('should demonstrate session expired message', () => {
      const message = service.getSessionExpiredMessage();
      
      console.log('\n=== SESSION EXPIRED MESSAGE ===');
      console.log(message);
      console.log('=== END SESSION EXPIRED MESSAGE ===\n');

      expect(message).toContain('⏰');
      expect(message).toContain('Session expirée');
      expect(message).toContain('sécurité');
    });

    it('should demonstrate technical error message', () => {
      const errorContext: ErrorContext = {
        errorType: 'technical',
        details: 'Erreur de connexion à la base de données'
      };

      const message = service.getErrorMessage(errorContext);
      
      console.log('\n=== TECHNICAL ERROR MESSAGE ===');
      console.log(message);
      console.log('=== END TECHNICAL ERROR MESSAGE ===\n');

      expect(message).toContain('❌');
      expect(message).toContain('Erreur technique');
      expect(message).toContain('Réessayez dans quelques minutes');
    });
  });
});