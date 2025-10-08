import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Transaction, TransactionType } from '../transaction/entities/transaction.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Business } from '../auth/entities/business.entity';
import { ReportService } from '../report/report.service';
import { StockService } from '../stock/stock.service';

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
  ) { }

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
    return await this.transactionRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user']
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
      order: { product: 'ASC' }
    });
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