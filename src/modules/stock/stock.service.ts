import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockItem } from './entities/stock-item.entity';
import { ProductNormalizerService } from './services/product-normalizer.service';

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
  ) {}

  /**
   * Update stock quantity for a product
   * Requirement 3.1: WHEN l'utilisateur envoie "stock pain 50" THEN le système SHALL mettre à jour la quantité du produit à 50 unités
   */
  async updateStock(businessId: string, product: string, quantity: number): Promise<StockItem> {
    if (quantity < 0) {
      throw new BadRequestException('Stock quantity cannot be negative');
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
      stockItem.quantity = quantity;
      stockItem.updatedAt = new Date();
    } else {
      stockItem = this.stockItemRepository.create({
        businessId,
        product: normalizedProduct,
        quantity,
      });
    }

    return await this.stockItemRepository.save(stockItem);
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
   * Decrement stock when a sale is made
   * Requirement 3.4: WHEN une vente est enregistrée avec un produit THEN le système SHALL automatiquement décrémenter le stock si disponible
   */
  async decrementStock(businessId: string, product: string, quantity: number = 1): Promise<boolean> {
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
      const originalQuantity = stockItem.quantity;
      stockItem.quantity = 0;
      stockItem.updatedAt = new Date();
      
      try {
        const savedItem = await this.stockItemRepository.save(stockItem);
        console.log(`[StockService] Stock updated from ${originalQuantity} to ${savedItem.quantity} for ${savedItem.product}`);
        return false;
      } catch (error) {
        console.error(`[StockService] Error saving stock item:`, error);
        throw error;
      }
    }

    // Sufficient stock, decrement
    const originalQuantity = stockItem.quantity;
    stockItem.quantity -= quantity;
    stockItem.updatedAt = new Date();
    
    try {
      const savedItem = await this.stockItemRepository.save(stockItem);
      console.log(`[StockService] Stock successfully decremented from ${originalQuantity} to ${savedItem.quantity} for ${savedItem.product}`);
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
  async addStock(businessId: string, product: string, quantity: number): Promise<StockItem> {
    if (quantity <= 0) {
      throw new BadRequestException('Add quantity must be positive');
    }

    const normalizedProduct = product.trim().toLowerCase();

    const existingStock = await this.stockItemRepository.findOne({
      where: { businessId, product: normalizedProduct }
    });

    if (existingStock) {
      existingStock.quantity += quantity;
      existingStock.updatedAt = new Date();
      return await this.stockItemRepository.save(existingStock);
    } else {
      return await this.updateStock(businessId, product, quantity);
    }
  }

  /**
   * Get stock level for a specific product (returns 0 if not found)
   */
  async getStockLevel(businessId: string, product: string): Promise<number> {
    if (!product || product.trim().length === 0) {
      return 0;
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
      return stockItem ? stockItem.quantity : 0;
    }

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
    } else {
      stockItem = this.stockItemRepository.create({
        businessId,
        product: normalizedProduct,
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
   * Get all products with their stock and prices (for product list command)
   */
  async getAllProductsWithPrices(businessId: string): Promise<Array<{
    product: string;
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
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      stockStatus: item.quantity === 0 ? 'out' : (item.quantity <= 5 ? 'low' : 'ok')
    }));
  }
}