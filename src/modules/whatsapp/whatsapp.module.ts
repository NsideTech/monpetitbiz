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
import { ConversationStateService } from './services/conversation-state.service';
import { RegistrationHandlerService } from './services/registration-handler.service';
import { ConflictResolutionService } from './services/conflict-resolution.service';
import { OnboardingMessagesService } from './services/onboarding-messages.service';
import { OnboardingCheckMiddleware } from './middleware/onboarding-check.middleware';
import { HelpService } from './services/help.service';
import { UnitCommandHandler } from './services/unit-command-handler.service';
import { ConfirmationStateService } from './services/confirmation-state.service';
import { TwilioMessageParser } from './services/twilio-message-parser.service';
import { TwilioWebhookController } from './controllers/twilio-webhook.controller';
import { WebhookTestController } from './controllers/webhook-test.controller';
import { TwilioConfigService } from '../../config/twilio.config';
import { TwilioWhatsAppService } from './services/twilio-whatsapp.service';
import { TwilioErrorHandlerService } from './services/twilio-error-handler.service';
import { TwilioLoggerService } from './services/twilio-logger.service';
import { DualProviderService } from './services/dual-provider.service';
import { MigrationValidationService } from './services/migration-validation.service';
import { MigrationValidationController } from './controllers/migration-validation.controller';
import { AuthModule } from '../auth/auth.module';
import { TransactionModule } from '../transaction/transaction.module';
import { StockModule } from '../stock/stock.module';
import { ReportModule } from '../report/report.module';
import { CartCreateHandler } from './handlers/cart-create-handler';
import { CartHandlers } from './handlers/cart-handlers';
import { SaleSessionService } from './services/sale-session.service';
import { InvoiceModule } from '../invoice/invoice.module';
import { ReceivableModule } from '../receivable/receivable.module';
import { LoanModule } from '../loan/loan.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TransactionModule,
    StockModule,
    InvoiceModule,
    ReceivableModule,
    LoanModule,
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
    ConversationStateService,
    RegistrationHandlerService,
    ConflictResolutionService,
    OnboardingMessagesService,
    OnboardingCheckMiddleware,
    HelpService,
    UnitCommandHandler,
    ConfirmationStateService,
    TwilioMessageParser,
    TwilioConfigService,
    TwilioErrorHandlerService,
    TwilioLoggerService,
    TwilioWhatsAppService,
    DualProviderService,
    MigrationValidationService,
    SaleSessionService,
    CartCreateHandler,
    CartHandlers,
  ],
  controllers: [WhatsappController, HealthController, TwilioWebhookController, WebhookTestController, MigrationValidationController],
  exports: [WhatsappService, BotController, MessageQueueService, NLPService, CommandParserService, ConversationStateService, RegistrationHandlerService, ConflictResolutionService, OnboardingMessagesService, OnboardingCheckMiddleware, TwilioMessageParser, TwilioLoggerService, TwilioWhatsAppService, DualProviderService, MigrationValidationService],
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