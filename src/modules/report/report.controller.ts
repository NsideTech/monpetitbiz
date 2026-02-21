import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseUUIDPipe,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportSchedulerService } from './services/report-scheduler.service';
import { BalanceReport, PeriodMetrics, ReportPeriod } from './dto/report.dto';
import { PDFResult } from './services/pdf-generation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly schedulerService: ReportSchedulerService,
  ) {}

  /**
   * Get scheduler status (must be before :businessId routes)
   */
  @Get('scheduler/status')
  @Permissions('dashboard:read')
  getSchedulerStatus() {
    return this.schedulerService.getSchedulerStatus();
  }

  /**
   * Get daily balance report for a business
   */
  @Get(':businessId/daily')
  @Permissions('dashboard:read')
  async getDailyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
  ): Promise<BalanceReport> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return this.reportService.generateDailyReport(businessId);
  }

  /**
   * Get weekly balance report for a business
   */
  @Get(':businessId/weekly')
  @Permissions('dashboard:read')
  async getWeeklyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
  ): Promise<BalanceReport> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return this.reportService.generateWeeklyReport(businessId);
  }

  /**
   * Get monthly balance report for a business
   */
  @Get(':businessId/monthly')
  @Permissions('dashboard:read')
  async getMonthlyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
  ): Promise<BalanceReport> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return this.reportService.generateMonthlyReport(businessId);
  }

  /**
   * Get yearly balance report for a business
   */
  @Get(':businessId/yearly')
  @Permissions('dashboard:read')
  async getYearlyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
  ): Promise<BalanceReport> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return this.reportService.generateYearlyReport(businessId);
  }

  /**
   * Get custom period balance report
   */
  @Get(':businessId/custom')
  @Permissions('dashboard:read')
  async getCustomReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('includeTopProducts') includeTopProducts?: boolean,
    @Query('topProductsLimit') topProductsLimit?: number,
    @CurrentUser() user?: User,
  ): Promise<BalanceReport> {
    if (user && user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
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
  @Permissions('dashboard:read')
  async getPeriodMetrics(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('period') period: ReportPeriod,
    @Query('count') count?: number,
    @CurrentUser() user?: User,
  ): Promise<PeriodMetrics[]> {
    if (user && user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    const periodsCount = count ? parseInt(count.toString()) : 7;
    return this.reportService.getPeriodMetrics(businessId, period, periodsCount);
  }

  /**
   * Manually trigger daily report for a specific business (for testing)
   */
  @Post(':businessId/daily-report/trigger')
  @Permissions('dashboard:read')
  async triggerDailyReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
  ): Promise<{ success: boolean; message: string }> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
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
   * Generate PDF report for a business
   */
  @Post(':businessId/pdf')
  @Permissions('dashboard:read')
  async generatePDFReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: {
      period: ReportPeriod;
      startDate?: string;
      endDate?: string;
      includeTopProducts?: boolean;
      topProductsLimit?: number;
    },
    @CurrentUser() user: User,
  ): Promise<PDFResult> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
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
  @Permissions('dashboard:read')
  async sendPDFReport(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: {
      phoneNumber: string;
      period: ReportPeriod;
    },
    @CurrentUser() user: User,
  ): Promise<{ success: boolean; message: string }> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return this.reportService.generateAndSendPDFReport(
      businessId,
      body.phoneNumber,
      body.period
    );
  }
}