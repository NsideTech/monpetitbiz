import { Test, TestingModule } from '@nestjs/testing';
import { SaleSessionService } from '../services/sale-session.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { CommandParserService } from '../services/command-parser.service';

describe('Cart System Integration', () => {
  let saleSessionService: SaleSessionService;
  let invoiceService: InvoiceService;
  let commandParser: CommandParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaleSessionService,
        InvoiceService,
        CommandParserService,
      ],
    }).compile();

    saleSessionService = module.get<SaleSessionService>(SaleSessionService);
    invoiceService = module.get<InvoiceService>(InvoiceService);
    commandParser = module.get<CommandParserService>(CommandParserService);
  });

  describe('Command Parsing', () => {
    it('should parse cart add commands correctly', () => {
      const testCases = [
        { input: 'ajouter pain 5', product: 'pain', quantity: 5 },
        { input: 'add eau 3', product: 'eau', quantity: 3 },
        { input: '+ riz 2', product: 'riz', quantity: 2 },
      ];

      testCases.forEach(({ input, product, quantity }) => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe('cart_add');
        expect(result.product).toBe(product);
        expect(result.quantity).toBe(quantity);
      });
    });

    it('should parse cart remove commands correctly', () => {
      const testCases = [
        { input: 'retirer pain', product: 'pain' },
        { input: 'remove eau', product: 'eau' },
        { input: '- riz', product: 'riz' },
      ];

      testCases.forEach(({ input, product }) => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe('cart_remove');
        expect(result.product).toBe(product);
      });
    });

    it('should parse cart management commands', () => {
      const testCases = [
        { input: 'panier', type: 'cart_view' },
        { input: 'cart', type: 'cart_view' },
        { input: 'finaliser', type: 'cart_finalize' },
        { input: 'finalize', type: 'cart_finalize' },
        { input: 'annuler', type: 'cart_cancel' },
        { input: 'cancel', type: 'cart_cancel' },
      ];

      testCases.forEach(({ input, type }) => {
        const result = commandParser.parseMessage(input);
        expect(result.type).toBe(type);
      });
    });
  });

  describe('Sale Session Management', () => {
    const phoneNumber = '+1234567890';
    const businessId = 'business-123';
    const userId = 'user-456';

    beforeEach(() => {
      // Clean up any existing sessions
      saleSessionService.endSession(phoneNumber);
    });

    it('should start a new session', () => {
      const session = saleSessionService.startSession(phoneNumber, businessId, userId);
      
      expect(session.phoneNumber).toBe(phoneNumber);
      expect(session.businessId).toBe(businessId);
      expect(session.userId).toBe(userId);
      expect(session.items).toHaveLength(0);
      expect(session.totalAmount).toBe(0);
      expect(session.status).toBe('active');
    });

    it('should add items to session', () => {
      const session = saleSessionService.startSession(phoneNumber, businessId, userId);
      
      const item = {
        product: 'pain',
        quantity: 5,
        unitPrice: 250,
        totalPrice: 1250
      };

      const updatedSession = saleSessionService.addItem(phoneNumber, item);
      
      expect(updatedSession).toBeTruthy();
      expect(updatedSession!.items).toHaveLength(1);
      expect(updatedSession!.items[0].product).toBe('pain');
      expect(updatedSession!.items[0].quantity).toBe(5);
      expect(updatedSession!.totalAmount).toBe(1250);
    });

    it('should update existing item quantity when adding same product', () => {
      const session = saleSessionService.startSession(phoneNumber, businessId, userId);
      
      const item1 = {
        product: 'pain',
        quantity: 5,
        unitPrice: 250,
        totalPrice: 1250
      };

      const item2 = {
        product: 'pain',
        quantity: 3,
        unitPrice: 250,
        totalPrice: 750
      };

      saleSessionService.addItem(phoneNumber, item1);
      const updatedSession = saleSessionService.addItem(phoneNumber, item2);
      
      expect(updatedSession!.items).toHaveLength(1);
      expect(updatedSession!.items[0].quantity).toBe(8); // 5 + 3
      expect(updatedSession!.items[0].totalPrice).toBe(2000); // 8 * 250
      expect(updatedSession!.totalAmount).toBe(2000);
    });

    it('should remove items from session', () => {
      const session = saleSessionService.startSession(phoneNumber, businessId, userId);
      
      const item = {
        product: 'pain',
        quantity: 5,
        unitPrice: 250,
        totalPrice: 1250
      };

      saleSessionService.addItem(phoneNumber, item);
      const updatedSession = saleSessionService.removeItem(phoneNumber, 'pain');
      
      expect(updatedSession!.items).toHaveLength(0);
      expect(updatedSession!.totalAmount).toBe(0);
    });

    it('should complete session', () => {
      const session = saleSessionService.startSession(phoneNumber, businessId, userId);
      
      const item = {
        product: 'pain',
        quantity: 5,
        unitPrice: 250,
        totalPrice: 1250
      };

      saleSessionService.addItem(phoneNumber, item);
      const completedSession = saleSessionService.completeSession(phoneNumber);
      
      expect(completedSession!.status).toBe('completed');
      expect(saleSessionService.getCurrentSession(phoneNumber)).toBeNull();
    });

    it('should cancel session', () => {
      const session = saleSessionService.startSession(phoneNumber, businessId, userId);
      
      const item = {
        product: 'pain',
        quantity: 5,
        unitPrice: 250,
        totalPrice: 1250
      };

      saleSessionService.addItem(phoneNumber, item);
      const cancelled = saleSessionService.cancelSession(phoneNumber);
      
      expect(cancelled).toBe(true);
      expect(saleSessionService.getCurrentSession(phoneNumber)).toBeNull();
    });

    it('should generate session summary', () => {
      const session = saleSessionService.startSession(phoneNumber, businessId, userId);
      
      const item = {
        product: 'pain',
        quantity: 5,
        unitPrice: 250,
        totalPrice: 1250
      };

      saleSessionService.addItem(phoneNumber, item);
      const summary = saleSessionService.getSessionSummary(phoneNumber);
      
      expect(summary).toContain('🛒 Panier actuel:');
      expect(summary).toContain('pain');
      expect(summary).toContain('5 × 250');
      expect(summary).toContain('1 250');
      expect(summary).toContain('Total: 1 250');
    });
  });

  describe('Invoice Generation', () => {
    it('should generate invoice from session', async () => {
      const mockSession = {
        id: 'session-123',
        businessId: 'business-123',
        userId: 'user-456',
        phoneNumber: '+1234567890',
        items: [
          {
            product: 'pain',
            quantity: 5,
            unitPrice: 250,
            totalPrice: 1250
          },
          {
            product: 'eau',
            quantity: 3,
            unitPrice: 500,
            totalPrice: 1500
          }
        ],
        totalAmount: 2750,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        status: 'active' as const
      };

      const invoice = await invoiceService.generateInvoice(mockSession, 'MonPetitBiz SARL');
      
      expect(invoice.businessName).toBe('MonPetitBiz SARL');
      expect(invoice.items).toHaveLength(2);
      expect(invoice.total).toBe(2750);
      expect(invoice.invoiceNumber).toMatch(/^INV\d{8}\d{6}$/);
    });

    it('should generate invoice text', async () => {
      const mockInvoice = {
        id: 'session-123',
        businessId: 'business-123',
        businessName: 'MonPetitBiz SARL',
        customerPhone: '+1234567890',
        items: [
          {
            product: 'pain',
            quantity: 5,
            unitPrice: 250,
            totalPrice: 1250
          }
        ],
        subtotal: 1250,
        total: 1250,
        createdAt: new Date(),
        invoiceNumber: 'INV24120112345'
      };

      const invoiceText = invoiceService.generateInvoiceText(mockInvoice);
      
      expect(invoiceText).toContain('🧾 FACTURE #INV24120112345');
      expect(invoiceText).toContain('🏪 MonPetitBiz SARL');
      expect(invoiceText).toContain('pain');
      expect(invoiceText).toContain('5 × 250');
      expect(invoiceText).toContain('TOTAL: 1 250');
      expect(invoiceText).toContain('✅ Vente enregistrée avec succès');
    });
  });
});