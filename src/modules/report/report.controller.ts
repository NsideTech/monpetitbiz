import { Controller, Get, Post, Param, Query, ParseUUIDPipe, Body } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportSchedulerService } from './services/report-scheduler.service';
import { BalanceReport, PeriodMetrics, ReportPeriod } from './dto/report.dto';
import { PDFResult } from './services/pdf-generation.service';

@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly schedulerService: ReportSchedulerService,
  ) {}

  /**
   * Get daily balance report for a business
   */
  @Get(':businessId/daily')
  async getDailyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string
  ): Promise<BalanceReport> {
    return this.reportService.generateDailyReport(businessId);
  }

  /**
   * Get weekly balance report for a business
   */
  @Get(':businessId/weekly')
  async getWeeklyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string
  ): Promise<BalanceReport> {
    return this.reportService.generateWeeklyReport(businessId);
  }

  /**
   * Get monthly balance report for a business
   */
  @Get(':businessId/monthly')
  async getMonthlyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string
  ): Promise<BalanceReport> {
    return this.reportService.generateMonthlyReport(businessId);
  }

  /**
   * Get custom period balance report
   */
  @Get(':businessId/custom')
  async getCustomReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('includeTopProducts') includeTopProducts?: boolean,
    @Query('topProductsLimit') topProductsLimit?: number
  ): Promise<BalanceReport> {
    return this.reportService.generateBalanceReport({
      businessId,
      period: ReportPeriod.DAY, // Will be overridden by custom dates
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      includeTopProducts: includeTopProducts ?? true,
      topProductsLimit: topProductsLimit ? parseInt(topProductsLimit.toString()) : 5
    });
  }

  /**
   * Get period metrics for trend analysis
   */
  @Get(':businessId/metrics/:period')
  async getPeriodMetrics(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('period') period: ReportPeriod,
    @Query('count') count?: number
  ): Promise<PeriodMetrics[]> {
    const periodsCount = count ? parseInt(count.toString()) : 7;
    return this.reportService.getPeriodMetrics(businessId, period, periodsCount);
  }

  /**
   * Manually trigger daily report for a specific business (for testing)
   */
  @Post(':businessId/daily-report/trigger')
  async triggerDailyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.schedulerService.triggerDailyReportForBusiness(businessId);
      return {
        success: true,
        message: `Daily report triggered successfully for business ${businessId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger daily report: ${error.message}`
      };
    }
  }

  /**
   * Get scheduler status
   */
  @Get('scheduler/status')
  getSchedulerStatus() {
    return this.schedulerService.getSchedulerStatus();
  }

  /**
   * Generate PDF report for a business
   */
  @Post(':businessId/pdf')
  async generatePDFReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: {
      period: ReportPeriod;
      startDate?: string;
      endDate?: string;
      includeTopProducts?: boolean;
      topProductsLimit?: number;
    }
  ): Promise<PDFResult> {
    return this.reportService.generatePDFReport({
      businessId,
      period: body.period,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      includeTopProducts: body.includeTopProducts ?? true,
      topProductsLimit: body.topProductsLimit ?? 5
    });
  }

  /**
   * Generate and send PDF report via WhatsApp
   */
  @Post(':businessId/pdf/send')
  async sendPDFReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: {
      phoneNumber: string;
      period: ReportPeriod;
    }
  ): Promise<{ success: boolean; message: string }> {
    return this.reportService.generateAndSendPDFReport(
      businessId,
      body.phoneNumber,
      body.period
    );
  }
}