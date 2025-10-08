export enum ReportPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}

export interface BalanceReport {
  period: string;
  startDate: Date;
  endDate: Date;
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
  salesCount: number;
  expenseCount: number;
  currency: string;
  topProducts?: ProductPerformance[];
}

export interface ProductPerformance {
  product: string;
  revenue: number;
  quantity: number;
  transactionCount: number;
}

export interface PeriodMetrics {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
  transactionCount: number;
}

export class GenerateReportDto {
  businessId: string;
  period: ReportPeriod;
  startDate?: Date;
  endDate?: Date;
  includeTopProducts?: boolean = true;
  topProductsLimit?: number = 5;
}