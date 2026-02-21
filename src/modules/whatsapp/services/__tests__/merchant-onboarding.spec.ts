import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationHandlerService } from '../registration-handler.service';
import { ConversationStateService } from '../conversation-state.service';
import { AuthService } from '../../../auth/auth.service';
import { NLPService } from '../nlp.service';
import { ConflictResolutionService } from '../conflict-resolution.service';
import { OnboardingMessagesService } from '../onboarding-messages.service';
import { StockService } from '../../../stock/stock.service';
import { ProductNormalizerService } from '../../../stock/services/product-normalizer.service';
import { UserRole } from '../../../auth/entities/user.entity';

describe('RegistrationHandlerService - Merchant Onboarding', () => {
  let service: RegistrationHandlerService;
  let conversationStateService: ConversationStateService;
  let authService: AuthService;

  const mockConversationStateService = {
    setRegistrationState: jest.fn(),
    updateState: jest.fn(),
    clearState: jest.fn(),
    getRegistrationState: jest.fn(),
    isStateExpired: jest.fn().mockReturnValue(false),
    extendSession: jest.fn().mockReturnValue(true),
    isInRegistration: jest.fn().mockReturnValue(true),
  };

  const mockAuthService = {
    registerBusinessOwner: jest.fn().mockImplementation((phoneNumber) => {
      if (phoneNumber === '+226701234567') {
        throw new Error('User with this phone number already exists.');
      }
      return Promise.resolve({
        user: { id: 'user-1', phoneNumber },
        business: { id: 'business-1', name: 'Test Business', businessCode: 'ABC123' }
      });
    }),
  };

  const mockNLPService = {
    // Add any NLP service methods if needed
  };

  const mockConflictResolutionService = {
    checkAndResolveConflict: jest.fn().mockResolvedValue({
      message: 'No conflict found',
      conflictType: 'no_conflict',
      canProceed: true,
    }),
  };

  const mockOnboardingMessagesService = {
    getSuccessConfirmationMessage: jest.fn().mockImplementation((businessDetails) => 
      `ENTREPRISE CRÉÉE AVEC SUCCÈS ${businessDetails.businessName} ${businessDetails.ownerName} ${businessDetails.businessCode}`
    ),
    getErrorMessage: jest.fn().mockImplementation((context) => {
      if (context.errorType === 'validation' && context.field === 'businessName') {
        return 'Le nom de l\'entreprise est trop court';
      }
      if (context.errorType === 'validation' && context.field === 'ownerName') {
        return 'Le nom du propriétaire est trop court';
      }
      if (context.errorType === 'conflict') {
        return 'Numéro déjà enregistré';
      }
      return 'Erreur lors de la création';
    }),
    getStepHelpMessage: jest.fn().mockReturnValue('Aide pour cette étape'),
    getCancellationMessage: jest.fn().mockReturnValue('Processus annulée'),
    getProgressMessage: jest.fn().mockReturnValue('Progression du processus'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationHandlerService,
        {
          provide: ConversationStateService,
          useValue: mockConversationStateService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: NLPService,
          useValue: mockNLPService,
        },
        {
          provide: ConflictResolutionService,
          useValue: mockConflictResolutionService,
        },
        {
          provide: OnboardingMessagesService,
          useValue: mockOnboardingMessagesService,
        },
        {
          provide: StockService,
          useValue: {
            setUnitPrice: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ProductNormalizerService,
          useValue: {
            normalize: jest.fn((p: string) => p.trim().toLowerCase()),
            cleanProductName: jest.fn((p: string) => p.trim()),
            findBestMatch: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RegistrationHandlerService>(RegistrationHandlerService);
    conversationStateService = module.get<ConversationStateService>(ConversationStateService);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Merchant Onboarding Intent Detection', () => {
    it('should detect "créer une nouvelle entreprise" intent', async () => {
      const phoneNumber = '+226701234567';
      const message = 'créer une nouvelle entreprise';

      mockConversationStateService.getRegistrationState.mockReturnValue(null);

      const result = await service.handleRegistrationMessage(phoneNumber, message);

      expect(result.completed).toBe(false);
      expect(result.nextStep).toBe('merchant_onboarding_start');
      expect(result.message).toContain('CRÉATION D\'UNE NOUVELLE ENTREPRISE');
      expect(mockConversationStateService.setRegistrationState).toHaveBeenCalledWith(
        phoneNumber,
        {
          step: 'merchant_onboarding_start',
          type: 'merchant',
          phoneNumber: phoneNumber,
        }
      );
    });

    it('should detect variations of merchant onboarding intent', async () => {
      const testCases = [
        'créer nouvelle entreprise',
        'nouvelle entreprise',
        'créer entreprise',
        'créer business',
        'nouveau business',
      ];

      for (const message of testCases) {
        mockConversationStateService.getRegistrationState.mockReturnValue(null);
        
        const result = await service.handleRegistrationMessage('+226701234567', message);
        
        expect(result.nextStep).toBe('merchant_onboarding_start');
        expect(result.message).toContain('CRÉATION D\'UNE NOUVELLE ENTREPRISE');
      }
    });
  });

  describe('Merchant Onboarding Flow', () => {
    it('should handle merchant onboarding start step', async () => {
      const phoneNumber = '+226701234567';
      const message = 'continuer';
      const state = {
        step: 'merchant_onboarding_start' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);

      const result = await service.handleRegistrationMessage(phoneNumber, message);

      expect(result.completed).toBe(false);
      expect(result.nextStep).toBe('merchant_business_name');
      expect(result.message).toContain('NOM DE L\'ENTREPRISE');
      // Service might use setRegistrationState or updateState
      expect(
        mockConversationStateService.updateState.mock.calls.length + 
        mockConversationStateService.setRegistrationState.mock.calls.length
      ).toBeGreaterThan(0);
    });

    it('should show help message when user does not provide confirmation', async () => {
      const phoneNumber = '+226701234567';
      const message = 'test';
      const state = {
        step: 'merchant_onboarding_start' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);

      const result = await service.handleRegistrationMessage(phoneNumber, message);

      expect(result.completed).toBe(false);
      expect(result.nextStep).toBe('merchant_onboarding_start');
      expect(result.message).toContain('continuer');
    });

    it('should handle business name collection', async () => {
      const phoneNumber = '+226701234567';
      const businessName = 'Boutique Fatou';
      const state = {
        step: 'merchant_business_name' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);

      const result = await service.handleRegistrationMessage(phoneNumber, businessName);

      expect(result.completed).toBe(false);
      expect(result.nextStep).toBe('merchant_owner_name');
      expect(result.message).toContain('Boutique Fatou');
      expect(result.message).toContain('NOM DU PROPRIÉTAIRE');
      // Service might use setRegistrationState or updateState
      expect(
        mockConversationStateService.updateState.mock.calls.length + 
        mockConversationStateService.setRegistrationState.mock.calls.length
      ).toBeGreaterThan(0);
    });

    it('should handle owner name collection', async () => {
      const phoneNumber = '+226701234567';
      const ownerName = 'Fabrice Ilboudo';
      const businessName = 'Boutique Fatou';
      const state = {
        step: 'merchant_owner_name' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
        businessName: businessName,
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);

      const result = await service.handleRegistrationMessage(phoneNumber, ownerName);

      expect(result.completed).toBe(false);
      expect(result.nextStep).toBe('merchant_confirmation');
      expect(result.message).toContain('CONFIRMATION DES INFORMATIONS');
      expect(result.message).toContain(businessName);
      expect(result.message).toContain(ownerName);
      // Service might use setRegistrationState or updateState
      expect(
        mockConversationStateService.updateState.mock.calls.length + 
        mockConversationStateService.setRegistrationState.mock.calls.length
      ).toBeGreaterThan(0);
    });

    it('should handle merchant confirmation and create business', async () => {
      const phoneNumber = '+226701234567';
      const message = 'confirmer';
      const businessName = 'Boutique Fatou';
      const ownerName = 'Fabrice Ilboudo';
      const state = {
        step: 'merchant_confirmation' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
        businessName: businessName,
        ownerName: ownerName,
      };

      const mockUser = {
        id: '123',
        phoneNumber: phoneNumber,
        business: { businessCode: 'ABC123' },
      };

      const mockRegistrationResult = {
        user: mockUser,
        accessToken: 'mock-token',
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);
      mockAuthService.registerBusinessOwner.mockResolvedValue(mockRegistrationResult);

      const result = await service.handleRegistrationMessage(phoneNumber, message);

      expect(result.completed).toBe(true);
      expect(result.nextStep).toBe('completed');
      expect(result.message.toLowerCase()).toContain('créée avec succès');
      expect(result.message).toContain(businessName);
      expect(result.message).toContain(ownerName);
      expect(result.message).toContain('ABC123');
      
      expect(mockAuthService.registerBusinessOwner).toHaveBeenCalledWith({
        phoneNumber: phoneNumber,
        businessName: businessName,
        role: UserRole.OWNER,
        language: 'fr',
      });
      
      expect(mockConversationStateService.clearState).toHaveBeenCalledWith(phoneNumber);
    });
  });

  describe('Input Validation', () => {
    it('should reject business name that is too short', async () => {
      const phoneNumber = '+226701234567';
      const shortName = 'A';
      const state = {
        step: 'merchant_business_name' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);

      const result = await service.handleRegistrationMessage(phoneNumber, shortName);

      expect(result.completed).toBe(false);
      expect(result.nextStep).toBe('merchant_business_name');
      expect(result.message).toContain('trop court');
    });

    it('should reject owner name that is too short', async () => {
      const phoneNumber = '+226701234567';
      const shortName = 'A';
      const state = {
        step: 'merchant_owner_name' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
        businessName: 'Boutique Fatou',
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);

      const result = await service.handleRegistrationMessage(phoneNumber, shortName);

      expect(result.completed).toBe(false);
      expect(result.nextStep).toBe('merchant_owner_name');
      expect(result.message).toContain('trop court');
    });
  });

  describe('Error Handling', () => {
    it('should handle registration errors gracefully', async () => {
      const phoneNumber = '+226701234567';
      const message = 'confirmer';
      const state = {
        step: 'merchant_confirmation' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
        businessName: 'Boutique Fatou',
        ownerName: 'Fabrice Ilboudo',
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);
      mockAuthService.registerBusinessOwner.mockRejectedValue(
        new Error('User with this phone number already exists.')
      );

      const result = await service.handleRegistrationMessage(phoneNumber, message);

      expect(result.completed).toBe(true);
      expect(result.nextStep).toBe('error');
      expect(result.message).toContain('Numéro déjà enregistré');
    });
  });

  describe('Help and Cancel', () => {
    it('should provide help at any step', async () => {
      const phoneNumber = '+226701234567';
      const message = 'aide';
      const state = {
        step: 'merchant_business_name' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);

      const result = await service.handleRegistrationMessage(phoneNumber, message);

      expect(result.completed).toBe(false);
      expect(result.nextStep).toBe('merchant_business_name');
      expect(result.message).toContain('Aide');
    });

    it('should allow cancellation at any step', async () => {
      const phoneNumber = '+226701234567';
      const message = 'stop';
      const state = {
        step: 'merchant_business_name' as const,
        type: 'merchant' as const,
        phoneNumber: phoneNumber,
      };

      mockConversationStateService.getRegistrationState.mockReturnValue(state);

      const result = await service.handleRegistrationMessage(phoneNumber, message);

      expect(result.completed).toBe(true);
      expect(result.nextStep).toBe('cancelled');
      expect(result.message).toContain('annulée');
      expect(mockConversationStateService.clearState).toHaveBeenCalledWith(phoneNumber);
    });
  });
});