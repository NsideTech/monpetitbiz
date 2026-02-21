import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminStatsController } from './admin-stats.controller';
import { Transaction } from '../transaction/entities/transaction.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Business } from '../auth/entities/business.entity';
import { User } from '../auth/entities/user.entity';
import { ReportModule } from '../report/report.module';
import { StockModule } from '../stock/stock.module';
import { AuthModule } from '../auth/auth.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, StockItem, Business, User]),
    ReportModule,
    StockModule,
    AuthModule,
    TransactionModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController, AdminDashboardController, AdminStatsController],
  exports: [DashboardService],
})
export class DashboardModule {}