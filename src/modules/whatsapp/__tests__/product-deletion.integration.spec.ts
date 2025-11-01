import { Test, TestingModule } from '@nestjs/testing';
import { BotController } from '../bot.controller';
import { CommandParserService } from '../services/command-parser.service';
import { ConfirmationStateService } from '../services/confirmation-state.service';
import { StockService } from '../../stock/stock.service';

describe('Product Deletion Integration', () => {
  let commandParser: CommandParserService;
  let confirmationService: ConfirmationStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandParserService,
        ConfirmationStateService,
      ],
    }).compile();

    commandParser = module.get<CommandParserService>(CommandParserService);
    confirmationService = module.get<ConfirmationStateService>(ConfirmationStateService);
  });

  describe('Command Parsing', () => {
    it('should parse product delete command correctly', () => {
      const result = commandParser.parseMessage('supprimer pain');
      
      expect(result.type).toBe('product_delete');
      expect(result.product).toBe('pain');
    });

    it('should parse different delete command formats', () => {
      const testCases = [
        { input: 'supprimer pain', expected: 'pain' },
        { input: 'delete biscuit', expected: 'biscuit' },
        { input: 'effacer chocolat', expected: 'chocolat' },
        { input: 'remove eau', expected: 'eau' },
        { input: 'supprimer produit lait', expected: 'lait' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe('product_delete');
        expect(result.product).toBe(expected);
      });
    });

    it('should parse confirmation commands correctly', () => {
      const testCases = ['confirmer', 'confirm', 'oui', 'yes', 'ok'];

      testCases.forEach(input => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe('confirm_delete');
      });
    });
  });

  describe('Confirmation State Management', () => {
    const phoneNumber = '+1234567890';
    const mockConfirmation = {
      type: 'product_delete' as const,
      data: {
        product: 'pain',
        businessId: 'business-123',
        userId: 'user-456'
      },
      timestamp: new Date()
    };

    it('should set and get pending confirmation', () => {
      confirmationService.setPendingConfirmation(phoneNumber, mockConfirmation);
      
      const retrieved = confirmationService.getPendingConfirmation(phoneNumber);
      expect(retrieved).toEqual(mockConfirmation);
    });

    it('should check if user has pending confirmation', () => {
      expect(confirmationService.hasPendingConfirmation(phoneNumber)).toBe(false);
      
      confirmationService.setPendingConfirmation(phoneNumber, mockConfirmation);
      expect(confirmationService.hasPendingConfirmation(phoneNumber)).toBe(true);
    });

    it('should clear pending confirmation', () => {
      confirmationService.setPendingConfirmation(phoneNumber, mockConfirmation);
      expect(confirmationService.hasPendingConfirmation(phoneNumber)).toBe(true);
      
      confirmationService.clearPendingConfirmation(phoneNumber);
      expect(confirmationService.hasPendingConfirmation(phoneNumber)).toBe(false);
    });

    it('should detect expired confirmations', () => {
      const expiredConfirmation = {
        ...mockConfirmation,
        timestamp: new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
      };
      
      confirmationService.setPendingConfirmation(phoneNumber, expiredConfirmation);
      expect(confirmationService.isConfirmationExpired(phoneNumber)).toBe(true);
    });

    it('should detect non-expired confirmations', () => {
      const recentConfirmation = {
        ...mockConfirmation,
        timestamp: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
      };
      
      confirmationService.setPendingConfirmation(phoneNumber, recentConfirmation);
      expect(confirmationService.isConfirmationExpired(phoneNumber)).toBe(false);
    });
  });

  describe('Command Validation', () => {
    it('should validate product delete command', () => {
      const validCommand = {
        type: 'product_delete' as const,
        product: 'pain',
        confidence: 0.9,
        originalText: 'supprimer pain',
        language: 'fr'
      };

      const result = commandParser.validateCommand(validCommand);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should invalidate product delete command without product', () => {
      const invalidCommand = {
        type: 'product_delete' as const,
        confidence: 0.9,
        originalText: 'supprimer',
        language: 'fr'
      };

      const result = commandParser.validateCommand(invalidCommand);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Le nom du produit à supprimer est requis');
    });

    it('should validate confirm delete command', () => {
      const validCommand = {
        type: 'confirm_delete' as const,
        confidence: 0.9,
        originalText: 'confirmer',
        language: 'fr'
      };

      const result = commandParser.validateCommand(validCommand);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});