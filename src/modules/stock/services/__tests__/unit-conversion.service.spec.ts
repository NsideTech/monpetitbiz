import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UnitConversionService } from '../unit-conversion.service';
import { UnitErrorMessagesService } from '../unit-error-messages.service';
import { ProductUnit } from '../../entities/product-unit.entity';

describe('UnitConversionService', () => {
  let service: UnitConversionService;
  let mockProductUnit: ProductUnit;

  beforeEach(async () => {
    const mockUnitErrorMessagesService = {
      getErrorMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitConversionService,
        {
          provide: UnitErrorMessagesService,
          useValue: mockUnitErrorMessagesService,
        },
      ],
    }).compile();

    service = module.get<UnitConversionService>(UnitConversionService);

    // Create mock product unit configuration
    mockProductUnit = {
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
  });

  describe('convertToBaseUnit', () => {
    it('should convert purchase unit to base unit correctly', () => {
      const result = service.convertToBaseUnit(5, 'caisse', mockProductUnit);
      expect(result).toBe(120); // 5 * 24
    });

    it('should return same quantity for base unit', () => {
      const result = service.convertToBaseUnit(24, 'bouteille', mockProductUnit);
      expect(result).toBe(24);
    });

    it('should throw error for invalid unit', () => {
      expect(() => {
        service.convertToBaseUnit(5, 'invalid', mockProductUnit);
      }).toThrow(BadRequestException);
    });

    it('should throw error for negative quantity', () => {
      expect(() => {
        service.convertToBaseUnit(-5, 'caisse', mockProductUnit);
      }).toThrow(BadRequestException);
    });
  });

  describe('convertFromBaseUnit', () => {
    it('should convert base unit to purchase unit correctly', () => {
      const result = service.convertFromBaseUnit(120, 'caisse', mockProductUnit);
      expect(result).toBe(5); // 120 / 24
    });

    it('should handle partial purchase units', () => {
      const result = service.convertFromBaseUnit(73, 'caisse', mockProductUnit);
      expect(result).toBe(3); // floor(73 / 24)
    });

    it('should return same quantity for base unit', () => {
      const result = service.convertFromBaseUnit(73, 'bouteille', mockProductUnit);
      expect(result).toBe(73);
    });
  });

  describe('formatStockDisplay', () => {
    it('should format stock with both units when applicable', () => {
      const result = service.formatStockDisplay(73, mockProductUnit);
      expect(result).toBe('73 bouteilles (3 caisses + 1 bouteille)');
    });

    it('should format stock with only base units when no complete purchase units', () => {
      const result = service.formatStockDisplay(12, mockProductUnit);
      expect(result).toBe('12 bouteilles');
    });

    it('should format stock with only purchase units when exact multiple', () => {
      const result = service.formatStockDisplay(48, mockProductUnit);
      expect(result).toBe('48 bouteilles (2 caisses)');
    });

    it('should handle zero stock', () => {
      const result = service.formatStockDisplay(0, mockProductUnit);
      expect(result).toBe('0 bouteille');
    });
  });

  describe('parseQuantityWithUnit', () => {
    it('should parse standard format correctly', () => {
      const result = service.parseQuantityWithUnit('5 caisse', mockProductUnit);
      expect(result).toEqual({ quantity: 5, unit: 'caisse' });
    });

    it('should parse compact format correctly', () => {
      const result = service.parseQuantityWithUnit('24bouteille', mockProductUnit);
      expect(result).toEqual({ quantity: 24, unit: 'bouteille' });
    });

    it('should handle plural forms', () => {
      const result = service.parseQuantityWithUnit('5 caisses', mockProductUnit);
      expect(result).toEqual({ quantity: 5, unit: 'caisse' });
    });

    it('should throw error for invalid format', () => {
      expect(() => {
        service.parseQuantityWithUnit('invalid input', mockProductUnit);
      }).toThrow(BadRequestException);
    });

    it('should throw error for negative quantity', () => {
      expect(() => {
        service.parseQuantityWithUnit('-5 caisse', mockProductUnit);
      }).toThrow(BadRequestException);
    });
  });

  describe('validateUnit', () => {
    it('should validate base unit', () => {
      const result = service.validateUnit('bouteille', mockProductUnit);
      expect(result).toBe(true);
    });

    it('should validate purchase unit', () => {
      const result = service.validateUnit('caisse', mockProductUnit);
      expect(result).toBe(true);
    });

    it('should reject invalid unit', () => {
      const result = service.validateUnit('invalid', mockProductUnit);
      expect(result).toBe(false);
    });
  });

  describe('validateConversionFactor', () => {
    it('should validate positive integer', () => {
      expect(service.validateConversionFactor(24)).toBe(true);
    });

    it('should reject negative number', () => {
      expect(service.validateConversionFactor(-5)).toBe(false);
    });

    it('should reject decimal number', () => {
      expect(service.validateConversionFactor(24.5)).toBe(false);
    });

    it('should reject zero', () => {
      expect(service.validateConversionFactor(0)).toBe(false);
    });

    it('should reject very large numbers', () => {
      expect(service.validateConversionFactor(20000)).toBe(false);
    });
  });
});