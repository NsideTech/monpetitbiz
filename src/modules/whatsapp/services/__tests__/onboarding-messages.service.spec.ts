import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingMessagesService, BusinessDetails, ErrorContext, ProgressContext } from '../onboarding-messages.service';

describe('OnboardingMessagesService', () => {
  let service: OnboardingMessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingMessagesService],
    }).compile();

    service = module.get<OnboardingMessagesService>(OnboardingMessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSuccessConfirmationMessage', () => {
    it('should generate success message with business details', () => {
      const businessDetails: BusinessDetails = {
        businessName: 'Boutique Fatou',
        ownerName: 'Fabrice Ilboudo',
        businessCode: 'ABC123',
        phoneNumber: '+226701234567',
        country: 'SN'
      };

      const message = service.getSuccessConfirmationMessage(businessDetails);

      expect(message).toContain('🎉');
      expect(message).toContain('Félicitations');
      expect(message).toContain('Boutique Fatou');
      expect(message).toContain('Fabrice Ilboudo');
      expect(message).toContain('ABC123');
      expect(message).toContain('vente');
      expect(message).toContain('stock');
      expect(message).toContain('rapport');
    });

    it('should include business code twice for emphasis', () => {
      const businessDetails: BusinessDetails = {
        businessName: 'Test Business',
        ownerName: 'Test Owner',
        businessCode: 'TEST01'
      };

      const message = service.getSuccessConfirmationMessage(businessDetails);
      
      // Should appear at least twice (in details and in instructions)
      const matches = message.match(/TEST01/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getErrorMessage', () => {
    it('should generate validation error for business name', () => {
      const context: ErrorContext = {
        errorType: 'validation',
        field: 'businessName',
        attemptCount: 1,
        maxAttempts: 3,
        details: 'Nom trop court'
      };

      const message = service.getErrorMessage(context);

      expect(message).toContain('❌');
      expect(message).toContain('entreprise invalide');
      expect(message).toContain('Entre 2 et 100 caractères');
      expect(message).toContain('Boutique Fatou');
      expect(message).toContain('Tentative 1/3');
    });

    it('should generate validation error for owner name', () => {
      const context: ErrorContext = {
        errorType: 'validation',
        field: 'ownerName',
        attemptCount: 2,
        maxAttempts: 3
      };

      const message = service.getErrorMessage(context);

      expect(message).toContain('❌');
      expect(message).toContain('propriétaire invalide');
      expect(message).toContain('Fabrice Ilboudo');
      expect(message).toContain('Tentative 2/3');
    });

    it('should generate max attempts reached message', () => {
      const context: ErrorContext = {
        errorType: 'validation',
        field: 'businessName',
        attemptCount: 3,
        maxAttempts: 3
      };

      const message = service.getErrorMessage(context);

      expect(message).toContain('Limite d\'essais atteinte');
      expect(message).toContain('3/3');
      expect(message).toContain('créer une nouvelle entreprise');
    });

    it('should generate conflict error for existing owner', () => {
      const context: ErrorContext = {
        errorType: 'conflict',
        details: 'owner_exists'
      };

      const message = service.getErrorMessage(context);

      expect(message).toContain('❌');
      expect(message).toContain('déjà enregistré comme propriétaire');
      expect(message).toContain('Options disponibles');
    });

    it('should generate conflict error for existing employee', () => {
      const context: ErrorContext = {
        errorType: 'conflict',
        details: 'employee_exists'
      };

      const message = service.getErrorMessage(context);

      expect(message).toContain('⚠️');
      expect(message).toContain('déjà enregistré comme employé');
      expect(message).toContain('1️⃣');
      expect(message).toContain('2️⃣');
    });

    it('should generate technical error message', () => {
      const context: ErrorContext = {
        errorType: 'technical',
        details: 'Database connection failed'
      };

      const message = service.getErrorMessage(context);

      expect(message).toContain('❌');
      expect(message).toContain('Erreur technique');
      expect(message).toContain('Database connection failed');
      expect(message).toContain('Réessayez dans quelques minutes');
    });

    it('should generate unauthorized error message', () => {
      const context: ErrorContext = {
        errorType: 'unauthorized'
      };

      const message = service.getErrorMessage(context);

      expect(message).toContain('🚫');
      expect(message).toContain('Accès non autorisé');
      expect(message).toContain('créer une nouvelle entreprise');
    });

    it('should generate generic error for unknown type', () => {
      const context: ErrorContext = {
        errorType: 'unknown' as any // Force unknown type
      };

      const message = service.getErrorMessage(context);

      expect(message).toContain('❌');
      expect(message).toContain('Une erreur s\'est produite');
    });
  });

  describe('getProgressMessage', () => {
    it('should generate progress message with percentage', () => {
      const context: ProgressContext = {
        currentStep: 'merchant_business_name',
        totalSteps: 4,
        stepName: 'Nom de l\'entreprise',
        completedSteps: ['merchant_onboarding_start', 'merchant_conflict_resolution']
      };

      const message = service.getProgressMessage(context);

      expect(message).toContain('📊');
      expect(message).toContain('Progression de l\'inscription');
      expect(message).toContain('50%'); // 2/4 = 50%
      expect(message).toContain('Nom de l\'entreprise');
      expect(message).toContain('2/4');
      expect(message).toContain('[█████░░░░░]'); // Progress bar
    });

    it('should generate progress bar correctly', () => {
      const context: ProgressContext = {
        currentStep: 'test',
        totalSteps: 10,
        stepName: 'Test Step',
        completedSteps: ['step1', 'step2', 'step3'] // 3 completed
      };

      const message = service.getProgressMessage(context);

      expect(message).toContain('30%'); // 3/10 = 30%
      expect(message).toContain('[███░░░░░░░]'); // 3 out of 10 filled
    });
  });

  describe('getStepHelpMessage', () => {
    it('should return help for merchant onboarding start', () => {
      const message = service.getStepHelpMessage('merchant_onboarding_start');

      expect(message).toContain('ℹ️');
      expect(message).toContain('Aide - Création d\'entreprise');
      expect(message).toContain('1️⃣');
      expect(message).toContain('2️⃣');
      expect(message).toContain('3️⃣');
      expect(message).toContain('2-3 minutes');
    });

    it('should return help for business name step', () => {
      const message = service.getStepHelpMessage('merchant_business_name');

      expect(message).toContain('Aide - Nom de l\'entreprise');
      expect(message).toContain('Boutique Fatou');
      expect(message).toContain('Restaurant Chez Amadou');
      expect(message).toContain('Entre 2 et 100 caractères');
    });

    it('should return help for owner name step', () => {
      const message = service.getStepHelpMessage('merchant_owner_name');

      expect(message).toContain('Aide - Nom du propriétaire');
      expect(message).toContain('Fabrice Ilboudo');
    });

    it('should return help for confirmation step', () => {
      const message = service.getStepHelpMessage('merchant_confirmation');

      expect(message).toContain('Aide - Confirmation');
      expect(message).toContain('confirmer');
      expect(message).toContain('modifier');
      expect(message).toContain('stop');
    });

    it('should return help for conflict resolution step', () => {
      const message = service.getStepHelpMessage('merchant_conflict_resolution');

      expect(message).toContain('Aide - Résolution de conflit');
      expect(message).toContain('1️⃣');
      expect(message).toContain('2️⃣');
      expect(message).toContain('Créer une nouvelle entreprise');
      expect(message).toContain('Rester employé uniquement');
    });

    it('should return generic help for unknown step', () => {
      const message = service.getStepHelpMessage('unknown_step');

      expect(message).toContain('Aide générale');
      expect(message).toContain('aide');
      expect(message).toContain('stop');
      expect(message).toContain('créer une nouvelle entreprise');
    });
  });

  describe('getCancellationMessage', () => {
    it('should generate cancellation message with step context', () => {
      const message = service.getCancellationMessage('merchant_business_name');

      expect(message).toContain('❌');
      expect(message).toContain('Création d\'entreprise annulée');
      expect(message).toContain('(étape: merchant_business_name)');
      expect(message).toContain('créer une nouvelle entreprise');
      expect(message).toContain('👋');
    });

    it('should generate cancellation message without step context', () => {
      const message = service.getCancellationMessage();

      expect(message).toContain('❌');
      expect(message).toContain('Création d\'entreprise annulée');
      expect(message).not.toContain('(étape:');
      expect(message).toContain('créer une nouvelle entreprise');
    });
  });

  describe('getSessionExpiredMessage', () => {
    it('should generate session expired message', () => {
      const message = service.getSessionExpiredMessage();

      expect(message).toContain('⏰');
      expect(message).toContain('Session expirée');
      expect(message).toContain('sécurité');
      expect(message).toContain('créer une nouvelle entreprise');
      expect(message).toContain('Complétez l\'inscription en une fois');
    });
  });

  describe('getRetryMessage', () => {
    it('should generate retry message with attempt count', () => {
      const message = service.getRetryMessage('création entreprise', 2);

      expect(message).toContain('🔄');
      expect(message).toContain('Nouvelle tentative suggérée');
      expect(message).toContain('création entreprise');
      expect(message).toContain('tentative 2');
      expect(message).toContain('Vérifiez votre saisie');
    });
  });
});