import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull } from 'typeorm';
import { Business } from './entities/business.entity';
import { User, UserRole } from './entities/user.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { StockService } from '../stock/stock.service';
import { ProductNormalizerService } from '../stock/services/product-normalizer.service';
import { StockItem } from '../stock/entities/stock-item.entity';

export interface PaginatedBusinesses {
  data: Business[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BusinessDetails {
  business: Business;
  owner: {
    id: string;
    employeeName: string | null;
    phoneNumber: string;
  } | null;
  statistics: {
    transactionCount: number;
    totalSales: number;
    totalExpenses: number;
    profit: number;
    userCount: number;
  };
}

@Injectable()
export class AdminBusinessService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(StockItem)
    private readonly stockItemRepository: Repository<StockItem>,
    private readonly stockService: StockService,
    private readonly productNormalizer: ProductNormalizerService,
  ) {}

  async getBusinessesPaginated(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<PaginatedBusinesses> {
    const skip = (page - 1) * limit;
    
    const queryBuilder = this.businessRepository
      .createQueryBuilder('business')
      .where('business.deletedAt IS NULL');

    if (search) {
      queryBuilder.andWhere(
        '(business.name LIKE :search OR business.businessCode LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [businesses, total] = await queryBuilder
      .orderBy('business.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: businesses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBusinessDetails(businessId: string): Promise<BusinessDetails> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Get owner (user with role='owner' and businessId matching)
    const owner = await this.userRepository.findOne({
      where: {
        businessId: business.id,
        role: UserRole.OWNER,
      },
      select: ['id', 'employeeName', 'phoneNumber'],
    });

    // Get statistics
    const [transactionCount, totalSales, totalExpenses, userCount] = await Promise.all([
      this.transactionRepository.count({ where: { businessId: business.id } }),
      this.getBusinessSales(business.id),
      this.getBusinessExpenses(business.id),
      this.userRepository.count({
        where: { businessId: business.id, isActive: true },
      }),
    ]);

    return {
      business,
      owner: owner
        ? {
            id: owner.id,
            employeeName: owner.employeeName,
            phoneNumber: owner.phoneNumber,
          }
        : null,
      statistics: {
        transactionCount,
        totalSales,
        totalExpenses,
        profit: totalSales - totalExpenses,
        userCount,
      },
    };
  }

  async blockBusiness(businessId: string, isActive: boolean): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    business.isActive = isActive;
    return await this.businessRepository.save(business);
  }

  async blockBusinessUsers(businessId: string, isActive: boolean): Promise<void> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    await this.userRepository.update(
      { businessId: business.id },
      { isActive },
    );
  }

  async deleteBusiness(businessId: string): Promise<void> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Soft delete
    business.deletedAt = new Date();
    await this.businessRepository.save(business);
  }

  private async getBusinessSales(businessId: string): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.businessId = :businessId', { businessId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .getRawOne();

    return Number(result?.total || 0);
  }

  private async getBusinessExpenses(businessId: string): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.businessId = :businessId', { businessId })
      .andWhere('transaction.type = :type', { type: 'expense' })
      .getRawOne();

