import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../../auth/entities/business.entity';
import { User, UserRole } from '../../auth/entities/user.entity';
import { ReportService } from '../report.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { BalanceReport } from '../dto/report.dto';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private reportService: ReportService,
    private whatsappService: WhatsappService,
  ) {}

  /**
   * Run daily report generation every hour to check for businesses in different timezones
   * This runs at the top of every hour to catch businesses at their 8 PM local time
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateDailyReports(): Promise<void> {
    this.logger.log('Starting automated daily report generation check');

    try {
      // Get all active businesses
      const businesses = await this.businessRepository.find({
        relations: ['users'],
      });

      const currentTime = new Date();
      let reportsGenerated = 0;
      let errors = 0;

      for (const business of businesses) {
        try {
          // Check if it's 8 PM (20:00) in the business's timezone
          if (this.isReportTime(currentTime, business.timezone)) {
            await this.generateAndSendDailyReport(business);
            reportsGenerated++;
          }
        } catch (error) {
          this.logger.error(
            `Failed to generate daily report for business ${business.id}: ${error.message}`,
            error.stack
          );
          errors++;
        }
      }

      this.logger.log(
        `Daily report check completed: ${reportsGenerated} reports generated, ${errors} errors`
      );
    } catch (error) {
      this.logger.error('Failed to run daily report generation:', error);
    }
  }

  /**
   * Generate and send daily report for a specific business
   */
  async generateAndSendDailyReport(business: Business): Promise<void> {
    this.logger.log(`Generating daily report for business: ${business.name} (${business.id})`);

    try {
      // Generate the daily report
      const report = await this.reportService.generateDailyReport(business.id);

      // Get business owners to send the report to
      const owners = business.users?.filter(user => 
        user.role === UserRole.OWNER && user.isActive
      ) || [];

      if (owners.length === 0) {
        this.logger.warn(`No active owners found for business ${business.id}`);
        return;
      }

      // Format and send the report to each owner
      for (const owner of owners) {
        const message = this.formatDailyReportMessage(report, business, owner.language);
        await this.whatsappService.sendMessage(owner.phoneNumber, message);
        
        this.logger.log(`Daily report sent to ${owner.phoneNumber} for business ${business.id}`);
      }

    } catch (error) {
      this.logger.error(`Failed to generate/send daily report for business ${business.id}:`, error);
      throw error;
    }
  }

  /**
   * Check if current time matches 8 PM in the given timezone
   */
  private isReportTime(currentTime: Date, timezone: string): boolean {
    try {
      // Convert current UTC time to business timezone
      const businessTime = new Date(currentTime.toLocaleString('en-US', { timeZone: timezone }));
      
      // Check if it's 8 PM (20:00) in the business timezone
      const hour = businessTime.getHours();
      const minute = businessTime.getMinutes();
      
      // We check for 8 PM (hour 20) and allow a 5-minute window to account for cron timing
      return hour === 20 && minute < 5;
    } catch (error) {
      this.logger.error(`Invalid timezone ${timezone}, using default Africa/Dakar`);
      // Fallback to default timezone
      return this.isReportTime(currentTime, 'Africa/Dakar');
    }
  }

  /**
   * Format daily report message for WhatsApp
   */
  private formatDailyReportMessage(
    report: BalanceReport, 
    business: Business, 
    language: string = 'fr'
  ): string {
    const currency = business.currency || 'XOF';
    
    // Handle case where there's no activity
    if (report.transactionCount === 0) {
      return language === 'fr' 
        ? `📊 *Rapport quotidien - ${business.name}*\n\n❌ Aucune activité aujourd'hui\n\nBonne soirée ! 🌙`
        : `📊 *Daily Report - ${business.name}*\n\n❌ No activity today\n\nGood evening! 🌙`;
    }

    // Format the report message
    const messages = {
      fr: this.formatFrenchReportMessage(report, business.name, currency),
      en: this.formatEnglishReportMessage(report, business.name, currency)
    };

    return messages[language] || messages.fr;
  }

  /**
   * Format report message in French
   */
  private formatFrenchReportMessage(report: BalanceReport, businessName: string, currency: string): string {
    let message = `📊 *Rapport quotidien - ${businessName}*\n\n`;
    message += `📅 ${report.period}\n\n`;
    
    // Sales summary
    message += `💰 *Ventes:* ${this.formatAmount(report.totalSales, currency)}\n`;
    message += `📦 Nombre de ventes: ${report.salesCount}\n\n`;
    
    // Expenses summary
    message += `💸 *Dépenses:* ${this.formatAmount(report.totalExpenses, currency)}\n`;
    message += `🧾 Nombre de dépenses: ${report.expenseCount}\n\n`;
    
    // Net profit
    const profitEmoji = report.netProfit >= 0 ? '✅' : '❌';
    message += `${profitEmoji} *Bénéfice net:* ${this.formatAmount(report.netProfit, currency)}\n\n`;
    
    // Top products if available
    if (report.topProducts && report.topProducts.length > 0) {
      message += `🏆 *Top produits:*\n`;
      report.topProducts.forEach((product, index) => {
        message += `${index + 1}. ${product.product}: ${this.formatAmount(product.revenue, currency)}\n`;
      });
      message += '\n';
    }
    
    message += `📱 Total transactions: ${report.transactionCount}\n\n`;
    message += `Bonne soirée ! 🌙`;
    
    return message;
  }

  /**
   * Format report message in English
   */
  private formatEnglishReportMessage(report: BalanceReport, businessName: string, currency: string): string {
    let message = `📊 *Daily Report - ${businessName}*\n\n`;
    message += `📅 ${report.period}\n\n`;
    
    // Sales summary
    message += `💰 *Sales:* ${this.formatAmount(report.totalSales, currency)}\n`;
    message += `📦 Number of sales: ${report.salesCount}\n\n`;
    
    // Expenses summary
    message += `💸 *Expenses:* ${this.formatAmount(report.totalExpenses, currency)}\n`;
    message += `🧾 Number of expenses: ${report.expenseCount}\n\n`;
    
    // Net profit
    const profitEmoji = report.netProfit >= 0 ? '✅' : '❌';
    message += `${profitEmoji} *Net Profit:* ${this.formatAmount(report.netProfit, currency)}\n\n`;
    
    // Top products if available
    if (report.topProducts && report.topProducts.length > 0) {
      message += `🏆 *Top Products:*\n`;
      report.topProducts.forEach((product, index) => {
        message += `${index + 1}. ${product.product}: ${this.formatAmount(product.revenue, currency)}\n`;
      });
      message += '\n';
    }
    
    message += `📱 Total transactions: ${report.transactionCount}\n\n`;
    message += `Good evening! 🌙`;
    
    return message;
  }

  /**
   * Format amount with currency
   */
  private formatAmount(amount: number, currency: string): string {
    return `${amount.toLocaleString('fr-FR')} ${currency}`;
  }

  /**
   * Manual trigger for testing daily reports
   */
  async triggerDailyReportForBusiness(businessId: string): Promise<void> {
    this.logger.log(`Manually triggering daily report for business: ${businessId}`);
    
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
      relations: ['users'],
    });

    if (!business) {
      throw new Error(`Business with ID ${businessId} not found`);
    }

    await this.generateAndSendDailyReport(business);
  }

  /**
   * Get scheduler status and next run times
   */
  getSchedulerStatus(): {
    isActive: boolean;
    nextRunTime: string;
    timezone: string;
  } {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);

    return {
      isActive: true,
      nextRunTime: nextHour.toISOString(),
      timezone: 'UTC (checks all business timezones)',
    };
  }
}