import { Test, TestingModule } from '@nestjs/testing';
import { CommandParserService, ParsedCommand } from '../command-parser.service';

describe('CommandParserService', () => {
  let service: CommandParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommandParserService],
    }).compile();

    service = module.get<CommandParserService>(CommandParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseMessage', () => {
    describe('Sale commands', () => {
      it('should parse simple sale command', () => {
        const result = service.parseMessage('vente 1000');
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(1000);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse sale with product', () => {
        const result = service.parseMessage('vente 1500 pain');
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(1500);
        expect(result.product).toBe('pain');
        expect(result.confidence).toBeGreaterThan(0.8);
      });

      it('should parse natural language sale', () => {
        const result = service.parseMessage("j'ai vendu du pain à 2000");
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(2000);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse sale with CFA currency', () => {
        const result = service.parseMessage('vente 3000 CFA riz');
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(3000);
        expect(result.product).toBe('riz');
      });

      it('should parse sale with decimal amount', () => {
        const result = service.parseMessage('vente 1500,50 huile');
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(1500.5);
        expect(result.product).toBe('huile');
      });
    });

    describe('Expense commands', () => {
      it('should parse simple expense command', () => {
        const result = service.parseMessage('dépense 500');
        
        expect(result.type).toBe('expense');
        expect(result.amount).toBe(500);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse expense with description', () => {
        const result = service.parseMessage('dépense 2000 achat marchandise');
        
        expect(result.type).toBe('expense');
        expect(result.amount).toBe(2000);
        expect(result.description).toContain('achat marchandise');
      });

      it('should parse natural language expense', () => {
        const result = service.parseMessage("j'ai acheté du sucre à 1000");
        
        expect(result.type).toBe('expense');
        expect(result.amount).toBe(1000);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse expense without accent', () => {
        const result = service.parseMessage('depense 750 transport');
        
        expect(result.type).toBe('expense');
        expect(result.amount).toBe(750);
        expect(result.description).toContain('transport');
      });
    });

    describe('Stock commands', () => {
      it('should parse stock update command', () => {
        const result = service.parseMessage('stock pain 50');
        
        expect(result.type).toBe('stock');
        expect(result.stockAction).toBe('update');
        expect(result.product).toBe('pain');
        expect(result.stockQuantity).toBe(50);
      });

      it('should parse stock update with quantity first', () => {
        const result = service.parseMessage('stock 25 riz');
        
        expect(result.type).toBe('stock');
        expect(result.stockAction).toBe('update');
        expect(result.product).toBe('riz');
        expect(result.stockQuantity).toBe(25);
      });

      it('should parse stock query for specific product', () => {
        const result = service.parseMessage('stock pain');
        
        expect(result.type).toBe('stock_query');
        expect(result.stockAction).toBe('query');
        expect(result.product).toBe('pain');
      });

      it('should parse general stock query', () => {
        const result = service.parseMessage('stock');
        
        expect(result.type).toBe('stock_query');
        expect(result.stockAction).toBe('query');
        expect(result.product).toBeUndefined();
      });
    });

    describe('Balance commands', () => {
      it('should parse daily balance command', () => {
        const result = service.parseMessage('bilan jour');
        
        expect(result.type).toBe('balance');
        expect(result.period).toBe('day');
      });

      it('should parse weekly balance command', () => {
        const result = service.parseMessage('bilan semaine');
        
        expect(result.type).toBe('balance');
        expect(result.period).toBe('week');
      });

      it('should parse monthly balance command', () => {
        const result = service.parseMessage('bilan mois');
        
        expect(result.type).toBe('balance');
        expect(result.period).toBe('month');
      });

      it('should parse balance command with default period', () => {
        const result = service.parseMessage('bilan');
        
        expect(result.type).toBe('balance');
        expect(result.period).toBe('day');
      });

      it('should parse balance with alternative words', () => {
        const result = service.parseMessage("résumé aujourd'hui");
        
        expect(result.type).toBe('balance');
        expect(result.period).toBe('day');
      });
    });

    describe('Report commands', () => {
      it('should parse PDF report command', () => {
        const result = service.parseMessage('rapport PDF');
        
        expect(result.type).toBe('report');
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse report with period', () => {
        const result = service.parseMessage('rapport semaine');
        
        expect(result.type).toBe('report');
        expect(result.period).toBe('week');
      });
    });

    describe('Language detection', () => {
      it('should detect French language', () => {
        const result = service.parseMessage('vente 1000 pain');
        
        expect(result.language).toBe('fr');
      });

      // it('should handle Wolof commands', () => {
      //   const result = service.parseMessage('jaay 1000');
        
      //   expect(result.type).toBe('sale');
      //   expect(result.language).toBe('wo');
      //   expect(result.amount).toBe(1000);
      // });

      it('should use user preference language', () => {
        const result = service.parseMessage('1000', 'wo');
        
        expect(result.language).toBe('wo');
      });
    });

    describe('Product Add commands', () => {
      it('should parse simple product add without price', () => {
        const result = service.parseMessage('ajout produit pain');
        
        expect(result.type).toBe('product_add');
        expect(result.product).toBe('pain');
        expect(result.unitPrice).toBeUndefined();
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse product add with price', () => {
        const result = service.parseMessage('ajout produit fer 1000');
        
        expect(result.type).toBe('product_add');
        expect(result.product).toBe('fer');
        expect(result.unitPrice).toBe(1000);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse product add with price and CFA', () => {
        const result = service.parseMessage('ajout produit sucre 500 CFA');
        
        expect(result.type).toBe('product_add');
        expect(result.product).toBe('sucre');
        expect(result.unitPrice).toBe(500);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse product add with "prix" keyword', () => {
        const result = service.parseMessage('ajout produit riz prix 800');
        
        expect(result.type).toBe('product_add');
        expect(result.product).toBe('riz');
        expect(result.unitPrice).toBe(800);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse product add with quoted name and price', () => {
        const result = service.parseMessage('ajout produit "pain blanc" 300');
        
        expect(result.type).toBe('product_add');
        expect(result.product).toBe('pain blanc');
        expect(result.unitPrice).toBe(300);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse product add with single quotes and price', () => {
        const result = service.parseMessage("ajout produit 'ciment 50kg' 5000");
        
        expect(result.type).toBe('product_add');
        expect(result.product).toBe('ciment 50kg');
        expect(result.unitPrice).toBe(5000);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should parse ajouter as synonym', () => {
        const result = service.parseMessage('ajouter produit huile 1200');
        
        expect(result.type).toBe('product_add');
        expect(result.product).toBe('huile');
        expect(result.unitPrice).toBe(1200);
      });

      it('should parse create as synonym', () => {
        const result = service.parseMessage('create produit lait 600');
        
        expect(result.type).toBe('product_add');
        expect(result.product).toBe('lait');
        expect(result.unitPrice).toBe(600);
      });
    });

    describe('Fallback parsing', () => {
      it('should handle unrecognized commands with amount', () => {
        const result = service.parseMessage('quelque chose 1500');
        
        expect(result.type).toBe('sale'); // Default to sale when amount is present
        expect(result.amount).toBe(1500);
        expect(result.confidence).toBeLessThan(0.5);
      });

      it('should return unknown for completely unrecognized text', () => {
        const result = service.parseMessage('hello world');
        
        expect(result.type).toBe('unknown');
        expect(result.confidence).toBe(0);
      });

      it('should handle empty or whitespace messages', () => {
        const result = service.parseMessage('   ');
        
        expect(result.type).toBe('unknown');
        expect(result.confidence).toBe(0);
      });
    });

    describe('Edge cases', () => {
      it('should handle mixed case input', () => {
        const result = service.parseMessage('VENTE 1000 PAIN');
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(1000);
        expect(result.product).toBe('pain');
      });

      it('should handle extra whitespace', () => {
        const result = service.parseMessage('  vente   1000   pain  ');
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(1000);
        expect(result.product).toBe('pain');
      });

      it('should handle different apostrophe types', () => {
        // Test with curly apostrophe (which is normalized correctly)
        const result = service.parseMessage("j'ai vendu du pain à 1000");
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(1000);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should handle comma as decimal separator', () => {
        const result = service.parseMessage('vente 1000,50');
        
        expect(result.type).toBe('sale');
        expect(result.amount).toBe(1000.5);
      });
    });
  });

  describe('validateCommand', () => {
    it('should validate valid sale command', () => {
      const command: ParsedCommand = {
        type: 'sale',
        amount: 1000,
        product: 'pain',
        confidence: 0.9,
        originalText: 'vente 1000 pain',
        language: 'fr',
      };

      const result = service.validateCommand(command);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject sale command without amount', () => {
      const command: ParsedCommand = {
        type: 'sale',
        confidence: 0.9,
        originalText: 'vente pain',
        language: 'fr',
      };

      const result = service.validateCommand(command);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Le montant doit être un nombre positif');
    });

    it('should reject sale command with negative amount', () => {
      const command: ParsedCommand = {
        type: 'sale',
        amount: -100,
        confidence: 0.9,
        originalText: 'vente -100',
        language: 'fr',
      };

      const result = service.validateCommand(command);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Le montant doit être un nombre positif');
    });

    it('should reject sale command with excessive amount', () => {
      const command: ParsedCommand = {
        type: 'sale',
        amount: 20000000,
        confidence: 0.9,
        originalText: 'vente 20000000',
        language: 'fr',
      };

      const result = service.validateCommand(command);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Le montant semble trop élevé');
    });

    it('should validate stock command with product and quantity', () => {
      const command: ParsedCommand = {
        type: 'stock',
        stockAction: 'update',
        product: 'pain',
        stockQuantity: 50,
        confidence: 0.9,
        originalText: 'stock pain 50',
        language: 'fr',
      };

      const result = service.validateCommand(command);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject stock command without product', () => {
      const command: ParsedCommand = {
        type: 'stock',
        stockAction: 'update',
        stockQuantity: 50,
        confidence: 0.9,
        originalText: 'stock 50',
        language: 'fr',
      };

      const result = service.validateCommand(command);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Le nom du produit est requis');
    });

    it('should reject stock command with negative quantity', () => {
      const command: ParsedCommand = {
        type: 'stock',
        stockAction: 'update',
        product: 'pain',
        stockQuantity: -5,
        confidence: 0.9,
        originalText: 'stock pain -5',
        language: 'fr',
      };

      const result = service.validateCommand(command);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La quantité doit être un nombre positif ou zéro');
    });
  });

  describe('getHelpMessage', () => {
    it('should return French help message by default', () => {
      const help = service.getHelpMessage();
      
      expect(help).toContain('vente');
      expect(help).toContain('dépense');
      expect(help).toContain('stock');
      expect(help).toContain('bilan');
    });

    // it('should return Wolof help message when requested', () => {
    //   const help = service.getHelpMessage('wo');
      
    //   expect(help).toContain('jaay');
    //   expect(help).toContain('jënd');
    // });

    it('should fallback to French for unsupported languages', () => {
      const help = service.getHelpMessage('en');
      
      expect(help).toContain('vente');
      expect(help).toContain('dépense');
    });
  });
});