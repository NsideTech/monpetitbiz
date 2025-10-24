import { Test, TestingModule } from '@nestjs/testing';
import { NLPService, UserContext } from '../nlp.service';
import { CommandParserService } from '../command-parser.service';
import { ConversationStateService } from '../conversation-state.service';
import { ProcessedMessage } from '../../interfaces/webhook.interface';

describe('NLPService', () => {
  let service: NLPService;
  let commandParserService: CommandParserService;

  const mockConversationStateService = {
    isInRegistration: jest.fn().mockReturnValue(false),
    getRegistrationState: jest.fn().mockReturnValue(null),
  };

  const mockCommandParserService = {
    parseMessage: jest.fn().mockReturnValue({
      type: 'sale',
      amount: 1000,
      product: 'pain',
      confidence: 0.9,
    }),
    validateCommand: jest.fn().mockReturnValue({
      isValid: true,
      errors: [],
    }),
    getHelpMessage: jest.fn().mockReturnValue('Aide disponible'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NLPService,
        {
          provide: CommandParserService,
          useValue: mockCommandParserService,
        },
        {
          provide: ConversationStateService,
          useValue: mockConversationStateService,
        },
      ],
    }).compile();

    service = module.get<NLPService>(NLPService);
    commandParserService = module.get<CommandParserService>(CommandParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processMessage', () => {
    const mockMessage: ProcessedMessage = {
      messageId: 'msg_123',
      from: '221771234567',
      body: 'vente 1000 pain',
      timestamp: new Date(),
    };

    it('should process a valid sale message for authenticated user', async () => {
      const userContext: UserContext = {
        userId: 'user_123',
        businessId: 'business_123',
        language: 'fr',
        role: 'owner',
        isAuthenticated: true,
      };

      const result = await service.processMessage(mockMessage, userContext);

      expect(result.command.type).toBe('sale');
      expect(result.command.amount).toBe(1000);
      expect(result.command.product).toBe('pain');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.requiresAuth).toBe(true);
      expect(result.suggestedResponse).toContain('Vente enregistrée');
    });

    it('should reject sale message for unauthenticated user', async () => {
      const userContext: UserContext = {
        isAuthenticated: false,
      };

      const result = await service.processMessage(mockMessage, userContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Authentification requise');
      expect(result.requiresAuth).toBe(true);
    });

    it('should reject expense message for seller role', async () => {
      const expenseMessage: ProcessedMessage = {
        ...mockMessage,
        body: 'dépense 500 transport',
      };

      const userContext: UserContext = {
        userId: 'user_123',
        businessId: 'business_123',
        role: 'seller',
        isAuthenticated: true,
      };

      const result = await service.processMessage(expenseMessage, userContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Action réservée au propriétaire');
    });

    it('should allow expense message for owner role', async () => {
      const expenseMessage: ProcessedMessage = {
        ...mockMessage,
        body: 'dépense 500 transport',
      };

      const userContext: UserContext = {
        userId: 'user_123',
        businessId: 'business_123',
        role: 'owner',
        isAuthenticated: true,
      };

      const result = await service.processMessage(expenseMessage, userContext);

      expect(result.command.type).toBe('expense');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow stock operations for seller role', async () => {
      const stockMessage: ProcessedMessage = {
        ...mockMessage,
        body: 'stock pain 50',
      };

      const userContext: UserContext = {
        userId: 'user_123',
        businessId: 'business_123',
        role: 'seller',
        isAuthenticated: true,
      };

      const result = await service.processMessage(stockMessage, userContext);

      expect(result.command.type).toBe('stock');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should provide help message for unknown commands', async () => {
      const unknownMessage: ProcessedMessage = {
        ...mockMessage,
        body: 'hello world',
      };

      const userContext: UserContext = {
        isAuthenticated: false,
      };

      const result = await service.processMessage(unknownMessage, userContext);

      expect(result.command.type).toBe('unknown');
      expect(result.isValid).toBe(false);
      expect(result.suggestedResponse).toContain('Désolé, je n\'ai pas compris');
    });

    it('should handle processing errors gracefully', async () => {
      // Mock commandParser to throw an error
      jest.spyOn(commandParserService, 'parseMessage').mockImplementation(() => {
        throw new Error('Parsing error');
      });

      const result = await service.processMessage(mockMessage, { isAuthenticated: false });

      expect(result.command.type).toBe('unknown');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Erreur lors du traitement du message');
    });

    it('should use user language preference', async () => {
      const userContext: UserContext = {
        userId: 'user_123',
        businessId: 'business_123',
        language: 'wo',
        role: 'owner',
        isAuthenticated: true,
      };

      const result = await service.processMessage(mockMessage, userContext);

      expect(result.command.language).toBe('wo');
    });
  });

  describe('extractBusinessContext', () => {
    it('should extract retail business type', () => {
      const message: ProcessedMessage = {
        messageId: 'msg_123',
        from: '221771234567',
        body: 'Je tiens une boutique de vêtements',
        timestamp: new Date(),
      };

      const context = service.extractBusinessContext(message);

      expect(context.businessType).toBe('retail');
    });

    it('should extract restaurant business type', () => {
      const message: ProcessedMessage = {
        messageId: 'msg_123',
        from: '221771234567',
        body: 'Mon restaurant sert de la cuisine locale',
        timestamp: new Date(),
      };

      const context = service.extractBusinessContext(message);

      expect(context.businessType).toBe('restaurant');
    });

    it('should extract beauty business type', () => {
      const message: ProcessedMessage = {
        messageId: 'msg_123',
        from: '221771234567',
        body: 'Je travaille dans un salon de coiffure',
        timestamp: new Date(),
      };

      const context = service.extractBusinessContext(message);

      expect(context.businessType).toBe('beauty');
    });

    it('should return empty context for unrecognized business type', () => {
      const message: ProcessedMessage = {
        messageId: 'msg_123',
        from: '221771234567',
        body: 'vente 1000',
        timestamp: new Date(),
      };

      const context = service.extractBusinessContext(message);

      expect(context.businessType).toBeUndefined();
    });
  });

  describe('getCommandStats', () => {
    it('should calculate correct statistics', () => {
      const commands = [
        {
          type: 'sale',
          confidence: 0.9,
          language: 'fr',
          originalText: 'vente 1000',
        },
        {
          type: 'sale',
          confidence: 0.8,
          language: 'fr',
          originalText: 'vente 2000',
        },
        {
          type: 'expense',
          confidence: 0.7,
          language: 'wo',
          originalText: 'jënd 500',
        },
        {
          type: 'unknown',
          confidence: 0.1,
          language: 'fr',
          originalText: 'hello',
        },
      ] as any[];

      const stats = service.getCommandStats(commands);

      expect(stats.totalCommands).toBe(4);
      expect(stats.commandTypes.sale).toBe(2);
      expect(stats.commandTypes.expense).toBe(1);
      expect(stats.commandTypes.unknown).toBe(1);
      expect(stats.averageConfidence).toBeCloseTo(0.625);
      expect(stats.languageDistribution.fr).toBe(3);
      expect(stats.languageDistribution.wo).toBe(1);
      expect(stats.validCommands).toBe(3); // confidence > 0.5
    });

    it('should handle empty command array', () => {
      const stats = service.getCommandStats([]);

      expect(stats.totalCommands).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.validCommands).toBe(0);
    });
  });

  describe('suggestImprovements', () => {
    it('should suggest amount for low-confidence sale command', () => {
      const command = {
        type: 'sale',
        confidence: 0.3,
        originalText: 'vente',
        language: 'fr',
      } as any;

      const suggestions = service.suggestImprovements(command);

      expect(suggestions).toContain('Précisez le montant (ex: "vente 1000")');
    });

    it('should suggest product for low-confidence sale command', () => {
      const command = {
        type: 'sale',
        amount: 1000,
        confidence: 0.3,
        originalText: 'vente 1000',
        language: 'fr',
      } as any;

      const suggestions = service.suggestImprovements(command);

      expect(suggestions).toContain('Ajoutez une description (ex: "vente pain 1000")');
    });

    it('should suggest product name for stock command', () => {
      const command = {
        type: 'stock',
        confidence: 0.3,
        originalText: 'stock',
        language: 'fr',
      } as any;

      const suggestions = service.suggestImprovements(command);

      expect(suggestions).toContain('Précisez le nom du produit');
    });

    it('should suggest keywords for unknown commands', () => {
      const command = {
        type: 'unknown',
        confidence: 0.1,
        originalText: 'hello',
        language: 'fr',
      } as any;

      const suggestions = service.suggestImprovements(command);

      expect(suggestions).toContain('Utilisez des mots-clés comme "vente", "dépense", "stock", "bilan"');
    });

    it('should return empty suggestions for high-confidence commands', () => {
      const command = {
        type: 'sale',
        amount: 1000,
        product: 'pain',
        confidence: 0.9,
        originalText: 'vente 1000 pain',
        language: 'fr',
      } as any;

      const suggestions = service.suggestImprovements(command);

      expect(suggestions).toHaveLength(0);
    });
  });
});