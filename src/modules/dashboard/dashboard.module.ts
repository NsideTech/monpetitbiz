import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Transaction } from '../transaction/entities/transaction.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Business } from '../auth/entities/business.entity';
import { ReportModule } from '../report/report.module';
import { StockModule } from '../stock/stock.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, StockItem, Business]),
    ReportModule,
    StockModule,
    AuthModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}