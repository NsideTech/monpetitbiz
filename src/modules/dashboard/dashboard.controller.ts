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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
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

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get comprehensive dashboard data
   * Requirements: 9.1, 9.2 - Dashboard with summary cards and visualization
   */
  @Get(':businessId')
  @Permissions('dashboard:read')
  async getDashboardData(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(ValidationPipe) query: GetDashboardDataDto,
    @CurrentUser() user: User
  ): Promise<DashboardDataDto> {
    // Ensure user can only access their own business data
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    return await this.dashboardService.getDashboardData(businessId);
  }

  /**
   * Get summary cards for daily/weekly/monthly totals
   * Requirements: 9.1 - Summary cards for different periods
   */
  @Get(':businessId/summary')
  @Permissions('dashboard:read')
  async getSummaryCards(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User
  ): Promise<DashboardSummaryDto> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    return await this.dashboardService.getSummaryCards(businessId);
  }

  /**
   * Get chart data for sales and expense trends
   * Requirements: 9.2 - Simple charts for sales and expense trends
   */
  @Get(':businessId/chart-data')
  @Permissions('dashboard:read')
  async getChartData(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('days') days: string = '7',
    @CurrentUser() user: User
  ): Promise<ChartDataPointDto[]> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    const daysNumber = parseInt(days, 10);
    if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 30) {
      throw new BadRequestException('Days must be a number between 1 and 30');
    }

    return await this.dashboardService.getChartData(businessId, daysNumber);
  }

  /**
   * Get stock warnings for low stock items
   * Requirements: 9.2 - Stock level display with low stock warnings
   */
  @Get(':businessId/stock-warnings')
  @Permissions('dashboard:read')
  async getStockWarnings(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('threshold') threshold: string = '5',
    @CurrentUser() user: User
  ): Promise<StockWarningDto[]> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    const thresholdNumber = parseInt(threshold, 10);
    if (isNaN(thresholdNumber) || thresholdNumber < 0) {
      throw new BadRequestException('Threshold must be a non-negative number');
    }

    return await this.dashboardService.getStockWarnings(businessId, thresholdNumber);
  }

  /**
   * Get all stock levels
   */
  @Get(':businessId/stock-levels')
  @Permissions('dashboard:read')
  async getStockLevels(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    return await this.dashboardService.getStockLevels(businessId);
  }

  /**
   * Get recent transactions
   */
  @Get(':businessId/recent-transactions')
  @Permissions('dashboard:read')
  async getRecentTransactions(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('limit') limit: string = '10',
    @CurrentUser() user: User
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    const limitNumber = parseInt(limit, 10);
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      throw new BadRequestException('Limit must be a number between 1 and 100');
    }

    return await this.dashboardService.getRecentTransactions(businessId, limitNumber);
  }

  /**
   * Export transaction data as JSON
   * Requirements: 9.2 - Export functionality for transaction data
   */
  @Get(':businessId/export')
  @Permissions('dashboard:read')
  async exportTransactionData(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(ValidationPipe) query: ExportTransactionDataDto,
    @CurrentUser() user: User
  ): Promise<ExportDataDto> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

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
   * Export transaction data as CSV
   * Requirements: 9.2 - Export functionality for transaction data
   */
  @Get(':businessId/export/csv')
  @Permissions('dashboard:read')
  @Header('Content-Type', 'text/csv')
  async exportTransactionDataAsCSV(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(ValidationPipe) query: ExportTransactionDataDto,
    @CurrentUser() user: User,
    @Res() res: Response
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

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
   * Get dashboard metrics for a specific period
   */
  @Get(':businessId/metrics')
  @Permissions('dashboard:read')
  async getDashboardMetrics(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(ValidationPipe) query: GetDashboardMetricsDto,
    @CurrentUser() user: User
  ): Promise<DashboardMetricsDto> {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    return await this.dashboardService.getDashboardMetrics(businessId, query.period);
  }
}