import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull } from 'typeorm';
import { Transaction, TransactionType } from '../transaction/entities/transaction.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Business } from '../auth/entities/business.entity';
import { ReportService } from '../report/report.service';
import { StockService } from '../stock/stock.service';
import { ProductNormalizerService } from '../stock/services/product-normalizer.service';
import { TransactionService } from '../transaction/transaction.service';
import { StockMovementService } from '../stock/services/stock-movement.service';

export interface DashboardSummary {
  todaySales: number;
  todayExpenses: number;
  todayProfit: number;
  weekSales: number;
  weekExpenses: number;
  weekProfit: number;
  monthSales: number;
  monthExpenses: number;
  monthProfit: number;
  currency: string;
}

export interface ChartDataPoint {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
}

export interface StockWarning {
  product: string;
  currentQuantity: number;
  warningLevel: number;
  status: 'low' | 'out';
  message: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  recentTransactions: Transaction[];
  chartData: ChartDataPoint[];
  stockWarnings: StockWarning[];
  stockLevels: StockItem[];
}

export interface ExportData {
  transactions: Transaction[];
  summary: DashboardSummary;
  period: string;
  generatedAt: Date;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(StockItem)
    private stockRepository: Repository<StockItem>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    private reportService: ReportService,
    private stockService: StockService,
    private productNormalizer: ProductNormalizerService,
    private transactionService: TransactionService,
    private stockMovementService: StockMovementService,
  ) {}

  /**
   * Get comprehensive dashboard data for a business
   * Requirements: 9.1, 9.2 - Dashboard with summary cards and data visualization
   */
  async getDashboardData(businessId: string): Promise<DashboardData> {
    const [summary, recentTransactions, chartData, stockWarnings, stockLevels] = await Promise.all([
      this.getSummaryCards(businessId),
      this.getRecentTransactions(businessId, 10),
      this.getChartData(businessId, 7), // Last 7 days
      this.getStockWarnings(businessId),
      this.getStockLevels(businessId)
    ]);

    return {
      summary,
      recentTransactions,
      chartData,
      stockWarnings,
      stockLevels
    };
  }

  /**
   * Generate summary cards for daily/weekly/monthly totals
   * Requirements: 9.1 - Summary cards for different periods
   */
  async getSummaryCards(businessId: string): Promise<DashboardSummary> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId }
    });
    const currency = business?.currency || 'XOF';

    // Get today's data
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get this week's data
    const weekStart = new Date();
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);

    // Get this month's data
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date();
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    // Fetch all transactions for the periods
    const [todayTransactions, weekTransactions, monthTransactions] = await Promise.all([
      this.transactionRepository.find({
        where: { businessId, createdAt: Between(todayStart, todayEnd) }
      }),
      this.transactionRepository.find({
        where: { businessId, createdAt: Between(weekStart, weekEnd) }
      }),
      this.transactionRepository.find({
        where: { businessId, createdAt: Between(monthStart, monthEnd) }
      })
    ]);

    // Calculate totals for each period
    const calculateTotals = (transactions: Transaction[]) => {
      const sales = transactions
        .filter(t => t.type === TransactionType.SALE)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const expenses = transactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return { sales, expenses, profit: sales - expenses };
    };

    const todayTotals = calculateTotals(todayTransactions);
    const weekTotals = calculateTotals(weekTransactions);
    const monthTotals = calculateTotals(monthTransactions);

    return {
      todaySales: todayTotals.sales,
      todayExpenses: todayTotals.expenses,
      todayProfit: todayTotals.profit,
      weekSales: weekTotals.sales,
      weekExpenses: weekTotals.expenses,
      weekProfit: weekTotals.profit,
      monthSales: monthTotals.sales,
      monthExpenses: monthTotals.expenses,
      monthProfit: monthTotals.profit,
      currency
    };
  }

  /**
   * Get chart data for sales and expense trends
   * Requirements: 9.2 - Simple charts for sales and expense trends
   */
  async getChartData(businessId: string, days: number = 7): Promise<ChartDataPoint[]> {
    const chartData: ChartDataPoint[] = [];
    const endDate = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(endDate.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      nextDate.setHours(0, 0, 0, 0);

      const dayTransactions = await this.transactionRepository.find({
        where: {
          businessId,
          createdAt: Between(date, nextDate)
        }
      });

      const sales = dayTransactions
        .filter(t => t.type === TransactionType.SALE)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expenses = dayTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      chartData.push({
        date: date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        sales,
        expenses,
        profit: sales - expenses
      });
    }

    return chartData;
  }

  /**
   * Get recent transactions for display
   */
  async getRecentTransactions(businessId: string, limit: number = 10): Promise<Transaction[]> {
    return await this.getTransactions(businessId, { limit });
  }

  /**
   * Get transactions with optional filters (type, startDate, endDate, limit, offset)
   */
  async getTransactions(
    businessId: string,
    filters: {
      type?: TransactionType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<Transaction[]> {
    const { type, startDate, endDate, limit = 50, offset = 0 } = filters;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.user', 'user')
      .where('transaction.businessId = :businessId', { businessId })
      .orderBy('transaction.createdAt', 'DESC');

    if (type) {
      queryBuilder.andWhere('transaction.type = :type', { type });
    }

    if (startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', { endDate });
    }

    queryBuilder.take(limit).skip(offset);

    return queryBuilder.getMany();
  }

  /**
   * Create a transaction (sale or expense) from mobile
   */
  async createTransaction(
    businessId: string,
    userId: string,
    data: {
      type: TransactionType;
      amount: number;
      product?: string;
      description?: string;
    },
  ): Promise<Transaction> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (data.type === TransactionType.SALE) {
      return this.transactionService.recordSale(
        businessId,
        userId,
        data.amount,
        data.product,
        data.description,
      );
    }
    return this.transactionService.recordExpense(
      businessId,
      userId,
      data.amount,
      data.product,
      data.description,
    );
  }

  /**
   * Adjust stock quantity for a product (mobile)
   */
  async adjustStock(
    businessId: string,
    productId: string,
    newQuantity: number,
    userId: string,
  ): Promise<StockItem> {
    const stockItems = await this.stockService.getStock(businessId);
    const product = stockItems.find((p) => p.id === productId);
    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }
    if (newQuantity < 0 || !Number.isInteger(newQuantity)) {
      throw new BadRequestException('La quantité doit être un entier >= 0');
    }
    return this.stockService.updateStock(
      businessId,
      product.product,
      newQuantity,
      userId,
    );
  }

  /**
   * Get stock movement history (mobile)
   */
  async getStockMovements(
    businessId: string,
    filters: { productId?: string; limit?: number; offset?: number } = {},
  ): Promise<import('../stock/entities/stock-movement.entity').StockMovement[]> {
    const { productId, limit = 50, offset = 0 } = filters;
    let productName: string | undefined;
    if (productId) {
      const stockItems = await this.stockService.getStock(businessId);
      const product = stockItems.find((p) => p.id === productId);
      if (!product) {
        throw new NotFoundException('Produit non trouvé');
      }
      productName = product.product;
    }
    return this.stockMovementService.getMovementHistory({
      businessId,
      productName,
      limit,
      offset,
    });
  }

  /**
   * Get stock level display with low stock warnings
   * Requirements: 9.2 - Stock level display with low stock warnings
   */
  async getStockWarnings(businessId: string, warningThreshold: number = 5): Promise<StockWarning[]> {
    const stockItems = await this.stockRepository.find({
      where: { businessId },
      order: { product: 'ASC' }
    });

    return stockItems
      .filter(item => item.quantity <= warningThreshold)
      .map(item => ({
        product: item.product,
        currentQuantity: item.quantity,
        warningLevel: warningThreshold,
        status: item.quantity === 0 ? 'out' as const : 'low' as const,
        message: item.quantity === 0
          ? `${item.product} est en rupture de stock`
          : `${item.product} est bientôt épuisé (${item.quantity} restant)`
      }));
  }

  /**
   * Get all stock levels for display
   */
  async getStockLevels(businessId: string): Promise<StockItem[]> {
    return await this.stockRepository.find({
      where: { businessId },
      order: { product: 'ASC' },
    });
  }

  /**
   * Create a product (mobile)
   */
  async createProduct(
    businessId: string,
    productData: { name: string; quantity: number; unitPrice?: number },
  ): Promise<StockItem> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException(`Business not found`);
    }

    const cleanedName = this.productNormalizer.cleanProductName(productData.name);
    if (!cleanedName?.trim()) {
      throw new BadRequestException('Le nom du produit est requis');
    }

    const existing = await this.stockService.getStock(businessId);
    const normalized = this.productNormalizer.normalize(cleanedName);
    const conflict = existing.find(
      (p) => this.productNormalizer.normalize(p.product) === normalized,
    );
    if (conflict) {
      throw new BadRequestException(`Le produit "${cleanedName}" existe déjà`);
    }

    const stockItem = await this.stockService.updateStock(
      businessId,
      cleanedName,
      Math.floor(productData.quantity ?? 0),
    );

    if (productData.unitPrice !== undefined && productData.unitPrice >= 0) {
      await this.stockService.setUnitPrice(
        businessId,
        cleanedName,
        productData.unitPrice,
      );
      const updated = await this.stockService.getStock(businessId, cleanedName);
      return updated[0];
    }

    return stockItem;
  }

  /**
   * Update a product (mobile)
   */
  async updateProduct(
    businessId: string,
    productId: string,
    productData: { name?: string; quantity?: number; unitPrice?: number },
  ): Promise<StockItem> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException(`Business not found`);
    }

    const existing = await this.stockService.getStock(businessId);
    const product = existing.find((p) => p.id === productId);
    if (!product) {
      throw new NotFoundException(`Produit non trouvé`);
    }

    if (productData.name !== undefined) {
      const cleanedName = this.productNormalizer.cleanProductName(productData.name);
      if (!cleanedName?.trim()) {
        throw new BadRequestException('Le nom du produit ne peut pas être vide');
      }
      const normalized = this.productNormalizer.normalize(cleanedName);
      const currentNorm = this.productNormalizer.normalize(product.product);
      if (normalized !== currentNorm) {
        const conflict = existing.find(
          (p) => p.id !== productId && this.productNormalizer.normalize(p.product) === normalized,
        );
        if (conflict) {
          throw new BadRequestException(`Le produit "${cleanedName}" existe déjà`);
        }
        product.product = cleanedName.trim().toLowerCase();
        product.updatedAt = new Date();
        await this.stockRepository.save(product);
      }
    }

    if (productData.quantity !== undefined) {
      if (productData.quantity < 0 || isNaN(productData.quantity)) {
        throw new BadRequestException('La quantité doit être >= 0');
      }
      await this.stockService.updateStock(
        businessId,
        product.product,
        Math.floor(productData.quantity),
        undefined,
      );
    }

    if (productData.unitPrice !== undefined) {
      if (productData.unitPrice < 0 || isNaN(productData.unitPrice)) {
        throw new BadRequestException('Le prix doit être >= 0');
      }
      await this.stockService.setUnitPrice(
        businessId,
        product.product,
        productData.unitPrice,
      );
    }

    const updated = await this.stockService.getStock(businessId, product.product);
    return updated[0];
  }

  /**
   * Delete a product (mobile)
   */
  async deleteProduct(
    businessId: string,
    productId: string,
  ): Promise<{ success: boolean; message: string }> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException(`Business not found`);
    }

    const existing = await this.stockService.getStock(businessId);
    const product = existing.find((p) => p.id === productId);
    if (!product) {
      throw new NotFoundException(`Produit non trouvé`);
    }

    return await this.stockService.deleteProduct(businessId, product.product);
  }

  /**
   * Export transaction data with summary
   * Requirements: 9.2 - Export functionality for transaction data
   */
  async exportTransactionData(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ExportData> {
    // Default to current month if no dates provided
    if (!startDate || !endDate) {
      startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);
    }

    const transactions = await this.transactionRepository.find({
      where: {
        businessId,
        createdAt: Between(startDate, endDate)
      },
      order: { createdAt: 'DESC' },
      relations: ['user']
    });

    const summary = await this.getSummaryCards(businessId);

    return {
      transactions,
      summary,
      period: `${startDate.toLocaleDateString('fr-FR')} - ${endDate.toLocaleDateString('fr-FR')}`,
      generatedAt: new Date()
    };
  }

  /**
   * Export data as CSV format
   */
  async exportTransactionDataAsCSV(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    const exportData = await this.exportTransactionData(businessId, startDate, endDate);

    // CSV headers
    const headers = [
      'Date',
      'Type',
      'Montant',
      'Devise',
      'Produit',
      'Description',
      'Utilisateur'
    ];

    // CSV rows
    const rows = exportData.transactions.map(transaction => [
      transaction.createdAt.toLocaleDateString('fr-FR'),
      transaction.type === TransactionType.SALE ? 'Vente' : 'Dépense',
      transaction.amount.toString(),
      transaction.currency,
      transaction.product || '',
      transaction.description || '',
      transaction.user?.phoneNumber || ''
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Get dashboard metrics for a specific period
   */
  async getDashboardMetrics(
    businessId: string,
    period: 'day' | 'week' | 'month' = 'day'
  ): Promise<{
    totalSales: number;
    totalExpenses: number;
    netProfit: number;
    transactionCount: number;
    topProducts: Array<{ product: string; revenue: number; count: number }>;
  }> {
    let startDate: Date;
    let endDate: Date;

    const now = new Date();

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'week':
        startDate = new Date(now);
        const dayOfWeek = startDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToMonday);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    const transactions = await this.transactionRepository.find({
      where: {
        businessId,
        createdAt: Between(startDate, endDate)
      }
    });

    const salesTransactions = transactions.filter(t => t.type === TransactionType.SALE);
    const expenseTransactions = transactions.filter(t => t.type === TransactionType.EXPENSE);

    const totalSales = salesTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate top products
    const productMap = new Map<string, { revenue: number; count: number }>();
    salesTransactions.forEach(transaction => {
      if (transaction.product) {
        const existing = productMap.get(transaction.product);
        if (existing) {
          existing.revenue += Number(transaction.amount);
          existing.count += 1;
        } else {
          productMap.set(transaction.product, {
            revenue: Number(transaction.amount),
            count: 1
          });
        }
      }
    });

    const topProducts = Array.from(productMap.entries())
      .map(([product, data]) => ({ product, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalSales,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
      transactionCount: transactions.length,
      topProducts
    };
  }
}