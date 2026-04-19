import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, IsNull } from 'typeorm';
import { Transaction, TransactionType, PaymentMethod } from '../transaction/entities/transaction.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Business } from '../auth/entities/business.entity';
import { ReportService } from '../report/report.service';
import { StockService } from '../stock/stock.service';
import { ProductNormalizerService } from '../stock/services/product-normalizer.service';
import { TransactionService } from '../transaction/transaction.service';
import { StockMovementService } from '../stock/services/stock-movement.service';
import { ReceivableService } from '../receivable/receivable.service';

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
  // B2 — Synthèse comparative
  yesterdaySales: number;
  variationVsYesterday: number;
  averageLast7Days: number;
  variationVsAverage: number;
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

export interface TopProduct {
  product: string;
  totalRevenue: number;
  totalQuantity: number;
  transactionCount: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  recentTransactions: Transaction[];
  chartData: ChartDataPoint[];
  stockWarnings: StockWarning[];
  stockLevels: StockItem[];
  topProducts: TopProduct[];
}

export interface ExportData {
  transactions: Transaction[];
  summary: DashboardSummary;
  period: string;
  generatedAt: Date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

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
    private receivableService: ReceivableService,
    private dataSource: DataSource,
  ) {}

  /**
   * Get comprehensive dashboard data for a business
   * Requirements: 9.1, 9.2 - Dashboard with summary cards and data visualization
   */
  async getDashboardData(businessId: string): Promise<DashboardData> {
    const [summary, recentTransactions, chartData, stockWarnings, stockLevels, topProducts] =
      await Promise.all([
        this.getSummaryCards(businessId),
        this.getRecentTransactions(businessId, 10),
        this.getChartData(businessId, 7),
        this.getStockWarnings(businessId),
        this.getStockLevels(businessId),
        this.getTopProducts(businessId),
      ]);

    return {
      summary,
      recentTransactions,
      chartData,
      stockWarnings,
      stockLevels,
      topProducts,
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

    // B2 — Période hier
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart); // minuit = début de aujourd'hui

    // B2 — 7 derniers jours complets (hors aujourd'hui)
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch all transactions for the periods
    const [todayTransactions, weekTransactions, monthTransactions, yesterdayTransactions, last7DaysTransactions] =
      await Promise.all([
        this.transactionRepository.find({
          where: { businessId, createdAt: Between(todayStart, todayEnd) },
        }),
        this.transactionRepository.find({
          where: { businessId, createdAt: Between(weekStart, weekEnd) },
        }),
        this.transactionRepository.find({
          where: { businessId, createdAt: Between(monthStart, monthEnd) },
        }),
        this.transactionRepository.find({
          where: { businessId, createdAt: Between(yesterdayStart, yesterdayEnd) },
        }),
        this.transactionRepository.find({
          where: { businessId, createdAt: Between(sevenDaysAgo, todayStart) },
        }),
      ]);

    // Calculate totals for each period
    const calculateTotals = (transactions: Transaction[]) => {
      const sales = transactions
        .filter((t) => t.type === TransactionType.SALE)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const expenses = transactions
        .filter((t) => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return { sales, expenses, profit: sales - expenses };
    };

    const calcVariation = (current: number, reference: number): number => {
      if (reference === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - reference) / reference) * 100);
    };

    const todayTotals = calculateTotals(todayTransactions);
    const weekTotals = calculateTotals(weekTransactions);
    const monthTotals = calculateTotals(monthTransactions);
    const yesterdayTotals = calculateTotals(yesterdayTransactions);
    const last7DaysTotals = calculateTotals(last7DaysTransactions);

    // Moyenne journalière sur les 7 derniers jours complets
    const averageLast7Days = Math.round(last7DaysTotals.sales / 7);

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
      currency,
      // B2
      yesterdaySales: yesterdayTotals.sales,
      variationVsYesterday: calcVariation(todayTotals.sales, yesterdayTotals.sales),
      averageLast7Days,
      variationVsAverage: calcVariation(todayTotals.sales, averageLast7Days),
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
      quantity?: number;
      description?: string;
      paymentMethod?: PaymentMethod;
      creditSale?: { debtorName: string; debtorPhone?: string };
    },
  ): Promise<Transaction> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (data.type === TransactionType.SALE) {
      // Sale + stock decrement are atomic: if stock update fails, the transaction is rolled back.
      const transaction = await this.dataSource.transaction(async (manager) => {
        const savedTransaction = await this.transactionService.recordSale(
          businessId,
          userId,
          data.amount,
          data.product,
          data.description,
          data.quantity,
          !!data.creditSale?.debtorName?.trim(),
          manager,
          data.paymentMethod,
        );

        if (data.product?.trim() && data.quantity != null && data.quantity > 0) {
          await this.stockService.decrementStock(
            businessId,
            data.product.trim(),
            data.quantity,
            userId,
            data.amount,
          );
        }

        return savedTransaction;
      });

      // Receivable creation is best-effort: a credit sale is valid even if this secondary
      // record fails. Log the error loudly so it doesn't go unnoticed.
      if (data.creditSale?.debtorName?.trim()) {
        try {
          await this.receivableService.create(businessId, userId, {
            debtorName: data.creditSale.debtorName.trim(),
            debtorPhone: data.creditSale.debtorPhone?.trim(),
            amount: data.amount,
            description: data.product
              ? `${data.product}${data.quantity != null ? ` × ${data.quantity}` : ''}`
              : data.description,
          });
        } catch (err) {
          this.logger.error(
            `[createTransaction] Receivable creation failed for transaction ${transaction.id}. ` +
            `Debtor: ${data.creditSale.debtorName}. Manual reconciliation may be required.`,
            err,
          );
        }
      }

      return transaction;
    }
    return this.transactionService.recordExpense(
      businessId,
      userId,
      data.amount,
      data.product,
      data.description,
      data.paymentMethod,
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

  /**
   * B3 — Top produits par CA sur une période donnée.
   * Utilise une requête agrégée plutôt qu'un chargement en mémoire pour la performance.
   */
  async getTopProducts(
    businessId: string,
    period: 'day' | 'week' | 'month' = 'week',
    limit: number = 5,
  ): Promise<TopProduct[]> {
    const now = new Date();
    let start: Date;

    if (period === 'day') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.product', 'product')
      .addSelect('SUM(t.amount)', 'totalRevenue')
      .addSelect('SUM(COALESCE(t.quantity, 1))', 'totalQuantity')
      .addSelect('COUNT(t.id)', 'transactionCount')
      .where('t.businessId = :businessId', { businessId })
      .andWhere('t.type = :type', { type: TransactionType.SALE })
      .andWhere('t.product IS NOT NULL')
      .andWhere('t.createdAt >= :start', { start })
      .groupBy('t.product')
      .orderBy('"totalRevenue"', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      product: r.product,
      totalRevenue: Number(r.totalRevenue),
      totalQuantity: Number(r.totalQuantity),
      transactionCount: Number(r.transactionCount),
    }));
  }
}