    return Number(result?.total || 0);
  }

  /**
   * Create multiple products for a business in bulk
   * Products with existing names (case-insensitive) are skipped
   */
  async bulkCreateProducts(
    businessId: string,
    products: Array<{ name: string; quantity: number; unitPrice?: number }>,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Get existing products for this business to check for duplicates
    const existingStockItems = await this.stockService.getStock(businessId);
    const existingProductNames = new Set(
      existingStockItems.map(item => item.product.toLowerCase()),
    );

    for (const product of products) {
      try {
        // Validate product data
        if (!product.name || product.name.trim().length === 0) {
          errors.push(`Product name is required`);
          continue;
        }

        // Nettoyer le nom du produit (supprimer les guillemets français « »)
        const cleanedProductName = this.productNormalizer.cleanProductName(product.name);
        if (!cleanedProductName || cleanedProductName.trim().length === 0) {
          errors.push(`Product name is required`);
          continue;
        }

        if (product.quantity < 0 || isNaN(product.quantity)) {
          errors.push(`Invalid quantity for product "${cleanedProductName}": must be a number >= 0`);
          continue;
        }

        if (product.unitPrice !== undefined && (product.unitPrice < 0 || isNaN(product.unitPrice))) {
          errors.push(`Invalid unit price for product "${cleanedProductName}": must be a number >= 0`);
          continue;
        }

        // Normalize product name for comparison
        const normalizedName = this.productNormalizer.normalize(cleanedProductName);

        // Check if product already exists
        if (existingProductNames.has(normalizedName)) {
          skipped++;
          continue;
        }

        // Create the product
        // Use updateStock to create or update, which will handle product code generation
        await this.stockService.updateStock(
          businessId,
          cleanedProductName,
          Math.floor(product.quantity),
        );

        // Set unit price if provided
        if (product.unitPrice !== undefined) {
          await this.stockService.setUnitPrice(
            businessId,
            cleanedProductName,
            product.unitPrice,
          );
        }

        // Add to existing set to avoid duplicates in the same batch
        existingProductNames.add(normalizedName);
        created++;
      } catch (error) {
        const cleanedName = this.productNormalizer.cleanProductName(product.name) || product.name;
        errors.push(
          `Failed to create product "${cleanedName}": ${error.message}`,
        );
      }
    }

    return { created, skipped, errors };
  }

  /**
   * Get all products for a business
   */
  async getBusinessProducts(businessId: string) {
    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    try {
      const products = await this.stockService.getStock(businessId);
      return products || [];
    } catch (error) {
      // If no products found, return empty array instead of throwing
      if (error.message && error.message.includes('not found')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Create a single product for a business
   */
  async createProduct(
    businessId: string,
    productData: { name: string; quantity: number; unitPrice?: number },
  ) {
    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Validate product data
    if (!productData.name || productData.name.trim().length === 0) {
      throw new BadRequestException('Product name is required');
    }

    // Nettoyer le nom du produit (supprimer les guillemets français « »)
    const cleanedProductName = this.productNormalizer.cleanProductName(productData.name);
    if (!cleanedProductName || cleanedProductName.trim().length === 0) {
      throw new BadRequestException('Product name is required');
    }

    if (productData.quantity < 0 || isNaN(productData.quantity)) {
      throw new BadRequestException('Quantity must be a number >= 0');
    }

    if (productData.unitPrice !== undefined && (productData.unitPrice < 0 || isNaN(productData.unitPrice))) {
      throw new BadRequestException('Unit price must be a number >= 0');
    }

    // Check if product already exists
    const existingProducts = await this.stockService.getStock(businessId);
    const normalizedName = this.productNormalizer.normalize(cleanedProductName);
    const existing = existingProducts.find(p => this.productNormalizer.normalize(p.product) === normalizedName);

    if (existing) {
      throw new BadRequestException(`Product "${cleanedProductName}" already exists`);
    }

    // Create the product
    const stockItem = await this.stockService.updateStock(
      businessId,
      cleanedProductName,
      Math.floor(productData.quantity),
    );

    // Set unit price if provided
    if (productData.unitPrice !== undefined) {
      await this.stockService.setUnitPrice(
        businessId,
        cleanedProductName,
        productData.unitPrice,
      );
      // Reload to get updated price
      const updated = await this.stockService.getStock(businessId, cleanedProductName);
      return updated[0];
    }

    return stockItem;
  }

  /**
   * Update a product for a business
   */
  async updateProduct(
    businessId: string,
    productId: string,
    productData: { name?: string; quantity?: number; unitPrice?: number },
  ) {
    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Get existing product
    const existingProducts = await this.stockService.getStock(businessId);
    const product = existingProducts.find(p => p.id === productId);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Update name if provided
    if (productData.name !== undefined) {
      // Nettoyer le nom du produit (supprimer les guillemets français « »)
      const cleanedProductName = this.productNormalizer.cleanProductName(productData.name);
      if (!cleanedProductName || cleanedProductName.trim().length === 0) {
        throw new BadRequestException('Product name cannot be empty');
      }
      
      const normalizedName = this.productNormalizer.normalize(cleanedProductName);
      const currentNormalizedName = this.productNormalizer.normalize(product.product);
      
      // Only check for conflicts if the name is actually changing
      if (normalizedName !== currentNormalizedName) {
        // Check if new name conflicts with existing product
        const conflict = existingProducts.find(
          p => p.id !== productId && this.productNormalizer.normalize(p.product) === normalizedName
        );
        if (conflict) {
          throw new BadRequestException(`Product "${cleanedProductName}" already exists`);
        }
        
        // Update the product name directly in the database
        product.product = cleanedProductName.trim().toLowerCase();
        // Regenerate product code if needed
        if (!product.productCode) {
          product.productCode = await this.stockService.generateProductCode(businessId, product.product);
        }
        product.updatedAt = new Date();
        await this.stockItemRepository.save(product);
      }
    }

    // Update quantity if provided
    if (productData.quantity !== undefined) {
      if (productData.quantity < 0 || isNaN(productData.quantity)) {
        throw new BadRequestException('Quantity must be a number >= 0');
      }
      await this.stockService.updateStock(
        businessId,
        product.product,
        Math.floor(productData.quantity),
      );
    }

    // Update unit price if provided
    if (productData.unitPrice !== undefined) {
      if (productData.unitPrice < 0 || isNaN(productData.unitPrice)) {
        throw new BadRequestException('Unit price must be a number >= 0');
      }
      await this.stockService.setUnitPrice(
        businessId,
        product.product,
        productData.unitPrice,
      );
    }

    // Return updated product
    const updated = await this.stockService.getStock(businessId, product.product);
    return updated[0];
  }

  /**
   * Delete a product for a business
   */
  async deleteProduct(businessId: string, productId: string) {
    // Verify business exists
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });

    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Get existing product
    const existingProducts = await this.stockService.getStock(businessId);
    const product = existingProducts.find(p => p.id === productId);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Delete the product
    const result = await this.stockService.deleteProduct(businessId, product.product);
    return result;
  }
}

