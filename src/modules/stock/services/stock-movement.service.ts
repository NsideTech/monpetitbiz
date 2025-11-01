import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { StockMovement, MovementType } from '../entities/stock-movement.entity';
import { StockItem } from '../entities/stock-item.entity';

export interface RecordMovementData {
  businessId: string;
  productName: string;
  movementType: MovementType;
  quantity: number;
  unit: string;
  baseQuantity: number;
  unitPrice?: number;
  totalAmount?: number;
  notes?: string;
  createdBy: string;
}

export interface MovementHistoryFilter {
  businessId: string;
  productName?: string;
  movementType?: MovementType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface StockBalanceResult {
  productName: string;
  calculatedBalance: number;
  actualStock: number;
  isConsistent: boolean;
  discrepancy?: number;
}

@Injectable()
export class StockMovementService {
  constructor(
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(StockItem)
    private stockItemRepository: Repository<StockItem>,
  ) {}

  /**
   * Record a stock movement
   * Requirements: 7.1, 7.2, 7.4, 7.5
   */
  async recordMovement(data: RecordMovementData): Promise<StockMovement> {
    // Validation
    if (!data.businessId || !data.productName || !data.createdBy) {
      throw new BadRequestException('Business ID, product name, and created by are required');
    }

    if (data.quantity <= 0 || data.baseQuantity <= 0) {
      throw new BadRequestException('Quantities must be positive');
    }

    if (!Object.values(MovementType).includes(data.movementType)) {
      throw new BadRequestException('Invalid movement type');
    }

    // Get current stock to calculate previous and new stock
    const currentStock = await this.getCurrentStock(data.businessId, data.productName);
    
    let newStock: number;
    switch (data.movementType) {
      case MovementType.PURCHASE:
      case MovementType.ADJUSTMENT:
        newStock = currentStock + data.baseQuantity;
        break;
      case MovementType.SALE:
      case MovementType.LOSS:
        newStock = Math.max(0, currentStock - data.baseQuantity);
        break;
      default:
        throw new BadRequestException('Unsupported movement type');
    }

    // Create the movement record
    const movement = this.stockMovementRepository.create({
      businessId: data.businessId,
      productName: data.productName.toLowerCase().trim(),
      movementType: data.movementType,
      quantity: data.quantity,
      unit: data.unit,
      baseQuantity: data.baseQuantity,
      unitPrice: data.unitPrice,
      totalAmount: data.totalAmount,
      previousStock: currentStock,
      newStock: newStock,
      notes: data.notes,
      createdBy: data.createdBy,
    });

    return await this.stockMovementRepository.save(movement);
  }

  /**
   * Get movement history with filtering and pagination
   * Requirements: 7.1, 7.2, 7.3
   */
  async getMovementHistory(filter: MovementHistoryFilter): Promise<StockMovement[]> {
    if (!filter.businessId) {
      throw new BadRequestException('Business ID is required');
    }

    const queryBuilder = this.stockMovementRepository
      .createQueryBuilder('movement')
      .where('movement.businessId = :businessId', { businessId: filter.businessId });

    // Apply filters
    if (filter.productName) {
      queryBuilder.andWhere('movement.productName = :productName', { 
        productName: filter.productName.toLowerCase().trim() 
      });
    }

    if (filter.movementType) {
      queryBuilder.andWhere('movement.movementType = :movementType', { 
        movementType: filter.movementType 
      });
    }

    if (filter.startDate && filter.endDate) {
      queryBuilder.andWhere('movement.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filter.startDate,
        endDate: filter.endDate
      });
    } else if (filter.startDate) {
      queryBuilder.andWhere('movement.createdAt >= :startDate', { startDate: filter.startDate });
    } else if (filter.endDate) {
      queryBuilder.andWhere('movement.createdAt <= :endDate', { endDate: filter.endDate });
    }

    // Apply pagination
    if (filter.limit) {
      queryBuilder.limit(filter.limit);
    }

    if (filter.offset) {
      queryBuilder.offset(filter.offset);
    }

