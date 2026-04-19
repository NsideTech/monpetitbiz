import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminStatsController } from './admin-stats.controller';
import { DailyGoalService } from './services/daily-goal.service';
import { Transaction } from '../transaction/entities/transaction.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Business } from '../auth/entities/business.entity';
import { User } from '../auth/entities/user.entity';
import { DailyGoal } from './entities/daily-goal.entity';
import { ReportModule } from '../report/report.module';
import { StockModule } from '../stock/stock.module';
import { AuthModule } from '../auth/auth.module';
import { TransactionModule } from '../transaction/transaction.module';
import { ReceivableModule } from '../receivable/receivable.module';
import { LoanModule } from '../loan/loan.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, StockItem, Business, User, DailyGoal]),
    ReportModule,
    StockModule,
    AuthModule,
    TransactionModule,
    ReceivableModule,
    LoanModule,
  ],
  providers: [DashboardService, DailyGoalService],
  controllers: [DashboardController, AdminDashboardController, AdminStatsController],
  exports: [DashboardService, DailyGoalService],
})
export class DashboardModule {}