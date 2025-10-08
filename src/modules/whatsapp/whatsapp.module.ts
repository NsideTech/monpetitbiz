import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { BotController } from './bot.controller';
import { HealthController } from './health.controller';
import { WebhookSecurityService } from './services/webhook-security.service';
import { MessageParserService } from './services/message-parser.service';
import { MessageQueueService } from './services/message-queue.service';
import { CommandParserService } from './services/command-parser.service';
import { NLPService } from './services/nlp.service';
import { AuthModule } from '../auth/auth.module';
import { TransactionModule } from '../transaction/transaction.module';
import { StockModule } from '../stock/stock.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TransactionModule,
    StockModule,
    forwardRef(() => ReportModule),
  ],
  providers: [
    WhatsappService,
    BotController,
    WebhookSecurityService,
    MessageParserService,
    MessageQueueService,
    CommandParserService,
    NLPService,
  ],
  controllers: [WhatsappController, HealthController],
  exports: [WhatsappService, BotController, MessageQueueService, NLPService, CommandParserService],
})
export class WhatsappModule implements OnModuleInit {
  constructor(
    private readonly messageQueueService: MessageQueueService,
    private readonly botController: BotController,
  ) {}

  /**
   * Initialize the module by wiring the bot controller to the message queue
   */
  onModuleInit() {
    this.messageQueueService.setBotController(this.botController);
  }
}