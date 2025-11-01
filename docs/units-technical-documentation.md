# Units Management System - Technical Documentation

## Overview

The Units Management System extends MonPetitBiz's stock management capabilities to support multiple units of measure. Merchants can purchase products in bulk units (e.g., cases) and sell them in retail units (e.g., individual bottles), with automatic conversion handling.

## Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │  Unit Command    │    │ Unit Management │
│   Commands      │───▶│    Handler       │───▶│    Service      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌─────────────────┐              │
                       │ Unit Conversion │◀─────────────┘
                       │    Service      │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │ Unit Validation │
                       │    Service      │
                       └─────────────────┘
```

### Database Schema

#### ProductUnit Entity
```typescript
@Entity('product_units')
export class ProductUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  businessId: string;

  @Column({ length: 255 })
  productName: string;

  @Column({ length: 50, default: 'pièce' })
  baseUnit: string;

  @Column({ length: 50 })
  purchaseUnit: string;

  @Column('integer')
  conversionFactor: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  purchasePrice?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  sellingPrice?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  profitMargin?: number;

  @Column('integer', { nullable: true })
  alertThreshold?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### StockMovement Entity
```typescript
@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  businessId: string;

  @Column({ length: 255 })
  productName: string;

  @Column({ 
    type: 'enum', 
    enum: ['purchase', 'sale', 'adjustment', 'loss'] 
  })
  movementType: string;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column({ length: 50 })
  unit: string;

  @Column('decimal', { precision: 10, scale: 2 })
  baseQuantity: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  unitPrice?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalAmount?: number;

  @Column('decimal', { precision: 10, scale: 2 })
  previousStock: number;

  @Column('decimal', { precision: 10, scale: 2 })
  newStock: number;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('uuid')
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

## Service Layer

### UnitManagementService

Handles unit configuration and management operations.

```typescript
@Injectable()
export class UnitManagementService {
  async configureProductUnits(
    businessId: string,
    productName: string,
    baseUnit: string,
    purchaseUnit: string,
    conversionFactor: number
  ): Promise<ProductUnit> {
    // Validate inputs
    await this.unitValidationService.validateConfiguration({
      baseUnit,
      purchaseUnit,
      conversionFactor
    });

    // Create or update configuration
    const existingConfig = await this.findByBusinessAndProduct(businessId, productName);
    
    if (existingConfig) {
      return this.updateConfiguration(existingConfig.id, {
        baseUnit,
        purchaseUnit,
        conversionFactor
      });
    }

    return this.createConfiguration({
      businessId,
      productName,
      baseUnit,
      purchaseUnit,
      conversionFactor
    });
  }

  async setPurchasePrice(
    businessId: string,
    productName: string,
    price: number,
    unit: string
  ): Promise<ProductUnit> {
    const config = await this.getRequiredConfig(businessId, productName);
    
    // Validate unit
    if (unit !== config.purchaseUnit) {
      throw new Error(`Prix d'achat doit être en ${config.purchaseUnit}`);
    }

    // Update purchase price
    config.purchasePrice = price;
    return this.productUnitRepository.save(config);
  }

  async calculateSellingPrice(
    businessId: string,
    productName: string,
    marginPercent: number
  ): Promise<number> {
    const config = await this.getRequiredConfig(businessId, productName);
    
    if (!config.purchasePrice) {
      throw new Error('Prix d\'achat non configuré');
    }

    // Calculate unit cost in base unit
    const unitCost = config.purchasePrice / config.conversionFactor;
    
    // Apply margin
    const sellingPrice = unitCost * (1 + marginPercent / 100);
    
    // Update configuration
    config.sellingPrice = Math.round(sellingPrice);
    config.profitMargin = marginPercent;
    await this.productUnitRepository.save(config);
    
    return config.sellingPrice;
  }
}
```

### UnitConversionService

Handles unit conversions and formatting.

```typescript
@Injectable()
export class UnitConversionService {
  convertToBaseUnit(
    quantity: number,
    fromUnit: string,
    productConfig: ProductUnit
  ): number {
    if (fromUnit === productConfig.baseUnit) {
      return quantity;
    }
    
    if (fromUnit === productConfig.purchaseUnit) {
      return quantity * productConfig.conversionFactor;
    }
    
    throw new Error(`Unité '${fromUnit}' non reconnue pour ${productConfig.productName}`);
  }

  convertFromBaseUnit(
    baseQuantity: number,
    toUnit: string,
    productConfig: ProductUnit
  ): number {
    if (toUnit === productConfig.baseUnit) {
      return baseQuantity;
    }
    
    if (toUnit === productConfig.purchaseUnit) {
      return Math.floor(baseQuantity / productConfig.conversionFactor);
    }
    
    throw new Error(`Unité '${toUnit}' non reconnue pour ${productConfig.productName}`);
  }

