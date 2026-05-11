import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationSenderService } from './services/notification-sender.service';
import { RulesEngineService } from './services/rules-engine.service';
import { NotificationScheduler } from './services/notification-scheduler.service';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Business } from '../auth/entities/business.entity';
import { User } from '../auth/entities/user.entity';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Transaction, Business, User]),
    WhatsappModule,
    forwardRef(() => DashboardModule),
  ],
  providers: [NotificationSenderService, RulesEngineService, NotificationScheduler],
  exports: [RulesEngineService],
})
export class NotificationModule {}
