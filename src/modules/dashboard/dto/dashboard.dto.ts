import { IsOptional, IsDateString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { StockItem } from '../../stock/entities/stock-item.entity';

export class GetDashboardDataDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  days?: number = 7;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockThreshold?: number = 5;
}

export class ExportTransactionDataDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class GetDashboardMetricsDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month' = 'day';
}

export class DashboardSummaryDto {
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

export class ChartDataPointDto {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
}

export class StockWarningDto {
  product: string;
  currentQuantity: number;
  warningLevel: number;
  status: 'low' | 'out';
  message: string;
}

export class TopProductDto {
  product: string;
  revenue: number;
  count: number;
}

export class DashboardMetricsDto {
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
  topProducts: TopProductDto[];
}

export class DashboardDataDto {
  summary: DashboardSummaryDto;
  recentTransactions: Transaction[];
  chartData: ChartDataPointDto[];
  stockWarnings: StockWarningDto[];
  stockLevels: StockItem[];
}

export class ExportDataDto {
  transactions: Transaction[];
  summary: DashboardSummaryDto;
  period: string;
  generatedAt: Date;
}