  formatStockDisplay(
    baseQuantity: number,
    productConfig: ProductUnit
  ): string {
    const purchaseUnits = Math.floor(baseQuantity / productConfig.conversionFactor);
    const remainingBase = baseQuantity % productConfig.conversionFactor;
    
    if (purchaseUnits === 0) {
      return `${baseQuantity} ${productConfig.baseUnit}${baseQuantity > 1 ? 's' : ''}`;
    }
    
    if (remainingBase === 0) {
      return `${baseQuantity} ${productConfig.baseUnit}s (${purchaseUnits} ${productConfig.purchaseUnit}${purchaseUnits > 1 ? 's' : ''})`;
    }
    
    return `${baseQuantity} ${productConfig.baseUnit}s (${purchaseUnits} ${productConfig.purchaseUnit}${purchaseUnits > 1 ? 's' : ''} + ${remainingBase} ${productConfig.baseUnit}${remainingBase > 1 ? 's' : ''})`;
  }

  parseQuantityWithUnit(
    input: string,
    productConfig: ProductUnit
  ): { quantity: number; unit: string } {
    // Parse patterns like "5 caisse", "24 bouteille", "10"
    const match = input.trim().match(/^(\d+(?:\.\d+)?)\s*(\w+)?$/);
    
    if (!match) {
      throw new Error('Format invalide. Utilisez: [quantité] [unité]');
    }
    
    const quantity = parseFloat(match[1]);
    const unit = match[2] || productConfig.baseUnit;
    
    // Validate unit
    if (unit !== productConfig.baseUnit && unit !== productConfig.purchaseUnit) {
      throw new Error(
        `Unité '${unit}' non reconnue. Utilisez '${productConfig.baseUnit}' ou '${productConfig.purchaseUnit}'`
      );
    }
    
    return { quantity, unit };
  }
}
```

### StockMovementService

Tracks all stock movements with unit information.

```typescript
@Injectable()
export class StockMovementService {
  async recordMovement(
    businessId: string,
    productName: string,
    movementType: 'purchase' | 'sale' | 'adjustment' | 'loss',
    quantity: number,
    unit: string,
    userId: string,
    additionalData?: Partial<StockMovement>
  ): Promise<StockMovement> {
    // Get current stock
    const currentStock = await this.stockService.getProductStock(businessId, productName);
    
    // Get unit configuration
    const unitConfig = await this.unitManagementService.getProductUnits(businessId, productName);
    
    // Convert to base units
    let baseQuantity: number;
    if (unitConfig) {
      baseQuantity = this.unitConversionService.convertToBaseUnit(quantity, unit, unitConfig);
    } else {
      baseQuantity = quantity;
      unit = 'pièce'; // Default unit
    }
    
    // Calculate new stock
    const stockChange = movementType === 'purchase' || movementType === 'adjustment' 
      ? baseQuantity 
      : -baseQuantity;
    const newStock = currentStock + stockChange;
    
    // Create movement record
    const movement = this.stockMovementRepository.create({
      businessId,
      productName,
      movementType,
      quantity,
      unit,
      baseQuantity,
      previousStock: currentStock,
      newStock,
      createdBy: userId,
      ...additionalData
    });
    
    return this.stockMovementRepository.save(movement);
  }

  async getMovementHistory(
    businessId: string,
    productName?: string,
    limit: number = 50
  ): Promise<StockMovement[]> {
    const query = this.stockMovementRepository
      .createQueryBuilder('movement')
      .where('movement.businessId = :businessId', { businessId })
      .orderBy('movement.createdAt', 'DESC')
      .limit(limit);
    
    if (productName) {
      query.andWhere('movement.productName = :productName', { productName });
    }
    
    return query.getMany();
  }
}
```

## WhatsApp Command Integration

### Command Patterns

```typescript
export const UNIT_COMMAND_PATTERNS = {
  CONFIGURE_UNITS: /^produit unité (\w+) achat (\w+) (\d+) (\w+)$/i,
  VIEW_UNITS: /^produit unité (\w+)$/i,
  STOCK_WITH_UNIT: /^stock (\w+) (\d+(?:\.\d+)?)\s*(\w+)?$/i,
  PURCHASE_PRICE: /^prix achat (\w+) (\d+) (\w+)$/i,
  SELLING_MARGIN: /^prix vente (\w+) (\d+)%$/i,
  VIEW_PRICES: /^prix (\w+)$/i,
  ALERT_CONFIG: /^alerte (\w+) (\d+) (\w+)$/i,
  MOVEMENT_HISTORY: /^historique (\w+)$/i,
};
```

### UnitCommandHandler

```typescript
@Injectable()
export class UnitCommandHandler {
  async handleConfigureUnits(
    businessId: string,
    userId: string,
    matches: RegExpMatchArray
  ): Promise<string> {
    const [, productName, purchaseUnit, factorStr, baseUnit] = matches;
    const conversionFactor = parseInt(factorStr);
    
    try {
      const config = await this.unitManagementService.configureProductUnits(
        businessId,
        productName,
        baseUnit,
        purchaseUnit,
        conversionFactor
      );
      
      return `✅ Configuration mise à jour: ${productName}\n` +
             `📦 Achat: ${purchaseUnit} (${conversionFactor} ${baseUnit}${conversionFactor > 1 ? 's' : ''} par ${purchaseUnit})\n` +
             `🛒 Vente: ${baseUnit}`;
    } catch (error) {
      return `❌ Erreur: ${error.message}`;
    }
  }

