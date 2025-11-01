import { Test, TestingModule } from '@nestjs/testing';
import { UnitConversionService } from '../unit-conversion.service';
import { ProductUnit } from '../../entities/product-unit.entity';

describe('UnitConversionService Integration', () => {
  let service: UnitConversionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitConversionService],
    }).compile();

    service = module.get<UnitConversionService>(UnitConversionService);
  });

  describe('Real-world scenarios', () => {
    it('should handle beer case scenario correctly', () => {
      const beerConfig: ProductUnit = {
        id: '1',
        businessId: 'business-1',
        productName: 'bière',
        baseUnit: 'bouteille',
        purchaseUnit: 'caisse',
        conversionFactor: 24,
        purchasePrice: 12000,
        sellingPrice: 700,
        profitMargin: 40,
        alertThreshold: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        business: null
      };

      // Test conversion: 5 cases to bottles
      const baseQuantity = service.convertToBaseUnit(5, 'caisse', beerConfig);
      expect(baseQuantity).toBe(120);

      // Test display formatting
      const display = service.formatStockDisplay(73, beerConfig);
      expect(display).toBe('73 bouteilles (3 caisses + 1 bouteille)');

      // Test parsing user input
      const parsed = service.parseQuantityWithUnit('5 caisse', beerConfig);
      expect(parsed).toEqual({ quantity: 5, unit: 'caisse' });
    });

    it('should handle rice bag scenario correctly', () => {
      const riceConfig: ProductUnit = {
        id: '2',
        businessId: 'business-1',
        productName: 'riz',
        baseUnit: 'kg',
        purchaseUnit: 'sac',
        conversionFactor: 50,
        purchasePrice: 25000,
        sellingPrice: 600,
        profitMargin: 20,
        alertThreshold: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        business: null
      };

      // Test conversion: 3 bags to kg
      const baseQuantity = service.convertToBaseUnit(3, 'sac', riceConfig);
      expect(baseQuantity).toBe(150);

      // Test display formatting
      const display = service.formatStockDisplay(125, riceConfig);
      expect(display).toBe('125 kgs (2 sacs + 25 kgs)');

      // Test parsing flexible input
      const parsed1 = service.parseQuantityWithUnit('3 sacs', riceConfig);
      expect(parsed1).toEqual({ quantity: 3, unit: 'sac' });

      const parsed2 = service.parseQuantityWithUnit('25kg', riceConfig);
      expect(parsed2).toEqual({ quantity: 25, unit: 'kg' });
    });

    it('should provide helpful error messages', () => {
      const config: ProductUnit = {
        id: '3',
        businessId: 'business-1',
        productName: 'eau',
        baseUnit: 'bouteille',
        purchaseUnit: 'pack',
        conversionFactor: 12,
        purchasePrice: 6000,
        sellingPrice: 600,
        profitMargin: 20,
        alertThreshold: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        business: null
      };

      // Test error message for invalid unit
      expect(() => {
        service.convertToBaseUnit(5, 'litre', config);
      }).toThrow(/Unité 'litre' inconnue pour eau/);

      // Test error message for invalid format
      expect(() => {
        service.parseQuantityWithUnit('invalid input', config);
      }).toThrow(/Format invalide/);
    });

    it('should generate helpful help messages', () => {
      const config: ProductUnit = {
        id: '4',
        businessId: 'business-1',
        productName: 'savon',
        baseUnit: 'pièce',
        purchaseUnit: 'carton',
        conversionFactor: 48,
        purchasePrice: 24000,
        sellingPrice: 600,
        profitMargin: 20,
        alertThreshold: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        business: null
      };

      const helpMessage = service.generateHelpMessage(config);
      expect(helpMessage).toContain('savon');
      expect(helpMessage).toContain('carton');
      expect(helpMessage).toContain('pièce');
      expect(helpMessage).toContain('48');
    });
  });
});