import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { getDatabaseConfig } from './config/database.config';
import { ConfigurationValidatorService } from './config/configuration-validator.service';
import { TwilioConfigService } from './config/twilio.config';

// Import controllers
import { AppController } from './app.controller';

// Import modules
import { AuthModule } from './modules/auth/auth.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { StockModule } from './modules/stock/stock.module';
import { ReportModule } from './modules/report/report.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    
    // Scheduler for automated reports
    ScheduleModule.forRoot(),
    
    // Feature modules
    AuthModule,
    WhatsappModule,
    TransactionModule,
    StockModule,
    ReportModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    ConfigurationValidatorService,
    TwilioConfigService,
  ],
})
export class AppModule {}