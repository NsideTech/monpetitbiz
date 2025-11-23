import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockItem } from './entities/stock-item.entity';
import { ProductNormalizerService } from './services/product-normalizer.service';
import { StockMovementService, RecordMovementData } from './services/stock-movement.service';
import { UnitManagementService } from './services/unit-management.service';
import { UnitConversionService } from './services/unit-conversion.service';
import { MovementType } from './entities/stock-movement.entity';

export interface StockUpdateData {
  product: string;
  quantity: number;
}

export interface StockWarning {
  product: string;
  currentQuantity: number;
  warningLevel: number;
  message: string;
}

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockItem)
    private stockItemRepository: Repository<StockItem>,
    private readonly productNormalizer: ProductNormalizerService,
    private readonly stockMovementService: StockMovementService,
    private readonly unitManagementService: UnitManagementService,
    private readonly unitConversionService: UnitConversionService,
  ) {}

  /**
   * Update stock quantity for a product (backward compatible)
   * Requirement 3.1: WHEN l'utilisateur envoie "stock pain 50" THEN le système SHALL mettre à jour la quantité du produit à 50 unités
   * Requirement 8.1, 8.2, 8.3: Maintain compatibility with existing functionality
   */
  async updateStock(businessId: string, product: string, quantity: number, userId?: string): Promise<StockItem> {
    // Use the unit-aware method with default unit for backward compatibility
    return this.updateStockWithUnit(businessId, product, quantity, 'pièce', userId);
  }

  /**
   * Delete a product from stock
   * This will remove the product entirely from the stock system
   */
  async deleteProduct(businessId: string, product: string, userId?: string): Promise<{ success: boolean; message: string }> {
    if (!product || product.trim().length === 0) {
      throw new BadRequestException('Product name is required');
    }

    const normalizedProduct = this.productNormalizer.normalize(product);
    
    // Get all existing products for this business
    const existingStockItems = await this.stockItemRepository.find({
      where: { businessId }
    });
    
    const existingProductNames = existingStockItems.map(item => item.product);
    
    // Find the best matching product using the normalizer
    const matchingProductName = this.productNormalizer.findBestMatch(normalizedProduct, existingProductNames);
    
    if (!matchingProductName) {
      return {
        success: false,
        message: `Produit "${product}" non trouvé dans le stock.`
      };
    }

    const stockItem = existingStockItems.find(item => item.product === matchingProductName);
    
    if (!stockItem) {
      return {
        success: false,
        message: `Produit "${product}" non trouvé dans le stock.`
      };
    }

    try {
      // Record deletion movement if userId is provided
      if (userId && stockItem.quantity > 0) {
        try {
          await this.recordStockMovement(
            businessId,
            matchingProductName,
            MovementType.ADJUSTMENT,
            stockItem.quantity,
            'pièce',
            stockItem.quantity,
            userId,
            `Suppression du produit - ${stockItem.quantity} unité(s) supprimées`
          );
        } catch (error) {
          console.warn('Failed to record deletion movement:', error);
          // Don't fail the deletion if movement recording fails
        }
      }

      // Delete the stock item
      await this.stockItemRepository.remove(stockItem);

      // Also delete unit configuration if it exists
      try {
        await this.unitManagementService.deleteProductUnits(businessId, matchingProductName);
      } catch (error) {
        console.warn('Failed to delete unit configuration:', error);
        // Don't fail if unit config deletion fails
      }

      return {
        success: true,
        message: `✅ Produit "${matchingProductName}" supprimé du stock.`
      };

    } catch (error) {
      console.error(`Error deleting product ${matchingProductName}:`, error);
      return {
        success: false,
        message: `Erreur lors de la suppression du produit "${product}".`
      };
    }
  }

  /**
   * Get stock for a specific product
   * Requirement 3.2: WHEN l'utilisateur demande "stock pain" THEN le système SHALL retourner la quantité actuelle du produit
   */
  async getStock(businessId: string, product?: string): Promise<StockItem[]> {
    if (product) {
      const normalizedProduct = product.trim().toLowerCase();
      const stockItem = await this.stockItemRepository.findOne({
        where: { businessId, product: normalizedProduct }
      });
      
      if (!stockItem) {
        throw new NotFoundException(`Product "${product}" not found in stock`);
      }
      
      return [stockItem];
    }

    // Requirement 3.3: WHEN l'utilisateur demande "stock" sans préciser de produit THEN le système SHALL retourner la liste de tous les produits avec leurs quantités
    return await this.stockItemRepository.find({
      where: { businessId },
      order: { product: 'ASC' }
    });
  }

  /**
   * Decrement stock when a sale is made (backward compatible)
   * Requirement 3.4: WHEN une vente est enregistrée avec un produit THEN le système SHALL automatiquement décrémenter le stock si disponible
   * Requirement 8.1, 8.2, 8.3: Maintain compatibility with existing functionality
   */
  async decrementStock(businessId: string, product: string, quantity: number = 1, userId?: string, saleAmount?: number): Promise<boolean> {
    // Use the unit-aware method with default unit for backward compatibility
    try {
      const result = await this.decrementStockWithValidation(businessId, product, quantity, 'pièce', userId, saleAmount);
      return result.success;
    } catch (error) {
      // If unit-aware method fails, fall back to original logic for maximum compatibility
      console.warn('Unit-aware decrement failed, falling back to original logic:', error);
      return this.decrementStockLegacy(businessId, product, quantity, userId, saleAmount);
    }
  }

  /**
   * Legacy decrement stock method for fallback compatibility
   * Maintains original behavior exactly as it was
   */
  private async decrementStockLegacy(businessId: string, product: string, quantity: number = 1, userId?: string, saleAmount?: number): Promise<boolean> {
    // Input validation
    if (quantity <= 0) {
      throw new BadRequestException('Decrement quantity must be positive');
    }

    if (!product || product.trim().length === 0) {
      console.log('[StockService] No product specified, skipping stock decrement');
      return false; // No product specified, skip stock decrement
    }

    if (!businessId || businessId.trim().length === 0) {
      console.log('[StockService] No businessId specified, skipping stock decrement');
      return false;
    }

    const normalizedProduct = this.productNormalizer.normalize(product);
    console.log(`[StockService] Attempting to decrement stock: ${normalizedProduct} (quantity: ${quantity}) for business: ${businessId}`);

    // Get all existing products for this business
    const existingStockItems = await this.stockItemRepository.find({
      where: { businessId }
    });
    
    const existingProductNames = existingStockItems.map(item => item.product);
    
    // Find the best matching product using the normalizer
    const matchingProductName = this.productNormalizer.findBestMatch(normalizedProduct, existingProductNames);
    
    let stockItem: StockItem | null = null;
    
    if (matchingProductName) {
      stockItem = existingStockItems.find(item => item.product === matchingProductName) || null;
      console.log(`[StockService] Found matching product: "${matchingProductName}" for search "${normalizedProduct}"`);
    } else {
      console.log(`[StockService] No matching product found for "${normalizedProduct}" in business ${businessId}`);
      console.log(`[StockService] Available products: ${existingProductNames.join(', ')}`);
      return false; // Product not in stock system, skip decrement
    }

    if (!stockItem) {
      console.log(`[StockService] Stock item not found despite product match - this should not happen`);
      return false;
    }

    console.log(`[StockService] Found stock item: ${stockItem.product} with quantity ${stockItem.quantity}`);

    if (stockItem.quantity < quantity) {
      console.log(`[StockService] Insufficient stock: requested ${quantity}, available ${stockItem.quantity}. Setting to 0.`);
      // Insufficient stock, but allow the sale to proceed
      // Set stock to 0 and return false to indicate insufficient stock
      const actualSoldQuantity = stockItem.quantity; // Only sell what's available
      stockItem.quantity = 0;
      stockItem.updatedAt = new Date();
      
      try {
        const savedItem = await this.stockItemRepository.save(stockItem);
        console.log(`[StockService] Stock updated to ${savedItem.quantity} for ${savedItem.product}`);
        
        // Record partial sale movement if userId is provided and there was stock to sell
        if (userId && actualSoldQuantity > 0) {
          try {
            const unitPrice = saleAmount ? saleAmount / quantity : stockItem.unitPrice;
            await this.recordStockMovement(
              businessId,
              matchingProductName,
              MovementType.SALE,
              actualSoldQuantity,
              'pièce', // Default unit
              actualSoldQuantity,
              userId,
              `Vente partielle: ${actualSoldQuantity} unité(s) vendues (${quantity} demandées)`,
              unitPrice,
              saleAmount ? (saleAmount * actualSoldQuantity / quantity) : undefined
            );
          } catch (error) {
            console.warn('Failed to record partial sale movement:', error);
            // Don't fail the stock decrement if movement recording fails
          }
        }
        
        return false;
      } catch (error) {
        console.error(`[StockService] Error saving stock item:`, error);
        throw error;
      }
    }

    // Sufficient stock, decrement
    stockItem.quantity -= quantity;
    stockItem.updatedAt = new Date();
    
    try {
      const savedItem = await this.stockItemRepository.save(stockItem);
      console.log(`[StockService] Stock successfully decremented to ${savedItem.quantity} for ${savedItem.product}`);
      
      // Record sale movement if userId is provided
      if (userId) {
        try {
          const unitPrice = saleAmount ? saleAmount / quantity : stockItem.unitPrice;
          await this.recordStockMovement(
            businessId,
            matchingProductName,
            MovementType.SALE,
            quantity,
            'pièce', // Default unit
            quantity,
            userId,
            `Vente de ${quantity} unité(s)`,
            unitPrice,
            saleAmount
          );
        } catch (error) {
          console.warn('Failed to record sale movement:', error);
          // Don't fail the stock decrement if movement recording fails
        }
      }
      
      return true;
    } catch (error) {
      console.error(`[StockService] Error saving decremented stock:`, error);
      throw error;
    }
  }

  /**
   * Check for low stock warnings
   */
  async getStockWarnings(businessId: string, warningThreshold: number = 5): Promise<StockWarning[]> {
    const stockItems = await this.stockItemRepository.find({
      where: { businessId }
    });

    return stockItems
      .filter(item => item.quantity <= warningThreshold)
      .map(item => ({
        product: item.product,
        currentQuantity: item.quantity,
        warningLevel: warningThreshold,
        message: item.quantity === 0 
          ? `${item.product} is out of stock`
          : `${item.product} is running low (${item.quantity} remaining)`
      }));
  }

  /**
   * Add stock (increment existing quantity)
   */
  async addStock(businessId: string, product: string, quantity: number, userId?: string, purchasePrice?: number): Promise<StockItem> {
    if (quantity <= 0) {
      throw new BadRequestException('Add quantity must be positive');
    }

    const normalizedProduct = product.trim().toLowerCase();

    const existingStock = await this.stockItemRepository.findOne({
      where: { businessId, product: normalizedProduct }
    });

    let result: StockItem;
    if (existingStock) {
      existingStock.quantity += quantity;
      existingStock.updatedAt = new Date();
      result = await this.stockItemRepository.save(existingStock);
    } else {
      result = await this.updateStock(businessId, product, quantity, userId);
    }

    // Record purchase movement if userId is provided
    if (userId) {
      try {
        await this.recordStockMovement(
          businessId,
          normalizedProduct,
          MovementType.PURCHASE,
          quantity,
          'pièce', // Default unit
          quantity,
          userId,
          `Achat de ${quantity} unité(s)`,
          purchasePrice,
          purchasePrice ? purchasePrice * quantity : undefined
        );
      } catch (error) {
        console.warn('Failed to record purchase movement:', error);
        // Don't fail the stock addition if movement recording fails
      }
    }

    return result;
  }

  /**
   * Get stock level for a specific product (returns 0 if not found)
   */
  async getStockLevel(businessId: string, product: string): Promise<number> {
    if (!product || product.trim().length === 0) {
      return 0;
    }

    const normalizedProduct = this.productNormalizer.normalize(product);
    console.log(`[StockService] getStockLevel: searching for "${normalizedProduct}" in business ${businessId}`);
    
    // Get all existing products for this business
    const existingStockItems = await this.stockItemRepository.find({
      where: { businessId }
    });
    
    const existingProductNames = existingStockItems.map(item => item.product);
    console.log(`[StockService] getStockLevel: found ${existingProductNames.length} products: ${existingProductNames.join(', ')}`);
    
    // First try exact match (case-insensitive)
    const exactMatch = existingProductNames.find(name => 
      this.productNormalizer.normalize(name) === normalizedProduct
    );
    
    if (exactMatch) {
      console.log(`[StockService] getStockLevel: exact match found: "${exactMatch}"`);
      const stockItem = existingStockItems.find(item => item.product === exactMatch);
      return stockItem ? stockItem.quantity : 0;
    }
    
    // Find the best matching product using the normalizer
    const matchingProductName = this.productNormalizer.findBestMatch(normalizedProduct, existingProductNames);
    
    if (matchingProductName) {
      console.log(`[StockService] getStockLevel: best match found: "${matchingProductName}"`);
      const stockItem = existingStockItems.find(item => item.product === matchingProductName);
      return stockItem ? stockItem.quantity : 0;
    }

    console.log(`[StockService] getStockLevel: no match found for "${normalizedProduct}"`);
    return 0;
  }

  /**
   * Check if product has sufficient stock
   */
  async hasSufficientStock(businessId: string, product: string, requiredQuantity: number = 1): Promise<boolean> {
    const currentStock = await this.getStockLevel(businessId, product);
    return currentStock >= requiredQuantity;
  }

  /**
   * Set unit price for a product
   */
  async setUnitPrice(businessId: string, product: string, unitPrice: number): Promise<StockItem> {
    if (unitPrice < 0) {
      throw new BadRequestException('Unit price cannot be negative');
    }

    if (!product || product.trim().length === 0) {
      throw new BadRequestException('Product name is required');
    }

    const normalizedProduct = product.trim().toLowerCase();

    // Find existing stock item or create new one
    let stockItem = await this.stockItemRepository.findOne({
      where: { businessId, product: normalizedProduct }
    });

    if (stockItem) {
      stockItem.unitPrice = unitPrice;
      stockItem.updatedAt = new Date();
      
      // Generate code if doesn't have one
      if (!stockItem.productCode) {
        stockItem.productCode = await this.generateProductCode(businessId, stockItem.product);
      }
    } else {
      // Generate product code for new product
      const productCode = await this.generateProductCode(businessId, normalizedProduct);
      
      stockItem = this.stockItemRepository.create({
        businessId,
        product: normalizedProduct,
        productCode,
        quantity: 0,
        unitPrice,
      });
    }

    return await this.stockItemRepository.save(stockItem);
  }

  /**
   * Get unit price for a product
   */
  async getUnitPrice(businessId: string, product: string): Promise<number | null> {
    if (!product || product.trim().length === 0) {
      return null;
    }

    const normalizedProduct = this.productNormalizer.normalize(product);
    
    // Get all existing products for this business
    const existingStockItems = await this.stockItemRepository.find({
      where: { businessId }
    });
    
    const existingProductNames = existingStockItems.map(item => item.product);
    
    // Find the best matching product using the normalizer
    const matchingProductName = this.productNormalizer.findBestMatch(normalizedProduct, existingProductNames);
    
    if (matchingProductName) {
      const stockItem = existingStockItems.find(item => item.product === matchingProductName);
      return stockItem?.unitPrice || null;
    }

    return null;
  }

  /**
   * Calculate sale amount based on quantity and unit price
   */
  async calculateSaleAmount(businessId: string, product: string, quantity: number): Promise<number | null> {
    const unitPrice = await this.getUnitPrice(businessId, product);
    if (unitPrice === null) {
      return null;
    }
    return unitPrice * quantity;
  }

  /**
   * Calculate sale amount with unit support
   * Requirements: 3.3, 3.4, 5.4, 5.5 - Calculate prices with multiple units
   */
  async calculateSaleAmountWithUnits(
    businessId: string, 
    product: string, 
    quantity: number, 
    unit: string
  ): Promise<number | null> {
    const normalizedProduct = this.productNormalizer.normalize(product);
    
    // Get product unit configuration
    const productConfig = await this.unitManagementService.getProductUnits(businessId, normalizedProduct);
    
    if (!productConfig) {
      // No unit configuration, fall back to standard calculation
      return this.calculateSaleAmount(businessId, product, quantity);
    }

    // Check if product has selling price configured
    if (!productConfig.sellingPrice) {
      // Try to get unit price from stock item
      const unitPrice = await this.getUnitPrice(businessId, product);
      if (unitPrice === null) {
        return null;
      }
      
      // Convert quantity to base units and calculate
      const baseQuantity = this.unitConversionService.convertToBaseUnit(quantity, unit, productConfig);
      return unitPrice * baseQuantity;
    }

    // Use configured selling price (which is per base unit)
    const baseQuantity = this.unitConversionService.convertToBaseUnit(quantity, unit, productConfig);
    return productConfig.sellingPrice * baseQuantity;
  }

  /**
   * Get comprehensive product price information with unit support
   * Requirements: 5.4, 5.5 - Provide detailed price info per unit
   */
  async getProductPriceInfo(businessId: string, product: string): Promise<{
    product: string;
    hasUnitConfig: boolean;
    baseUnit: string;
    purchaseUnit?: string;
    conversionFactor?: number;
    purchasePrice?: number;
    unitCostInBaseUnit?: number;
    sellingPrice?: number;
    profitMargin?: number;
    recommendedSellingPrice?: number;
    stockUnitPrice?: number; // From stock item
    priceSource: 'unit_config' | 'stock_item' | 'none';
  }> {
    const normalizedProduct = this.productNormalizer.normalize(product);
    
    // Get product unit configuration
    const productConfig = await this.unitManagementService.getProductUnits(businessId, normalizedProduct);
    
    // Get stock item unit price (legacy)
    const stockUnitPrice = await this.getUnitPrice(businessId, product);
    
    if (!productConfig) {
      // No unit configuration, return basic info
      return {
        product: normalizedProduct,
        hasUnitConfig: false,
        baseUnit: 'pièce',
        stockUnitPrice,
        priceSource: stockUnitPrice ? 'stock_item' : 'none'
      };
    }

    // Get detailed price info from unit management service
    const priceInfo = await this.unitManagementService.getProductPriceInfo(businessId, normalizedProduct);
    
    // Determine price source
    let priceSource: 'unit_config' | 'stock_item' | 'none' = 'none';
    if (priceInfo.sellingPrice || priceInfo.purchasePrice) {
      priceSource = 'unit_config';
    } else if (stockUnitPrice) {
      priceSource = 'stock_item';
    }

    return {
      product: normalizedProduct,
      hasUnitConfig: true,
      baseUnit: productConfig.baseUnit,
      purchaseUnit: productConfig.purchaseUnit,
      conversionFactor: productConfig.conversionFactor,
      purchasePrice: priceInfo.purchasePrice,
      unitCostInBaseUnit: priceInfo.unitCostInBaseUnit,
      sellingPrice: priceInfo.sellingPrice,
      profitMargin: priceInfo.profitMargin,
      recommendedSellingPrice: priceInfo.recommendedSellingPrice,
      stockUnitPrice,
      priceSource
    };
  }

  /**
   * Validate stock availability before sale with unit support
   * Requirements: 3.3, 3.4 - Validate stock before sale
   */
  async validateStockForSale(
    businessId: string, 
    product: string, 
    quantity: number, 
    unit: string
  ): Promise<{
    hasStock: boolean;
    availableQuantity: number;
    availableInRequestedUnit: number;
    formattedAvailable: string;
    canPartialSale: boolean;
    partialQuantity?: number;
  }> {
    const normalizedProduct = this.productNormalizer.normalize(product);
    
    // Get current stock level
    const currentStock = await this.getStockLevel(businessId, product);
    
    if (currentStock === 0) {
      return {
        hasStock: false,
        availableQuantity: 0,
        availableInRequestedUnit: 0,
        formattedAvailable: '0',
        canPartialSale: false
      };
    }

    // Get product unit configuration
    const productConfig = await this.unitManagementService.getProductUnits(businessId, normalizedProduct);
    
    if (!productConfig) {
      // No unit configuration, simple validation
      const hasStock = currentStock >= quantity;
      return {
        hasStock,
        availableQuantity: currentStock,
        availableInRequestedUnit: currentStock,
        formattedAvailable: `${currentStock} pièce${currentStock > 1 ? 's' : ''}`,
        canPartialSale: !hasStock && currentStock > 0,
        partialQuantity: hasStock ? undefined : currentStock
      };
    }

    // Convert requested quantity to base units
    const requestedBaseQuantity = this.unitConversionService.convertToBaseUnit(quantity, unit, productConfig);
    
    // Check if we have enough stock
    const hasStock = currentStock >= requestedBaseQuantity;
    
    // Calculate available quantity in requested unit
    const availableInRequestedUnit = this.unitConversionService.convertFromBaseUnit(currentStock, unit, productConfig);
    
    // Format available stock display
    const formattedAvailable = this.unitConversionService.formatStockDisplay(currentStock, productConfig);
    
    return {
      hasStock,
      availableQuantity: currentStock,
      availableInRequestedUnit,
      formattedAvailable,
      canPartialSale: !hasStock && currentStock > 0,
      partialQuantity: hasStock ? undefined : availableInRequestedUnit
    };
  }

  /**
   * Get all products with their stock and prices (for product list command)
   */
  async getAllProductsWithPrices(businessId: string): Promise<Array<{
    product: string;
    productCode: string | null;
    quantity: number;
    unitPrice: number | null;
    stockStatus: 'ok' | 'low' | 'out';
  }>> {
    const stockItems = await this.stockItemRepository.find({
      where: { businessId },
      order: { product: 'ASC' }
    });

    return stockItems.map(item => ({
      product: item.product,
      productCode: item.productCode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      stockStatus: item.quantity === 0 ? 'out' : (item.quantity <= 5 ? 'low' : 'ok')
    }));
  }

  /**
   * Get stock with units formatting for display
   * Requirements: 4.1, 4.2, 4.3 - Display stock in both base and purchase units
   */
  async getStockWithUnits(businessId: string, product?: string): Promise<Array<{
    product: string;
    baseQuantity: number;
    formattedDisplay: string;
    hasUnitConfig: boolean;
    unitConfig?: {
      baseUnit: string;
      purchaseUnit: string;
      conversionFactor: number;
      purchaseUnits: number;
      remainingBaseUnits: number;
    };
    alertInfo?: {
      shouldAlert: boolean;
      message?: string;
    };
  }>> {
    // Get stock items
    const stockItems = product ? 
      await this.getStock(businessId, product) : 
      await this.getStock(businessId);

    const results = [];

    for (const stockItem of stockItems) {
      // Get unit configuration for this product
      const productConfig = await this.unitManagementService.getProductUnits(businessId, stockItem.product);
      
      let formattedDisplay: string;
      let unitConfig: any = undefined;
      let alertInfo: any = undefined;

      if (productConfig) {
        // Format with unit conversion
        formattedDisplay = this.unitConversionService.formatStockDisplay(stockItem.quantity, productConfig);
        
        const purchaseUnits = Math.floor(stockItem.quantity / productConfig.conversionFactor);
        const remainingBaseUnits = stockItem.quantity % productConfig.conversionFactor;
        
        unitConfig = {
          baseUnit: productConfig.baseUnit,
          purchaseUnit: productConfig.purchaseUnit,
          conversionFactor: productConfig.conversionFactor,
          purchaseUnits,
          remainingBaseUnits
        };

        // Check for stock alerts
        const alertCheck = await this.unitManagementService.checkStockAlert(
          businessId, 
          stockItem.product, 
          stockItem.quantity
        );
        
        if (alertCheck.shouldAlert) {
          alertInfo = {
            shouldAlert: true,
            message: alertCheck.message
          };
        }
      } else {
        // No unit configuration, display as simple units
        formattedDisplay = `${stockItem.quantity} pièce${stockItem.quantity > 1 ? 's' : ''}`;
      }

      results.push({
        product: stockItem.product,
        baseQuantity: stockItem.quantity,
        formattedDisplay,
        hasUnitConfig: !!productConfig,
        unitConfig,
        alertInfo
      });
    }

    return results;
  }

  /**
   * Update stock with unit support
   * Requirements: 2.1, 2.2, 7.1, 7.2, 7.4, 7.5
   * Requirement 8.1, 8.2, 8.3: Maintain compatibility with existing functionality
   */
  async updateStockWithUnit(
    businessId: string, 
    product: string, 
    quantity: number, 
    unit: string, 
    userId?: string
  ): Promise<StockItem> {
    if (quantity < 0) {
      throw new BadRequestException('Stock quantity cannot be negative');
    }

    if (!product || product.trim().length === 0) {
      throw new BadRequestException('Product name is required');
    }

    const normalizedProduct = product.trim().toLowerCase();

    // Get product unit configuration
    const productConfig = await this.unitManagementService.getProductUnits(businessId, normalizedProduct);
    
    let baseQuantity: number;
    let actualUnit: string;

    if (productConfig) {
      try {
        // Convert to base unit using unit configuration
        baseQuantity = this.unitConversionService.convertToBaseUnit(quantity, unit, productConfig);
        actualUnit = unit;
      } catch (error) {
        // If unit conversion fails, fall back to treating as base units
        console.warn(`Unit conversion failed for ${product}, falling back to base units:`, error);
        baseQuantity = quantity;
        actualUnit = 'pièce';
      }
    } else {
      // No unit configuration, use quantity as is (backward compatibility)
      baseQuantity = quantity;
      actualUnit = unit || 'pièce'; // Use provided unit or default to 'pièce'
    }

    // Find existing stock item or create new one
    let stockItem = await this.stockItemRepository.findOne({
      where: { businessId, product: normalizedProduct }
    });

    const previousQuantity = stockItem ? stockItem.quantity : 0;

    if (stockItem) {
      stockItem.quantity = baseQuantity;
      stockItem.updatedAt = new Date();
      
      // Generate code if doesn't have one
      if (!stockItem.productCode) {
        stockItem.productCode = await this.generateProductCode(businessId, stockItem.product);
      }
    } else {
      // Generate product code for new product
      const productCode = await this.generateProductCode(businessId, normalizedProduct);
      
      stockItem = this.stockItemRepository.create({
        businessId,
        product: normalizedProduct,
        productCode,
        quantity: baseQuantity,
      });
    }

    const savedStockItem = await this.stockItemRepository.save(stockItem);

    // Record movement if userId is provided and there's a change
    if (userId && baseQuantity !== previousQuantity) {
      try {
        await this.recordStockMovement(
          businessId,
          normalizedProduct,
          MovementType.ADJUSTMENT,
          quantity,
          actualUnit,
          Math.abs(baseQuantity - previousQuantity),
          userId,
          productConfig ? 
            `Stock mis à jour de ${previousQuantity} à ${baseQuantity} (${quantity} ${actualUnit})` :
            `Stock mis à jour de ${previousQuantity} à ${baseQuantity}`
        );
      } catch (error) {
        console.warn('Failed to record stock movement:', error);
        // Don't fail the stock update if movement recording fails
      }
    }

    return savedStockItem;
  }

  /**
   * Decrement stock with unit validation
   * Requirements: 3.1, 3.2, 7.1, 7.2, 7.4, 7.5
   */
  async decrementStockWithValidation(
    businessId: string, 
    product: string, 
    quantity: number, 
    unit: string, 
    userId?: string,
    saleAmount?: number
  ): Promise<{ success: boolean; actualQuantitySold: number; insufficientStock: boolean }> {
    if (quantity <= 0) {
      throw new BadRequestException('Decrement quantity must be positive');
    }

    if (!product || product.trim().length === 0) {
      return { success: false, actualQuantitySold: 0, insufficientStock: false };
    }

    const normalizedProduct = this.productNormalizer.normalize(product);
    
    // Get product unit configuration
    const productConfig = await this.unitManagementService.getProductUnits(businessId, normalizedProduct);
    
    let baseQuantityToDecrement: number;
    let actualUnit: string;

    if (productConfig) {
      // Convert to base unit
      baseQuantityToDecrement = this.unitConversionService.convertToBaseUnit(quantity, unit, productConfig);
      actualUnit = unit;
    } else {
      // No unit configuration, use quantity as is
      baseQuantityToDecrement = quantity;
      actualUnit = 'pièce';
    }

    // Get all existing products for this business
    const existingStockItems = await this.stockItemRepository.find({
      where: { businessId }
    });
    
    const existingProductNames = existingStockItems.map(item => item.product);
    
    // Find the best matching product using the normalizer
    const matchingProductName = this.productNormalizer.findBestMatch(normalizedProduct, existingProductNames);
    
    let stockItem: StockItem | null = null;
    
    if (matchingProductName) {
      stockItem = existingStockItems.find(item => item.product === matchingProductName) || null;
    } else {
      return { success: false, actualQuantitySold: 0, insufficientStock: false };
    }

    if (!stockItem) {
      return { success: false, actualQuantitySold: 0, insufficientStock: false };
    }

    const originalQuantity = stockItem.quantity;
    let actualQuantitySold: number;
    let insufficientStock = false;

    if (stockItem.quantity < baseQuantityToDecrement) {
      // Insufficient stock, sell what's available
      actualQuantitySold = stockItem.quantity;
      stockItem.quantity = 0;
      insufficientStock = true;
    } else {
      // Sufficient stock
      actualQuantitySold = baseQuantityToDecrement;
      stockItem.quantity -= baseQuantityToDecrement;
    }

    stockItem.updatedAt = new Date();
    
    try {
      await this.stockItemRepository.save(stockItem);
      
      // Record sale movement if userId is provided and something was sold
      if (userId && actualQuantitySold > 0) {
        try {
          const unitPrice = saleAmount ? saleAmount / quantity : stockItem.unitPrice;
          const actualSaleAmount = saleAmount && insufficientStock ? 
            (saleAmount * actualQuantitySold / baseQuantityToDecrement) : saleAmount;
          
          await this.recordStockMovement(
            businessId,
            matchingProductName,
            MovementType.SALE,
            insufficientStock ? (actualQuantitySold * quantity / baseQuantityToDecrement) : quantity,
            actualUnit,
            actualQuantitySold,
            userId,
            insufficientStock ? 
              `Vente partielle: ${actualQuantitySold} unité(s) de base vendues (${quantity} ${actualUnit} demandées)` :
              `Vente de ${quantity} ${actualUnit}`,
            unitPrice,
            actualSaleAmount
          );
        } catch (error) {
          console.warn('Failed to record sale movement:', error);
        }
      }
      
      return { 
        success: !insufficientStock, 
        actualQuantitySold: actualQuantitySold, 
        insufficientStock 
      };
    } catch (error) {
      console.error(`[StockService] Error saving decremented stock:`, error);
      throw error;
    }
  }

  /**
   * Check if a product has unit configuration
   * Used for backward compatibility decisions
   */
  async hasUnitConfiguration(businessId: string, product: string): Promise<boolean> {
    const normalizedProduct = this.productNormalizer.normalize(product);
    const productConfig = await this.unitManagementService.getProductUnits(businessId, normalizedProduct);
    return !!productConfig;
  }

  /**
   * Get effective unit for a product (configured or default)
   * Ensures backward compatibility
   */
  async getEffectiveUnit(businessId: string, product: string, requestedUnit?: string): Promise<string> {
    const normalizedProduct = this.productNormalizer.normalize(product);
    const productConfig = await this.unitManagementService.getProductUnits(businessId, normalizedProduct);
    
    if (!productConfig) {
      // No unit configuration, use default or requested unit
      return requestedUnit || 'pièce';
    }

    // If no unit requested, use base unit
    if (!requestedUnit) {
      return productConfig.baseUnit;
    }

    // Validate requested unit against configuration
    if (this.unitConversionService.validateUnit(requestedUnit, productConfig)) {
      return requestedUnit;
    }

    // Invalid unit, fall back to base unit
    return productConfig.baseUnit;
  }

  /**
   * Enhanced method to handle both unit-configured and legacy products
   * Requirements: 8.1, 8.2, 8.3 - Ensure compatibility with existing functionality
   */
  async updateStockSmart(
    businessId: string, 
    product: string, 
    quantity: number, 
    unit?: string, 
    userId?: string
  ): Promise<StockItem> {
    const hasUnits = await this.hasUnitConfiguration(businessId, product);
    
    if (hasUnits && unit) {
      // Use unit-aware method
      return this.updateStockWithUnit(businessId, product, quantity, unit, userId);
    } else {
      // Use legacy method for backward compatibility
      return this.updateStock(businessId, product, quantity, userId);
    }
  }

  /**
   * Helper method to record stock movements
   * Requirements: 7.1, 7.2, 7.4, 7.5
   */
  private async recordStockMovement(
    businessId: string,
    productName: string,
    movementType: MovementType,
    quantity: number,
    unit: string,
    baseQuantity: number,
    userId: string,
    notes?: string,
    unitPrice?: number,
    totalAmount?: number
  ): Promise<void> {
    const movementData: RecordMovementData = {
      businessId,
      productName,
      movementType,
      quantity,
      unit,
      baseQuantity,
      unitPrice,
      totalAmount,
      notes,
      createdBy: userId
    };

    await this.stockMovementService.recordMovement(movementData);
  }

  /**
   * Generate a unique product code automatically
   * Strategy: Extract meaningful parts from product name + ensure uniqueness
   */
  async generateProductCode(businessId: string, productName: string): Promise<string> {
    const name = productName.toLowerCase().trim();
    
    // Remove special characters and split into words
    const words = name
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1);
    
    // Extract numbers (for things like '50kg', '1.5L')
    const numbers = name.match(/\d+/g);
    
    let code = '';
    
    // Strategy: Simple products (1-2 words) - use full or abbreviated form
    if (words.length === 1) {
      code = words[0].substring(0, 6).toUpperCase();
    } 
    else if (words.length === 2) {
      // Take first 3 chars of each word
      code = (words[0].substring(0, 3) + words[1].substring(0, 3)).toUpperCase();
    }
    // Complex products (3+ words) - use initials + numbers
    else {
      // Filter out common French articles
      const stopWords = ['de', 'du', 'la', 'le', 'les', 'un', 'une', 'des'];
      const important = words.filter(w => !stopWords.includes(w));
      
      // Take 2 letters from each important word (max 3 words)
      code = important
        .slice(0, 3)
        .map(w => w.substring(0, 2))
        .join('')
        .toUpperCase();
      
      // Add number if present (e.g., '50' from '50kg')
      if (numbers && numbers.length > 0) {
        code += numbers[0];
      }
    }
    
    // Ensure minimum length of 2 characters
    if (code.length < 2) {
      code = name.substring(0, 6).replace(/[^\w]/g, '').toUpperCase();
    }
    
    // Limit to 10 characters
    code = code.substring(0, 10);
    
    // Ensure uniqueness
    return await this.ensureUniqueCode(businessId, code);
  }

  /**
   * Ensure the code is unique within the business
   * If not, add a numeric suffix
   */
  private async ensureUniqueCode(businessId: string, baseCode: string): Promise<string> {
    let code = baseCode;
    let counter = 1;
    
    while (counter < 1000) {
      const existing = await this.stockItemRepository.findOne({
        where: {
          businessId,
          productCode: code,
        },
      });
      
      if (!existing) {
        return code;
      }
      
      // Try with numeric suffix
      code = `${baseCode}${counter}`;
      
      // If too long, truncate base
      if (code.length > 10) {
        const maxBaseLength = 10 - String(counter).length;
        const newBase = baseCode.substring(0, maxBaseLength);
        code = `${newBase}${counter}`;
      }
      
      counter++;
    }
    
    throw new BadRequestException('Unable to generate unique product code');
  }

  /**
   * Resolve a product by code or name
   * Tries code first (more specific), then falls back to name
   */
  async resolveProduct(businessId: string, identifier: string): Promise<StockItem | null> {
    // First, try to find by code (case-insensitive)
    let stockItem = await this.stockItemRepository.findOne({
      where: {
        businessId,
        productCode: identifier.toUpperCase(),
      },
    });

    // If not found by code, try by normalized name
    if (!stockItem) {
      const normalizedName = this.productNormalizer.normalize(identifier);
      const allItems = await this.stockItemRepository.find({
        where: { businessId },
      });

      stockItem = allItems.find(
        item => this.productNormalizer.normalize(item.product) === normalizedName
      ) || null;
    }

    return stockItem;
  }

  /**
   * Check if a product code already exists
   */
  async productCodeExists(businessId: string, productCode: string): Promise<boolean> {
    const count = await this.stockItemRepository.count({
      where: {
        businessId,
        productCode: productCode.toUpperCase(),
      },
    });
    
    return count > 0;
  }
}