  async handleStockWithUnit(
    businessId: string,
    userId: string,
    matches: RegExpMatchArray
  ): Promise<string> {
    const [, productName, quantityStr, unit] = matches;
    const quantity = parseFloat(quantityStr);
    
    try {
      // Get unit configuration
      const unitConfig = await this.unitManagementService.getProductUnits(businessId, productName);
      
      if (!unitConfig && unit && unit !== 'pièce') {
        return `❌ Unités non configurées pour ${productName}. Tapez 'produit unité ${productName} achat [unité] [facteur] [unité_base]'`;
      }
      
      // Update stock
      const result = await this.stockService.updateStockWithUnit(
        businessId,
        productName,
        quantity,
        unit || (unitConfig?.baseUnit ?? 'pièce')
      );
      
      // Record movement
      await this.stockMovementService.recordMovement(
        businessId,
        productName,
        'purchase',
        quantity,
        unit || (unitConfig?.baseUnit ?? 'pièce'),
        userId
      );
      
      // Format response
      if (unitConfig) {
        const displayStock = this.unitConversionService.formatStockDisplay(
          result.quantity,
          unitConfig
        );
        
        const addedDisplay = unit === unitConfig.purchaseUnit
          ? `${quantity} ${unit}${quantity > 1 ? 's' : ''} (${quantity * unitConfig.conversionFactor} ${unitConfig.baseUnit}s)`
          : `${quantity} ${unit || unitConfig.baseUnit}${quantity > 1 ? 's' : ''}`;
        
        return `✅ Stock mis à jour: ${productName}\n` +
               `📦 Ajouté: ${addedDisplay}\n` +
               `📊 Stock total: ${displayStock}`;
      } else {
        return `✅ Stock mis à jour: ${productName}\n` +
               `📦 Ajouté: ${quantity} pièce${quantity > 1 ? 's' : ''}\n` +
               `📊 Stock total: ${result.quantity} pièces`;
      }
    } catch (error) {
      return `❌ Erreur: ${error.message}`;
    }
  }
}
```

## Error Handling

### Custom Exceptions

```typescript
export class UnitConfigurationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'UnitConfigurationError';
  }
}

export class UnitConversionError extends Error {
  constructor(message: string, public readonly fromUnit: string, public readonly toUnit: string) {
    super(message);
    this.name = 'UnitConversionError';
  }
}

export class InsufficientStockError extends Error {
  constructor(
    message: string,
    public readonly available: number,
    public readonly requested: number,
    public readonly unit: string
  ) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}
