import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Transaction, TransactionType } from '../transaction/entities/transaction.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Business } from '../auth/entities/business.entity';
import { 
  BalanceReport, 
  ProductPerformance, 
  PeriodMetrics, 
  ReportPeriod, 
  GenerateReportDto 
} from './dto/report.dto';
import { PDFGenerationService, PDFResult } from './services/pdf-generation.service';
import { TwilioWhatsAppService } from '../whatsapp/services/twilio-whatsapp.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(StockItem)
    private stockRepository: Repository<StockItem>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    private pdfGenerationService: PDFGenerationService,
    private twilioWhatsAppService: TwilioWhatsAppService,
  ) {}

  /**
   * Generate a comprehensive balance report for a specific period
   */
  async generateBalanceReport(dto: GenerateReportDto): Promise<BalanceReport> {
    const { businessId, period, startDate, endDate, includeTopProducts, topProductsLimit } = dto;
    
    // Calculate period dates if not provided
    const { start, end } = this.calculatePeriodDates(period, startDate, endDate);
    
    // Get business for currency info
    const business = await this.businessRepository.findOne({ 
      where: { id: businessId } 
    });
    
    if (!business) {
      throw new Error(`Business with ID ${businessId} not found`);
    }

    // Get all transactions for the period
    const transactions = await this.transactionRepository.find({
      where: {
        businessId,
        createdAt: Between(start, end)
      },
      order: { createdAt: 'DESC' }
    });

    // Calculate basic metrics
    const salesTransactions = transactions.filter(t => t.type === TransactionType.SALE);
    const expenseTransactions = transactions.filter(t => t.type === TransactionType.EXPENSE);
    
    const totalSales = salesTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const netProfit = totalSales - totalExpenses;

    // Generate top products if requested
    let topProducts: ProductPerformance[] = [];
    if (includeTopProducts) {
      topProducts = await this.calculateTopProducts(
        salesTransactions, 
        topProductsLimit || 5
      );
    }

    return {
      period: this.formatPeriodString(period, start, end),
      startDate: start,
      endDate: end,
      totalSales,
      totalExpenses,
      netProfit,
      transactionCount: transactions.length,
      salesCount: salesTransactions.length,
      expenseCount: expenseTransactions.length,
      currency: business.currency || 'XOF',
      topProducts: topProducts.length > 0 ? topProducts : undefined
    };
  }

  /**
   * Generate daily report for a business
   */
  async generateDailyReport(businessId: string): Promise<BalanceReport> {
    return this.generateBalanceReport({
      businessId,
      period: ReportPeriod.DAY,
      includeTopProducts: true,
      topProductsLimit: 3
    });
  }

  /**
   * Generate weekly report for a business
   */
  async generateWeeklyReport(businessId: string): Promise<BalanceReport> {
    return this.generateBalanceReport({
      businessId,
      period: ReportPeriod.WEEK,
      includeTopProducts: true,
      topProductsLimit: 5
    });
  }

  /**
   * Generate monthly report for a business
   */
  async generateMonthlyReport(businessId: string): Promise<BalanceReport> {
    return this.generateBalanceReport({
      businessId,
      period: ReportPeriod.MONTH,
      includeTopProducts: true,
      topProductsLimit: 10
    });
  }

  /**
   * Generate yearly report for a business
   */
  async generateYearlyReport(businessId: string): Promise<BalanceReport> {
    return this.generateBalanceReport({
      businessId,
      period: ReportPeriod.YEAR,
      includeTopProducts: true,
      topProductsLimit: 10
    });
  }

  /**
   * Get period-based metrics for trend analysis
   */
  async getPeriodMetrics(
    businessId: string, 
    period: ReportPeriod, 
    periodsCount: number = 7
  ): Promise<PeriodMetrics[]> {
    const metrics: PeriodMetrics[] = [];
    const now = new Date();

    for (let i = periodsCount - 1; i >= 0; i--) {
      const { start, end } = this.calculateOffsetPeriodDates(period, i, now);
      
      const transactions = await this.transactionRepository.find({
        where: {
          businessId,
          createdAt: Between(start, end)
        }
      });

      const sales = transactions
        .filter(t => t.type === TransactionType.SALE)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const expenses = transactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      metrics.push({
        date: this.formatDateForMetrics(start, period),
        sales,
        expenses,
        profit: sales - expenses,
        transactionCount: transactions.length
      });
    }

    return metrics;
  }

  /**
   * Calculate top performing products based on revenue
   */
  private async calculateTopProducts(
    salesTransactions: Transaction[], 
    limit: number
  ): Promise<ProductPerformance[]> {
    const productMap = new Map<string, ProductPerformance>();

    // Aggregate product data (use transaction.quantity when available)
    salesTransactions.forEach(transaction => {
      if (!transaction.product) return;

      const qty = transaction.quantity != null && transaction.quantity > 0
        ? Number(transaction.quantity)
        : 1;
      const amt = Number(transaction.amount) || 0;

      const existing = productMap.get(transaction.product);
      if (existing) {
        existing.revenue += amt;
        existing.transactionCount += 1;
        existing.quantity += qty;
      } else {
        productMap.set(transaction.product, {
          product: transaction.product,
          revenue: amt,
          quantity: qty,
          transactionCount: 1
        });
      }
    });

    // Sort by revenue and return top products
    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Calculate period start and end dates
   */
  private calculatePeriodDates(
    period: ReportPeriod, 
    startDate?: Date, 
    endDate?: Date
  ): { start: Date; end: Date } {
    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
      case ReportPeriod.DAY:
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      
      case ReportPeriod.WEEK:
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start.setDate(now.getDate() - daysToMonday);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      
      case ReportPeriod.MONTH:
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;

      case ReportPeriod.YEAR:
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11);
        end.setDate(31);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  /**
   * Calculate period dates with offset for trend analysis
   */
  private calculateOffsetPeriodDates(
    period: ReportPeriod, 
    offset: number, 
    baseDate: Date
  ): { start: Date; end: Date } {
    const start = new Date(baseDate);
    const end = new Date(baseDate);

    switch (period) {
      case ReportPeriod.DAY:
        start.setDate(baseDate.getDate() - offset);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate());
        end.setHours(23, 59, 59, 999);
        break;
      
      case ReportPeriod.WEEK:
        const weekStart = new Date(baseDate);
        weekStart.setDate(baseDate.getDate() - (offset * 7));
        const dayOfWeek = weekStart.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start.setDate(weekStart.getDate() - daysToMonday);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      
      case ReportPeriod.MONTH:
        start.setMonth(baseDate.getMonth() - offset);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;

      case ReportPeriod.YEAR:
        start.setFullYear(baseDate.getFullYear() - offset);
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setFullYear(start.getFullYear());
        end.setMonth(11);
        end.setDate(31);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  /**
   * Format period string for display
   */
  private formatPeriodString(period: ReportPeriod, start: Date, end: Date): string {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };

    switch (period) {
      case ReportPeriod.DAY:
        return start.toLocaleDateString('fr-FR', options);
      
      case ReportPeriod.WEEK:
        return `Semaine du ${start.toLocaleDateString('fr-FR', options)} au ${end.toLocaleDateString('fr-FR', options)}`;
      
      case ReportPeriod.MONTH:
        return start.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });

      case ReportPeriod.YEAR:
        return start.getFullYear().toString();

      default:
        return `${start.toLocaleDateString('fr-FR', options)} - ${end.toLocaleDateString('fr-FR', options)}`;
    }
  }

  /**
   * Format date for metrics display
   */
  private formatDateForMetrics(date: Date, period: ReportPeriod): string {
    switch (period) {
      case ReportPeriod.DAY:
        return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
      
      case ReportPeriod.WEEK:
        return `S${this.getWeekNumber(date)}`;
      
      case ReportPeriod.MONTH:
        return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

      case ReportPeriod.YEAR:
        return date.getFullYear().toString();

      default:
        return date.toLocaleDateString('fr-FR');
    }
  }

  /**
   * Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Generate PDF report for a business
   */
  async generatePDFReport(dto: GenerateReportDto): Promise<PDFResult> {
    try {
      // Get business information
      const business = await this.businessRepository.findOne({ 
        where: { id: dto.businessId } 
      });
      
      if (!business) {
        return {
          success: false,
          error: `Business with ID ${dto.businessId} not found`
        };
      }

      // Generate balance report data
      const reportData = await this.generateBalanceReport(dto);

      // Generate PDF
      const pdfResult = await this.pdfGenerationService.generatePDFReport({
        businessId: dto.businessId,
        reportData,
        business,
        templateType: 'standard'
      });

      return pdfResult;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate and send PDF report via WhatsApp using Twilio SDK
   */
  async generateAndSendPDFReport(
    businessId: string, 
    userPhoneNumber: string, 
    period: ReportPeriod
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Generating PDF report for business ${businessId}, period: ${period}`);

      // Generate PDF report
      const pdfResult = await this.generatePDFReport({
        businessId,
        period,
        includeTopProducts: true,
        topProductsLimit: 5
      });

      if (!pdfResult.success) {
        this.logger.warn(`PDF generation failed for business ${businessId}: ${pdfResult.error}`);
        
        // If PDF generation is disabled (e.g., on Vercel), fallback to text report
        if (process.env.VERCEL === '1' || process.env.DISABLE_PUPPETEER === 'true') {
          this.logger.log('PDF generation disabled, sending text report instead');
          const textReport = await this.generateTextReport(businessId, period);
          await this.twilioWhatsAppService.sendMessage(
            userPhoneNumber,
            `Voici votre rapport financier pour la période: ${period}\n\n${textReport}`
          );
          
          return {
            success: true,
            message: 'Rapport envoyé en format texte (PDF non disponible sur cette plateforme)'
          };
        }
        
        // Fallback to text report if PDF generation fails
        const textReport = await this.generateTextReport(businessId, period);
        await this.twilioWhatsAppService.sendMessage(
          userPhoneNumber,
          `Impossible de générer le PDF. Voici votre rapport en texte:\n\n${textReport}`
        );
        
        return {
          success: true,
          message: 'Rapport envoyé en format texte (PDF indisponible)'
        };
      }

      this.logger.log(`PDF generated successfully: ${pdfResult.fileName}, sending via Twilio`);

      // Send PDF via Twilio WhatsApp with proper error handling
      try {
        const messageInstance = await this.twilioWhatsAppService.sendMedia(
          userPhoneNumber,
          pdfResult.url!,
          `Voici votre rapport financier pour la période: ${period}`,
          pdfResult.fileName!
        );

        this.logger.log(`PDF report sent successfully via Twilio: ${messageInstance.sid}`);

        return {
          success: true,
          message: 'Rapport PDF envoyé avec succès'
        };
      } catch (twilioError) {
        this.logger.error(`Twilio media sending failed: ${twilioError.message}`);
        
        // If Twilio media sending fails, try sending as text fallback
        const textReport = await this.generateTextReport(businessId, period);
        await this.twilioWhatsAppService.sendMessage(
          userPhoneNumber,
          `Erreur d'envoi du PDF. Voici votre rapport en texte:\n\n${textReport}`
        );
        
        return {
          success: true,
          message: 'PDF généré mais envoyé en format texte (erreur d\'envoi média)'
        };
      }

    } catch (error) {
      this.logger.error(`Report generation/sending failed for business ${businessId}:`, error);
      
      // Final fallback - send error message via Twilio
      try {
        await this.twilioWhatsAppService.sendMessage(
          userPhoneNumber,
          'Désolé, impossible de générer le rapport pour le moment. Veuillez réessayer plus tard.'
        );
      } catch (sendError) {
        this.logger.error('Failed to send error message via Twilio:', sendError);
      }

      return {
        success: false,
        message: `Erreur lors de la génération du rapport: ${error.message}`
      };
    }
  }

  /**
   * Generate text-based report as fallback
   */
  private async generateTextReport(businessId: string, period: ReportPeriod): Promise<string> {
    const report = await this.generateBalanceReport({
      businessId,
      period,
      includeTopProducts: true,
      topProductsLimit: 3
    });

    const business = await this.businessRepository.findOne({ 
      where: { id: businessId } 
    });

    const currency = business?.currency || 'XOF';
    
    let textReport = `📊 RAPPORT FINANCIER\n`;
    textReport += `🏢 ${business?.name || 'Votre entreprise'}\n`;
    textReport += `📅 Période: ${report.period}\n\n`;
    
    textReport += `💰 RÉSUMÉ FINANCIER\n`;
    textReport += `• Ventes: ${this.formatCurrency(report.totalSales, currency)}\n`;
    textReport += `• Dépenses: ${this.formatCurrency(report.totalExpenses, currency)}\n`;
    textReport += `• Bénéfice: ${this.formatCurrency(report.netProfit, currency)}\n\n`;
    
    textReport += `📈 ACTIVITÉ\n`;
    textReport += `• ${report.transactionCount} transactions au total\n`;
    textReport += `• ${report.salesCount} ventes\n`;
    textReport += `• ${report.expenseCount} dépenses\n\n`;

    if (report.topProducts && report.topProducts.length > 0) {
      textReport += `🏆 TOP PRODUITS\n`;
      report.topProducts.forEach((product, index) => {
        textReport += `${index + 1}. ${product.product}: ${this.formatCurrency(product.revenue, currency)}\n`;
      });
    }

    textReport += `\n📱 Généré par MonPetitBiz`;
    
    return textReport;
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number, currency: string = 'XOF'): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}