    // Order by most recent first
    queryBuilder.orderBy('movement.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }

  /**
   * Get movement history by date range
   * Requirements: 7.1, 7.2
   */
  async getMovementsByDateRange(
    businessId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<StockMovement[]> {
    return await this.getMovementHistory({
      businessId,
      startDate,
      endDate
    });
  }

  /**
   * Calculate stock balance for consistency verification
   * Requirements: 7.3, 7.4, 7.5
   */
  async calculateStockBalance(businessId: string, productName: string): Promise<StockBalanceResult> {
    if (!businessId || !productName) {
      throw new BadRequestException('Business ID and product name are required');
    }

    const normalizedProductName = productName.toLowerCase().trim();

    // Get all movements for this product
    const movements = await this.stockMovementRepository.find({
      where: { 
        businessId, 
        productName: normalizedProductName 
      },
      order: { createdAt: 'ASC' }
    });

    // Calculate balance from movements
    let calculatedBalance = 0;
    for (const movement of movements) {
      switch (movement.movementType) {
        case MovementType.PURCHASE:
        case MovementType.ADJUSTMENT:
          calculatedBalance += movement.baseQuantity;
          break;
        case MovementType.SALE:
        case MovementType.LOSS:
          calculatedBalance -= movement.baseQuantity;
          break;
      }
    }

    // Ensure balance doesn't go negative
    calculatedBalance = Math.max(0, calculatedBalance);

    // Get actual stock from stock_items table
    const actualStock = await this.getCurrentStock(businessId, normalizedProductName);

    // Check consistency
    const isConsistent = Math.abs(calculatedBalance - actualStock) < 0.01; // Allow for small floating point differences
    const discrepancy = isConsistent ? undefined : actualStock - calculatedBalance;

    return {
      productName: normalizedProductName,
      calculatedBalance,
      actualStock,
      isConsistent,
      discrepancy
    };
  }

  /**
   * Get recent movements for a product (last 10 by default)
   * Requirements: 7.1, 7.2
   */
  async getRecentMovements(
    businessId: string, 
    productName?: string, 
    limit: number = 10
  ): Promise<StockMovement[]> {
    return await this.getMovementHistory({
      businessId,
      productName,
      limit
    });
  }

  /**
   * Get movements by type
   * Requirements: 7.1, 7.2
   */
  async getMovementsByType(
    businessId: string, 
    movementType: MovementType, 
    limit?: number
  ): Promise<StockMovement[]> {
    return await this.getMovementHistory({
      businessId,
      movementType,
      limit
    });
  }

  /**
   * Get total quantity moved for a product in a date range
   * Requirements: 7.1, 7.2, 7.3
   */
  async getTotalMovementQuantity(
    businessId: string,
    productName: string,
    movementType: MovementType,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const movements = await this.getMovementHistory({
      businessId,
      productName,
      movementType,
      startDate,
      endDate
    });

    return movements.reduce((total, movement) => total + movement.baseQuantity, 0);
  }

  /**
   * Get movement statistics for a business
   * Requirements: 7.1, 7.2, 7.3
   */
  async getMovementStatistics(businessId: string, days: number = 30): Promise<{
    totalPurchases: number;
    totalSales: number;
    totalAdjustments: number;
    totalLosses: number;
    mostActiveProducts: Array<{ productName: string; movementCount: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const movements = await this.getMovementsByDateRange(businessId, startDate, new Date());

    const stats = {
      totalPurchases: 0,
      totalSales: 0,
      totalAdjustments: 0,
      totalLosses: 0,
      mostActiveProducts: [] as Array<{ productName: string; movementCount: number }>
    };

    const productCounts: Record<string, number> = {};

    for (const movement of movements) {
      // Count by type
      switch (movement.movementType) {
        case MovementType.PURCHASE:
          stats.totalPurchases += movement.baseQuantity;
          break;
        case MovementType.SALE:
          stats.totalSales += movement.baseQuantity;
          break;
        case MovementType.ADJUSTMENT:
          stats.totalAdjustments += movement.baseQuantity;
          break;
        case MovementType.LOSS:
          stats.totalLosses += movement.baseQuantity;
          break;
      }

      // Count by product
      productCounts[movement.productName] = (productCounts[movement.productName] || 0) + 1;
    }

    // Get most active products (top 5)
    stats.mostActiveProducts = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([productName, movementCount]) => ({ productName, movementCount }));

    return stats;
  }

  /**
   * Helper method to get current stock for a product
   */
  private async getCurrentStock(businessId: string, productName: string): Promise<number> {
    const stockItem = await this.stockItemRepository.findOne({
      where: { 
        businessId, 
        product: productName.toLowerCase().trim() 
      }
    });

    return stockItem ? stockItem.quantity : 0;
  }
}