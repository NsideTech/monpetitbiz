import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  UseGuards, 
  ParseUUIDPipe,
  BadRequestException,
  Header,
  Res,
  ValidationPipe
} from '@nestjs/common';
import { Response } from 'express';
import { ServiceTokenGuard } from '../auth/guards/service-token.guard';
import { DashboardService } from './dashboard.service';
import { 
  GetDashboardDataDto, 
  ExportTransactionDataDto, 
  GetDashboardMetricsDto,
  DashboardDataDto,
  DashboardSummaryDto,
  ChartDataPointDto,
  StockWarningDto,
  DashboardMetricsDto,
  ExportDataDto
} from './dto/dashboard.dto';

/**
 * Admin Dashboard Controller
 * 
 * This controller provides admin endpoints that bypass business ownership checks.
 * It uses a service token for authentication, allowing admin portal users to access
 * any business data without being the business owner.
 * 
 * All endpoints require a valid SERVICE_TOKEN in the Authorization header.
 */
@Controller('admin/dashboard')
@UseGuards(ServiceTokenGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get comprehensive dashboard data for any business (admin access)
   */
  @Get(':businessId')
  async getDashboardData(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(ValidationPipe) query: GetDashboardDataDto
  ): Promise<DashboardDataDto> {
    // No business ownership check - admin can access any business
    return await this.dashboardService.getDashboardData(businessId);
  }

  /**
   * Get summary cards for daily/weekly/monthly totals (admin access)
   */
  @Get(':businessId/summary')
  async getSummaryCards(
    @Param('businessId', ParseUUIDPipe) businessId: string
  ): Promise<DashboardSummaryDto> {
    return await this.dashboardService.getSummaryCards(businessId);
  }

  /**
   * Get chart data for sales and expense trends (admin access)
   */
  @Get(':businessId/chart-data')
  async getChartData(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('days') days: string = '7'
  ): Promise<ChartDataPointDto[]> {
    const daysNumber = parseInt(days, 10);
    if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 30) {
      throw new BadRequestException('Days must be a number between 1 and 30');
    }

    return await this.dashboardService.getChartData(businessId, daysNumber);
  }

  /**
   * Get stock warnings for low stock items (admin access)
   */
  @Get(':businessId/stock-warnings')
  async getStockWarnings(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('threshold') threshold: string = '5'
  ): Promise<StockWarningDto[]> {
    const thresholdNumber = parseInt(threshold, 10);
    if (isNaN(thresholdNumber) || thresholdNumber < 0) {
      throw new BadRequestException('Threshold must be a non-negative number');
    }

    return await this.dashboardService.getStockWarnings(businessId, thresholdNumber);
  }

  /**
   * Get all stock levels (admin access)
   */
  @Get(':businessId/stock-levels')
  async getStockLevels(
    @Param('businessId', ParseUUIDPipe) businessId: string
  ) {
    return await this.dashboardService.getStockLevels(businessId);
  }

  /**
   * Get recent transactions (admin access)
   */
  @Get(':businessId/recent-transactions')
  async getRecentTransactions(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('limit') limit: string = '10'
  ) {
    const limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      throw new BadRequestException('Limit must be a number between 1 and 100');
    }

    return await this.dashboardService.getRecentTransactions(businessId, limitNumber);
  }

  /**
   * Export transaction data as JSON (admin access)
   */
  @Get(':businessId/export')
  async exportTransactionData(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(ValidationPipe) query: ExportTransactionDataDto
  ): Promise<ExportDataDto> {
    let start: Date | undefined;
    let end: Date | undefined;

    if (query.startDate) {
      start = new Date(query.startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date format');
      }
    }

    if (query.endDate) {
      end = new Date(query.endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end date format');
      }
    }

    if (start && end && start > end) {
      throw new BadRequestException('Start date must be before end date');
    }

    return await this.dashboardService.exportTransactionData(businessId, start, end);
  }

  /**
   * Export transaction data as CSV (admin access)
   */
  @Get(':businessId/export/csv')
  @Header('Content-Type', 'text/csv')
  async exportTransactionDataAsCSV(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(ValidationPipe) query: ExportTransactionDataDto,
    @Res() res: Response
  ) {
    let start: Date | undefined;
    let end: Date | undefined;

    if (query.startDate) {
      start = new Date(query.startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date format');
      }
    }

    if (query.endDate) {
      end = new Date(query.endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end date format');
      }
    }

    if (start && end && start > end) {
      throw new BadRequestException('Start date must be before end date');
    }

    const csvData = await this.dashboardService.exportTransactionDataAsCSV(businessId, start, end);
    
    const filename = `transactions_${businessId}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  }

  /**
   * Get dashboard metrics for a specific period (admin access)
   */
  @Get(':businessId/metrics')
  async getDashboardMetrics(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(ValidationPipe) query: GetDashboardMetricsDto
  ): Promise<DashboardMetricsDto> {
    return await this.dashboardService.getDashboardMetrics(businessId, query.period);
  }
}

