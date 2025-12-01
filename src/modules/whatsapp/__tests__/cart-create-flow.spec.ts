import { Test, TestingModule } from '@nestjs/testing';
import { CommandParserService } from '../services/command-parser.service';
import { SaleSessionService } from '../services/sale-session.service';
import { CartCreateHandler } from '../handlers/cart-create-handler';

describe('Cart Create Flow', () => {
  let commandParser: CommandParserService;
  let saleSessionService: SaleSessionService;
  let cartCreateHandler: CartCreateHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandParserService,
        SaleSessionService,
        CartCreateHandler,
      ],
    }).compile();

    commandParser = module.get<CommandParserService>(CommandParserService);
    saleSessionService = module.get<SaleSessionService>(SaleSessionService);
    cartCreateHandler = module.get<CartCreateHandler>(CartCreateHandler);
  });

  describe('Command Parsing - New Flow', () => {
    it('should parse cart create commands correctly', () => {
      const testCases = [
        'nouveau panier',
        'créer panier',
        'new cart',
        'create cart'
      ];

      testCases.forEach(input => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe('cart_create');
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });
    
    it('should parse cart view commands correctly', () => {
      const testCases = ['panier', 'cart'];

      testCases.forEach(input => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe('cart_view');
      });
    });

    it('should parse simple product add commands', () => {
      const testCases = [
        { input: 'pain 5', product: 'pain', quantity: 5 },
        { input: 'eau 3', product: 'eau', quantity: 3 },
        { input: 'riz 2', product: 'riz', quantity: 2 },
      ];

      testCases.forEach(({ input, product, quantity }) => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe('cart_add');
        expect(result.product).toBe(product);
        expect(result.quantity).toBe(quantity);
      });
    });

    it('should parse cart view commands', () => {
      const testCases = ['voir', 'contenu', 'show', 'view'];

      testCases.forEach(input => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe('cart_view');
      });
    });

    it('should prioritize cart commands over regular commands', () => {
      // "voir" should be cart_view, not a regular command
      const result = commandParser.parseMessage('voir');
      expect(result.type).toBe('cart_view');
    });
  });

  describe('Cart Creation Logic', () => {
    const phoneNumber = '+1234567890';
    const userContext = {
      userId: 'user-123',
      businessId: 'business-456',
      businessName: 'Test Business',
      isAuthenticated: true,
      role: 'owner' as const
    };

    beforeEach(() => {
      // Clean up any existing sessions
      saleSessionService.endSession(phoneNumber);
    });

    it('should create new cart when none exists', async () => {
      const result = await cartCreateHandler.handleCartCreate(phoneNumber, {}, userContext);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Panier créé et prêt');
      expect(result.data?.session).toBeDefined();
      
      const session = saleSessionService.getCurrentSession(phoneNumber);
      expect(session).toBeTruthy();
      expect(session!.items).toHaveLength(0);
    });

    it('should handle existing empty cart', async () => {
      // Create empty cart first
      saleSessionService.startSession(phoneNumber, userContext.businessId, userContext.userId);
      
      const result = await cartCreateHandler.handleCartCreate(phoneNumber, {}, userContext);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Vous avez déjà un panier vide');
    });

    it('should handle existing cart with items', async () => {
      // Create cart with items
      const session = saleSessionService.startSession(phoneNumber, userContext.businessId, userContext.userId);
      saleSessionService.addItem(phoneNumber, {
        product: 'pain',
        quantity: 5,
        unitPrice: 250,
        totalPrice: 1250
      });
      
      const result = await cartCreateHandler.handleCartCreate(phoneNumber, {}, userContext);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Vous avez déjà un panier actif avec 1 produit(s)');
      expect(result.message).toContain('finaliser');
      expect(result.message).toContain('annuler');
    });
  });

  describe('Command Validation', () => {
    it('should validate cart commands correctly', () => {
      const testCases = [
        { command: { type: 'cart_create' }, shouldBeValid: true },
        { command: { type: 'cart_add', product: 'pain', quantity: 5 }, shouldBeValid: true },
        { command: { type: 'cart_add', product: 'pain' }, shouldBeValid: false }, // missing quantity
        { command: { type: 'cart_add', quantity: 5 }, shouldBeValid: false }, // missing product
        { command: { type: 'cart_remove', product: 'pain' }, shouldBeValid: true },
        { command: { type: 'cart_remove' }, shouldBeValid: false }, // missing product
        { command: { type: 'cart_view' }, shouldBeValid: true },
        { command: { type: 'cart_finalize' }, shouldBeValid: true },
        { command: { type: 'cart_cancel' }, shouldBeValid: true },
      ];

      testCases.forEach(({ command, shouldBeValid }) => {
        const result = commandParser.validateCommand(command as any);
        expect(result.isValid).toBe(shouldBeValid);
      });
    });
  });

  describe('Integration Flow', () => {
    const phoneNumber = '+1234567890';
    const userContext = {
      userId: 'user-123',
      businessId: 'business-456',
      businessName: 'Test Business',
      isAuthenticated: true,
      role: 'owner' as const
    };

    beforeEach(() => {
      saleSessionService.endSession(phoneNumber);
    });

    it('should handle complete cart flow', async () => {
      // 1. Create cart
      let command = commandParser.parseMessage('nouveau panier');
      expect(command.type).toBe('cart_create');
      
      let result = await cartCreateHandler.handleCartCreate(phoneNumber, command, userContext);
      expect(result.success).toBe(true);
      
      // 2. Add product (would be handled by cart add handler)
      command = commandParser.parseMessage('pain 5');
      expect(command.type).toBe('cart_add');
      expect(command.product).toBe('pain');
      expect(command.quantity).toBe(5);
      
      // 3. View cart
      command = commandParser.parseMessage('voir');
      expect(command.type).toBe('cart_view');
      
      // 4. Finalize
      command = commandParser.parseMessage('finaliser');
      expect(command.type).toBe('cart_finalize');
    });
  });
});