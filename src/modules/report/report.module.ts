import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { ReportSchedulerService } from './services/report-scheduler.service';
import { PDFGenerationService } from './services/pdf-generation.service';
import { Transaction } from '../transaction/entities/transaction.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Business } from '../auth/entities/business.entity';
import { User } from '../auth/entities/user.entity';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, StockItem, Business, User]),
    forwardRef(() => WhatsappModule),
    ConfigModule,
    AuthModule,
  ],
  providers: [ReportService, ReportSchedulerService, PDFGenerationService],
  controllers: [ReportController],
  exports: [ReportService, ReportSchedulerService, PDFGenerationService],
})
export class ReportModule {}