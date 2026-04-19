import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
  Header,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { DashboardService } from './dashboard.service';
import { DailyGoalService } from './services/daily-goal.service';
import { AuthService } from '../auth/auth.service';
import { ReceivableService } from '../receivable/receivable.service';
import { LoanService } from '../loan/loan.service';
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
import { TransactionType } from '../transaction/entities/transaction.entity';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dailyGoalService: DailyGoalService,
    private readonly authService: AuthService,
    private readonly receivableService: ReceivableService,
    private readonly loanService: LoanService,
  ) {}

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
  @Permissions('dashboard:read', 'view_stock')
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
   * Get all stock levels (products with prices)
   */
  @Get(':businessId/stock-levels')
  @Permissions('dashboard:read', 'view_stock')
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
   * Create a product (mobile)
   */
  @Post(':businessId/products')
  @Permissions('manage_stock')
  async createProduct(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() productData: { name: string; quantity?: number; unitPrice?: number },
    @CurrentUser() user: User
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    return await this.dashboardService.createProduct(businessId, {
      name: productData.name,
      quantity: productData.quantity ?? 0,
      unitPrice: productData.unitPrice,
    });
  }

  /**
   * Update a product (mobile)
   */
  @Patch(':businessId/products/:productId')
  @Permissions('manage_stock')
  async updateProduct(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() productData: { name?: string; quantity?: number; unitPrice?: number },
    @CurrentUser() user: User
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    return await this.dashboardService.updateProduct(businessId, productId, productData);
  }

  /**
   * Adjust stock quantity for a product (mobile) - records movement with userId
   */
  @Patch(':businessId/stock/:productId')
  @Permissions('manage_stock')
  async adjustStock(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: { quantity: number },
    @CurrentUser() user: User
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    if (body.quantity === undefined || body.quantity === null) {
      throw new BadRequestException('Quantity is required');
    }

    return await this.dashboardService.adjustStock(
      businessId,
      productId,
      Math.floor(body.quantity),
      user.id,
    );
  }

  /**
   * Get stock movement history (mobile)
   */
  @Get(':businessId/stock-movements')
  @Permissions('dashboard:read', 'view_stock')
  async getStockMovements(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    const limitNumber = limit ? parseInt(limit, 10) : 50;
    const offsetNumber = offset ? parseInt(offset, 10) : 0;
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }
    if (isNaN(offsetNumber) || offsetNumber < 0) {
      throw new BadRequestException('Offset must be non-negative');
    }

    return await this.dashboardService.getStockMovements(businessId, {
      productId,
      limit: limitNumber,
      offset: offsetNumber,
    });
  }

  /**
   * Delete a product (mobile)
   */
  @Delete(':businessId/products/:productId')
  @Permissions('manage_stock')
  async deleteProduct(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: User
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    return await this.dashboardService.deleteProduct(businessId, productId);
  }

  /**
   * Get recent transactions (legacy, use transactions with filters for new clients)
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
   * Get transactions with filters (type, startDate, endDate, limit, offset)
   */
  @Get(':businessId/transactions')
  @Permissions('dashboard:read')
  async getTransactions(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
    @Query('type') type?: 'sale' | 'expense',
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    const limitNumber = parseInt(limit ?? '50', 10);
    const offsetNumber = parseInt(offset ?? '0', 10);
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      throw new BadRequestException('Limit must be a number between 1 and 100');
    }
    if (isNaN(offsetNumber) || offsetNumber < 0) {
      throw new BadRequestException('Offset must be a non-negative number');
    }

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }
    }
    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const transactionType = type === 'sale' ? TransactionType.SALE : type === 'expense' ? TransactionType.EXPENSE : undefined;

    return await this.dashboardService.getTransactions(businessId, {
      type: transactionType,
      startDate,
      endDate,
      limit: limitNumber,
      offset: offsetNumber,
    });
  }

  /**
   * Create a transaction (sale or expense) from mobile
   */
  @Post(':businessId/transactions')
  @Permissions('create_sale', 'create_expense')
  async createTransaction(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: {
      type: 'sale' | 'expense';
      amount: number;
      product?: string;
      quantity?: number;
      description?: string;
      creditSale?: { debtorName: string; debtorPhone?: string };
    },
    @CurrentUser() user: User
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }

    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    if (!body.type || !['sale', 'expense'].includes(body.type)) {
      throw new BadRequestException('Type must be "sale" or "expense"');
    }

    const requiredPermission = body.type === 'sale' ? 'create_sale' : 'create_expense';
    const hasPermission = await this.authService.hasPermission(user.id, requiredPermission);
    if (!hasPermission) {
      throw new ForbiddenException(
        body.type === 'sale'
          ? "Vous n'avez pas la permission de créer des ventes"
          : "Vous n'avez pas la permission de créer des dépenses",
      );
    }

    const type = body.type === 'sale' ? TransactionType.SALE : TransactionType.EXPENSE;
    return await this.dashboardService.createTransaction(businessId, user.id, {
      type,
      amount: body.amount,
      product: body.product,
      quantity: body.quantity,
      description: body.description,
      creditSale: body.creditSale,
    });
  }

  /**
   * Get receivables summary (total outstanding, count)
   */
  @Get(':businessId/receivables-summary')
  @Permissions('view_receivables')
  async getReceivablesSummary(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.receivableService.getSummary(businessId);
  }

  /**
   * Get receivables list
   */
  @Get(':businessId/receivables')
  @Permissions('view_receivables')
  async getReceivables(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
    @Query('status') status?: 'open' | 'partial' | 'paid' | 'overdue',
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    return await this.receivableService.findAll(businessId, {
      status: status || undefined,
      limit: isNaN(limit) ? 100 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });
  }

  /**
   * Create a receivable
   */
  @Post(':businessId/receivables')
  @Permissions('create_receivable')
  async createReceivable(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: { debtorName: string; debtorPhone?: string; amount: number; description?: string; dueDate?: string },
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.receivableService.create(businessId, user.id, {
      debtorName: body.debtorName,
      debtorPhone: body.debtorPhone,
      amount: body.amount,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    });
  }

  /**
   * Get receivable detail
   */
  @Get(':businessId/receivables/:id')
  @Permissions('view_receivables')
  async getReceivable(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.receivableService.findOne(businessId, id);
  }

  /**
   * Record a payment on a receivable
   */
  @Post(':businessId/receivables/:id/payments')
  @Permissions('create_receivable')
  async recordReceivablePayment(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { amount: number; paymentDate?: string; notes?: string },
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.receivableService.recordPayment(
      businessId,
      id,
      user.id,
      body.amount,
      body.paymentDate ? new Date(body.paymentDate) : undefined,
      body.notes,
    );
  }

  /**
   * Record full payment (soldé) on a receivable
   */
  @Post(':businessId/receivables/:id/payments/full')
  @Permissions('create_receivable')
  async recordFullReceivablePayment(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { paymentDate?: string; notes?: string },
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.receivableService.recordFullPayment(
      businessId,
      id,
      user.id,
      body.paymentDate ? new Date(body.paymentDate) : undefined,
      body.notes,
    );
  }

  /**
   * Get loans summary (total outstanding, count)
   */
  @Get(':businessId/loans-summary')
  @Permissions('view_loans')
  async getLoansSummary(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.loanService.getSummary(businessId);
  }

  /**
   * Get loans list
   */
  @Get(':businessId/loans')
  @Permissions('view_loans')
  async getLoans(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
    @Query('status') status?: 'open' | 'partial' | 'paid' | 'overdue',
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    return await this.loanService.findAll(businessId, {
      status: status || undefined,
      limit: isNaN(limit) ? 100 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });
  }

  /**
   * Create a loan
   */
  @Post(':businessId/loans')
  @Permissions('create_loan')
  async createLoan(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: { lenderName: string; lenderPhone?: string; loanType: 'supplier' | 'microcredit'; amount: number; dueDate: string; description?: string },
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.loanService.create(businessId, user.id, {
      lenderName: body.lenderName,
      lenderPhone: body.lenderPhone,
      loanType: body.loanType,
      amount: body.amount,
      dueDate: new Date(body.dueDate),
      description: body.description,
    });
  }

  /**
   * Get loan detail
   */
  @Get(':businessId/loans/:id')
  @Permissions('view_loans')
  async getLoan(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.loanService.findOne(businessId, id);
  }

  /**
   * Record a payment on a loan
   */
  @Post(':businessId/loans/:id/payments')
  @Permissions('create_loan')
  async recordLoanPayment(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { amount: number; paymentDate?: string; notes?: string },
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.loanService.recordPayment(
      businessId,
      id,
      user.id,
      body.amount,
      body.paymentDate ? new Date(body.paymentDate) : undefined,
      body.notes,
    );
  }

  /**
   * Record full payment (soldé) on a loan
   */
  @Post(':businessId/loans/:id/payments/full')
  @Permissions('create_loan')
  async recordFullLoanPayment(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { paymentDate?: string; notes?: string },
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return await this.loanService.recordFullPayment(
      businessId,
      id,
      user.id,
      body.paymentDate ? new Date(body.paymentDate) : undefined,
      body.notes,
    );
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

  /**
   * B1 — Upsert l'objectif journalier du business
   */
  @Post(':businessId/goals')
  @Permissions('dashboard:read')
  async upsertGoal(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: { targetAmount: number; dayOfWeek?: number },
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return this.dailyGoalService.upsertGoal(
      businessId,
      body.targetAmount,
      body.dayOfWeek ?? null,
    );
  }

  /**
   * B1 — Objectif du jour + progression (CA aujourd'hui)
   */
  @Get(':businessId/goals/today')
  @Permissions('dashboard:read')
  async getTodayGoal(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    const summary = await this.dashboardService.getSummaryCards(businessId);
    return this.dailyGoalService.getTodayGoalWithProgress(businessId, summary.todaySales);
  }

  /**
   * B3 — Top produits par CA sur une période
   */
  @Get(':businessId/top-products')
  @Permissions('dashboard:read')
  async getTopProducts(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'week',
    @Query('limit') limit: string = '5',
    @CurrentUser() user: User,
  ) {
    if (user.businessId !== businessId) {
      throw new BadRequestException('Access denied to this business data');
    }
    return this.dashboardService.getTopProducts(
      businessId,
      period,
      Math.min(parseInt(limit, 10) || 5, 20),
    );
  }
}