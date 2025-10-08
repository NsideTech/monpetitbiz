import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockItem } from './entities/stock-item.entity';

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
    if (quantity <= 0) {
      throw new BadRequestException('Decrement quantity must be positive');
    }

    if (!product || product.trim().length === 0) {
      return false; // No product specified, skip stock decrement
    }

    const normalizedProduct = product.trim().toLowerCase();

    const stockItem = await this.stockItemRepository.findOne({
      where: { businessId, product: normalizedProduct }
    });

    if (!stockItem) {
      // Product not in stock system, skip decrement
      return false;
    }

    if (stockItem.quantity < quantity) {
      // Insufficient stock, but allow the sale to proceed
      // Set stock to 0 and return false to indicate insufficient stock
      stockItem.quantity = 0;
      stockItem.updatedAt = new Date();
      await this.stockItemRepository.save(stockItem);
      return false;
    }

    // Sufficient stock, decrement
    stockItem.quantity -= quantity;
    stockItem.updatedAt = new Date();
    await this.stockItemRepository.save(stockItem);
    return true;
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

    const normalizedProduct = product.trim().toLowerCase();
    const stockItem = await this.stockItemRepository.findOne({
      where: { businessId, product: normalizedProduct }
    });

    return stockItem ? stockItem.quantity : 0;
  }

  /**
   * Check if product has sufficient stock
   */
  async hasSufficientStock(businessId: string, product: string, requiredQuantity: number = 1): Promise<boolean> {
    const currentStock = await this.getStockLevel(businessId, product);
    return currentStock >= requiredQuantity;
  }
}