```

### Error Messages (French)

```typescript
export const UNIT_ERROR_MESSAGES = {
  UNIT_NOT_CONFIGURED: (product: string) => 
    `❌ Unités non configurées pour ${product}. Tapez 'produit unité ${product} achat [unité] [facteur] [unité_base]'`,
  
  INVALID_CONVERSION_FACTOR: () => 
    `❌ Le facteur de conversion doit être un nombre entier positif. Exemple: 24 pour une caisse de 24 bouteilles`,
  
  UNKNOWN_UNIT: (unit: string, product: string, availableUnits: string[]) => 
    `❌ Unité '${unit}' inconnue pour ${product}. Unités disponibles: ${availableUnits.join(', ')}`,
  
  INSUFFICIENT_STOCK: (available: number, unit: string, baseAvailable: number, baseUnit: string) => 
    `❌ Stock insuffisant. Disponible: ${available} ${unit} (${baseAvailable} ${baseUnit})`,
  
  INVALID_PRICE_FORMAT: () => 
    `❌ Format de prix invalide. Utilisez un nombre entier en FCFA. Exemple: 12000`,
  
  UNIT_CONFIGURATION_CONFLICT: (currentStock: number, baseUnit: string) => 
    `⚠️ Modification de configuration détectée. Stock actuel: ${currentStock} ${baseUnit}. Continuer? (oui/non)`
};
```

## Testing

### Unit Tests

```typescript
describe('UnitConversionService', () => {
  let service: UnitConversionService;
  let mockProductUnit: ProductUnit;

  beforeEach(() => {
    mockProductUnit = {
      id: 'test-id',
      businessId: 'business-id',
      productName: 'bière',
      baseUnit: 'bouteille',
      purchaseUnit: 'caisse',
      conversionFactor: 24,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('convertToBaseUnit', () => {
    it('should convert purchase units to base units', () => {
      const result = service.convertToBaseUnit(5, 'caisse', mockProductUnit);
      expect(result).toBe(120); // 5 * 24
    });

    it('should return same quantity for base units', () => {
      const result = service.convertToBaseUnit(10, 'bouteille', mockProductUnit);
      expect(result).toBe(10);
    });

    it('should throw error for unknown unit', () => {
      expect(() => {
        service.convertToBaseUnit(5, 'unknown', mockProductUnit);
      }).toThrow('Unité \'unknown\' non reconnue');
    });
  });

  describe('formatStockDisplay', () => {
    it('should format stock with mixed units', () => {
      const result = service.formatStockDisplay(73, mockProductUnit);
      expect(result).toBe('73 bouteilles (3 caisses + 1 bouteille)');
    });

    it('should format stock with exact purchase units', () => {
      const result = service.formatStockDisplay(48, mockProductUnit);
      expect(result).toBe('48 bouteilles (2 caisses)');
    });

    it('should format stock with only base units', () => {
      const result = service.formatStockDisplay(10, mockProductUnit);
      expect(result).toBe('10 bouteilles');
    });
  });
});
```

### Integration Tests

```typescript
describe('Units Integration', () => {
  it('should handle complete stock flow with units', async () => {
    // Configure units
    await request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .send(createWebhookPayload('produit unité bière achat caisse 24 bouteille'))
      .expect(200);

    // Add stock
    await request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .send(createWebhookPayload('stock bière 5 caisse'))
      .expect(200);

    // Verify stock
    const stockResponse = await request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .send(createWebhookPayload('stock bière'))
      .expect(200);

    expect(stockResponse.body.message).toContain('120 bouteilles');
    expect(stockResponse.body.message).toContain('5 caisses');

    // Make sale
    await request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .send(createWebhookPayload('vente 2100 bière 3'))
      .expect(200);

    // Verify updated stock
    const updatedStockResponse = await request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .send(createWebhookPayload('stock bière'))
      .expect(200);

    expect(updatedStockResponse.body.message).toContain('117 bouteilles');
  });
});
```

## Performance Considerations

### Database Optimization

1. **Indexes**: Composite indexes on (business_id, product_name) for fast lookups
2. **Query Optimization**: Use joins instead of N+1 queries
3. **Caching**: Cache unit configurations for frequently accessed products

### Memory Management

1. **Batch Processing**: Process multiple unit conversions in batches
2. **Lazy Loading**: Load unit configurations only when needed
3. **Connection Pooling**: Optimize database connections

## Deployment

### Migration Steps

1. **Run Migrations**:
   ```bash
   npm run typeorm:migration:run
   ```

2. **Validate Schema**:
   ```bash
   node scripts/validate-data-integrity.js --verbose
   ```

3. **Migrate Existing Data**:
   ```bash
   node scripts/migrate-existing-data.js --dry-run
   node scripts/migrate-existing-data.js
   ```

4. **Setup Reference Data**:
   ```bash
   psql $DATABASE_URL < scripts/setup-units-reference-data.sql
   ```

### Rollback Plan

If issues occur, use the rollback script:
```bash
./scripts/rollback-units-feature.sh
```

## Monitoring

### Key Metrics

1. **Unit Configuration Coverage**: Percentage of products with units configured
2. **Conversion Accuracy**: Validation of conversion calculations
3. **Error Rates**: Track unit-related errors
4. **Performance**: Monitor query performance for unit operations

### Logging

```typescript
// Log unit conversions for audit
this.logger.log(`Unit conversion: ${quantity} ${fromUnit} -> ${baseQuantity} ${baseUnit} for ${productName}`);

// Log configuration changes
this.logger.log(`Unit configuration updated: ${productName} - ${purchaseUnit}:${baseUnit} (${conversionFactor}:1)`);

// Log validation errors
this.logger.error(`Unit validation failed: ${error.message}`, error.stack);
```

## Security

### Input Validation

1. **Conversion Factors**: Must be positive integers between 1 and 10,000
2. **Unit Names**: Alphanumeric characters only, max 50 characters
3. **Prices**: Positive numbers with reasonable limits
4. **Business Isolation**: Strict business_id validation

### Data Integrity

1. **Referential Integrity**: Foreign key constraints
2. **Check Constraints**: Validate conversion factors and prices
3. **Unique Constraints**: Prevent duplicate configurations
4. **Audit Trail**: Complete movement history

---

This technical documentation provides comprehensive coverage of the Units Management System implementation. For specific implementation details, refer to the source code and additional inline documentation.