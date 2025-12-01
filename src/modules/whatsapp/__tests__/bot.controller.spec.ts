import { Test, TestingModule } from '@nestjs/testing';
import { BotController } from '../bot.controller';
import { NLPService } from '../services/nlp.service';
import { AuthService } from '../../auth/auth.service';
import { TransactionService } from '../../transaction/transaction.service';
import { StockService } from '../../stock/stock.service';
import { ReportService } from '../../report/report.service';
import { WhatsappService } from '../whatsapp.service';
import { TwilioWhatsAppService } from '../services/twilio-whatsapp.service';
import { RegistrationHandlerService } from '../services/registration-handler.service';
import { OnboardingCheckMiddleware } from '../middleware/onboarding-check.middleware';
import { HelpService } from '../services/help.service';
import { UnitCommandHandler } from '../services/unit-command-handler.service';
import { ConfirmationStateService } from '../services/confirmation-state.service';
import { SaleSessionService } from '../services/sale-session.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { CartCreateHandler } from '../handlers/cart-create-handler';
import { CartHandlers } from '../handlers/cart-handlers';
import { ProcessedMessage } from '../interfaces/webhook.interface';
import { TransactionType } from '../../transaction/entities/transaction.entity';

describe('BotController', () => {
  let controller: BotController;
  let testingModule: TestingModule;
  let nlpService: jest.Mocked<NLPService>;
  let authService: jest.Mocked<AuthService>;
  let transactionService: jest.Mocked<TransactionService>;
  let stockService: jest.Mocked<StockService>;
  let reportService: jest.Mocked<ReportService>;
  let whatsappService: jest.Mocked<WhatsappService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotController,
        {
          provide: NLPService,
          useValue: {
            processMessage: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getUserByPhone: jest.fn(),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            recordTransaction: jest.fn(),
          },
        },
        {
          provide: StockService,
          useValue: {
            decrementStock: jest.fn(),
            getStockLevel: jest.fn(),
            updateStock: jest.fn(),
            getStock: jest.fn(),
          },
        },
        {
          provide: ReportService,
          useValue: {
            generateBalanceReport: jest.fn(),
            generateAndSendPDFReport: jest.fn(),
          },
        },
        {
          provide: WhatsappService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
        {
          provide: TwilioWhatsAppService,
          useValue: {
            sendMessage: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RegistrationHandlerService,
          useValue: {
            handleRegistrationMessage: jest.fn(),
            isInRegistrationFlow: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: OnboardingCheckMiddleware,
          useValue: {
            checkUserOnboardingStatus: jest.fn(),
            interceptMessage: jest.fn().mockResolvedValue({ shouldProcess: true }),
          },
        },
        {
          provide: HelpService,
          useValue: {
            getHelpMessage: jest.fn(),
          },
        },
        {
          provide: UnitCommandHandler,
          useValue: {},
        },
        {
          provide: ConfirmationStateService,
          useValue: {},
        },
        {
          provide: SaleSessionService,
          useValue: {},
        },
        {
          provide: InvoiceService,
          useValue: {},
        },
        {
          provide: CartCreateHandler,
          useValue: {},
        },
        {
          provide: CartHandlers,
          useValue: {},
        },
      ],
    }).compile();

    testingModule = module;
    controller = testingModule.get<BotController>(BotController);
    nlpService = testingModule.get(NLPService);
    authService = testingModule.get(AuthService);
    transactionService = testingModule.get(TransactionService);
    stockService = testingModule.get(StockService);
    reportService = testingModule.get(ReportService);
    whatsappService = testingModule.get(WhatsappService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('processMessage', () => {
    const mockMessage: ProcessedMessage = {
      messageId: 'test-message-id',
      from: '+226123456789',
      body: 'vente 1000',
      timestamp: new Date(),
    };

    const mockUser = {
      id: 'user-id',
      businessId: 'business-id',
      business: {
        id: 'business-id',
        name: 'Test Business',
      },
      language: 'fr',
      role: 'owner' as const,
      isActive: true,
      phoneNumber: '+226123456789',
    };

    it('should handle sale command successfully', async () => {
      // Mock user context
      authService.getUserByPhone.mockResolvedValue(mockUser as any);

      // Mock onboarding middleware
      const onboardingMiddleware = testingModule.get(OnboardingCheckMiddleware);
      jest.spyOn(onboardingMiddleware, 'interceptMessage').mockResolvedValue({
        shouldProcess: true,
      } as any);

      // Mock registration handler
      const registrationHandlerService = testingModule.get(RegistrationHandlerService);
      jest.spyOn(registrationHandlerService, 'isInRegistrationFlow').mockReturnValue(false);

      // Mock NLP result
      nlpService.processMessage.mockResolvedValue({
        command: {
          type: 'sale',
          amount: 1000,
          product: undefined,
          confidence: 0.9,
          originalText: 'vente 1000',
          language: 'fr',
        },
        isValid: true,
        errors: [],
        requiresAuth: false,
      });

      // Mock transaction creation
      transactionService.recordTransaction.mockResolvedValue({
        id: 'transaction-id',
        amount: 1000,
        type: TransactionType.SALE,
      } as any);

      // Mock stock service methods (called in handleSaleCommand)
      stockService.getStockLevel.mockResolvedValue(10);
      stockService.decrementStock.mockResolvedValue(true);

      // Mock WhatsApp message sending (TwilioWhatsAppService is used, not WhatsappService)
      const twilioWhatsAppService = testingModule.get(TwilioWhatsAppService);
      jest.spyOn(twilioWhatsAppService, 'sendMessage').mockResolvedValue(undefined);

      const result = await controller.processMessage(mockMessage);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Vente enregistrée');
      expect(transactionService.recordTransaction).toHaveBeenCalledWith({
        businessId: 'business-id',
        userId: 'user-id',
        type: TransactionType.SALE,
        amount: 1000,
        product: undefined,
        description: undefined,
      });
      expect(twilioWhatsAppService.sendMessage).toHaveBeenCalled();
    });

    it('should handle unauthenticated user', async () => {
      // Mock no user found
      authService.getUserByPhone.mockResolvedValue(null);

      // Mock registration handler to return not_registration (so it goes to handleAuthenticationRequired)
      const registrationHandlerService = testingModule.get(RegistrationHandlerService);
      jest.spyOn(registrationHandlerService, 'handleRegistrationMessage').mockResolvedValue({
        message: '',
        completed: false,
        nextStep: 'not_registration',
      } as any);
      jest.spyOn(registrationHandlerService, 'isInRegistrationFlow').mockReturnValue(false);

      // Mock onboarding middleware
      const onboardingMiddleware = testingModule.get(OnboardingCheckMiddleware);
      jest.spyOn(onboardingMiddleware, 'interceptMessage').mockResolvedValue({
        shouldProcess: true,
      } as any);

      const result = await controller.processMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.requiresAuth).toBe(true);
      expect(result.message).toContain('Bienvenue');
    });

    it('should handle invalid commands', async () => {
      // Mock user context
      authService.getUserByPhone.mockResolvedValue(mockUser as any);

      // Mock onboarding middleware
      const onboardingMiddleware = testingModule.get(OnboardingCheckMiddleware);
      jest.spyOn(onboardingMiddleware, 'interceptMessage').mockResolvedValue({
        shouldProcess: true,
      } as any);

      // Mock registration handler
      const registrationHandlerService = testingModule.get(RegistrationHandlerService);
      jest.spyOn(registrationHandlerService, 'isInRegistrationFlow').mockReturnValue(false);

      // Mock invalid NLP result
      nlpService.processMessage.mockResolvedValue({
        command: {
          type: 'unknown',
          confidence: 0.1,
          originalText: 'invalid command',
          language: 'fr',
        },
        isValid: false,
        errors: ['Commande non reconnue'],
        suggestedResponse: 'Désolé, je n\'ai pas compris.',
      });

      const result = await controller.processMessage(mockMessage);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Commande non reconnue');
    });

    it('should handle service errors gracefully', async () => {
      // Mock user context
      authService.getUserByPhone.mockResolvedValue(mockUser as any);

      // Mock onboarding middleware
      const onboardingMiddleware = testingModule.get(OnboardingCheckMiddleware);
      jest.spyOn(onboardingMiddleware, 'interceptMessage').mockResolvedValue({
        shouldProcess: true,
      } as any);

      // Mock registration handler
      const registrationHandlerService = testingModule.get(RegistrationHandlerService);
      jest.spyOn(registrationHandlerService, 'isInRegistrationFlow').mockReturnValue(false);

      // Mock NLP result
      nlpService.processMessage.mockResolvedValue({
        command: {
          type: 'sale',
          amount: 1000,
          confidence: 0.9,
          originalText: 'vente 1000',
          language: 'fr',
        },
        isValid: true,
        errors: [],
        requiresAuth: false,
      });

      // Mock transaction service error
      transactionService.recordTransaction.mockRejectedValue(new Error('Database error'));

      const result = await controller.processMessage(mockMessage);

      expect(result.success).toBe(false);
      // The error is caught and returns a specific error message
      expect(result.message.toLowerCase()).toContain('erreur');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      // Mock service calls for health check
      authService.getUserByPhone.mockResolvedValue(null);
      stockService.getStock.mockResolvedValue([]);

      const result = await controller.healthCheck();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('timestamp');
      expect(result.services).toHaveProperty('nlp');
      expect(result.services).toHaveProperty('auth');
      expect(result.services).toHaveProperty('transaction');
      expect(result.services).toHaveProperty('stock');
      expect(result.services).toHaveProperty('report');
      expect(result.services).toHaveProperty('whatsapp');
    });
  });
});