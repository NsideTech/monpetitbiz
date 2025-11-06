import { Injectable, Logger, UnauthorizedException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSecurityService } from './services/webhook-security.service';
import { MessageParserService } from './services/message-parser.service';
import { MessageQueueService } from './services/message-queue.service';
import { WebhookPayload } from './interfaces/webhook.interface';
import { DualProviderService, WhatsAppProvider } from './services/dual-provider.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookSecurity: WebhookSecurityService,
    private readonly messageParser: MessageParserService,
    private readonly messageQueue: MessageQueueService,
    @Inject(forwardRef(() => DualProviderService))
    private readonly dualProviderService?: DualProviderService,
  ) {}

  /**
   * Verify webhook during initial setup
   */
  async verifyWebhook(mode: string, challenge: string, verifyToken: string): Promise<string> {
    this.logger.log('Verifying webhook setup');

    // Check if this is a subscription verification
    if (mode !== 'subscribe') {
      throw new UnauthorizedException('Invalid hub mode');
    }

    // Verify the token
    if (!this.webhookSecurity.verifyWebhookToken(verifyToken)) {
      throw new UnauthorizedException('Invalid verify token');
    }

    this.logger.log('Webhook verification successful');
    return challenge;
  }

  /**
   * Process incoming webhook payload
   */
  async processWebhook(
    payload: WebhookPayload, 
    signature?: string, 
    rawBody?: string,
    source: WhatsAppProvider = 'meta'
  ): Promise<{ messagesProcessed: number; errors: string[] }> {
    // Use dual provider service if available and source is not meta
    if (this.dualProviderService && source !== 'meta') {
      const result = await this.dualProviderService.processWebhook(payload, source, signature, rawBody);
      return { 
        messagesProcessed: result.messagesProcessed, 
        errors: result.errors 
      };
    }

    // Process webhook directly (for Meta or when dual provider is not available)
    return this.processWebhookDirect(payload, signature, rawBody);
  }

  /**
   * Process webhook payload directly without dual provider routing
   */
  async processWebhookDirect(
    payload: WebhookPayload, 
    signature?: string, 
    rawBody?: string
  ): Promise<{ messagesProcessed: number; errors: string[] }> {
    // Original Meta webhook processing
    const errors: string[] = [];
    let messagesProcessed = 0;

    try {
      // Verify webhook signature if provided
      if (signature && rawBody) {
        if (!this.webhookSecurity.verifyWebhookSignature(rawBody, signature)) {
          throw new UnauthorizedException('Invalid webhook signature');
        }
      }

      // Validate payload structure
      if (!this.webhookSecurity.validatePayloadStructure(payload)) {
        throw new BadRequestException('Invalid payload structure');
      }

      // Validate phone number ID
      if (!this.webhookSecurity.validatePhoneNumberId(payload)) {
        throw new UnauthorizedException('Invalid phone number ID');
      }

      // Parse messages from payload
      this.logger.debug('Parsing messages from webhook payload...');
      const messages = this.messageParser.parseWebhookPayload(payload);
      this.logger.debug(`Parsed ${messages.length} messages from payload`);
      
      if (messages.length === 0) {
        this.logger.warn('No processable messages found in webhook payload');
        return { messagesProcessed: 0, errors: [] };
      }

      // Process each message
      for (const message of messages) {
        try {
          this.logger.debug(`Processing message ${message.messageId} from ${message.from}`);
          
          // Check for duplicates
          if (this.messageParser.isDuplicateMessage(message.messageId)) {
            this.logger.warn(`Skipping duplicate message: ${message.messageId}`);
            continue;
          }

          // For Vercel serverless, we need to process critical messages synchronously
          // to ensure they complete before the function terminates
          // Critical messages include registration/onboarding commands
          const isCriticalMessage = this.isCriticalMessage(message);
          
          if (isCriticalMessage) {
            this.logger.log(`Processing critical message ${message.messageId} synchronously for Vercel compatibility`);
            // Process synchronously to ensure completion on Vercel
            await this.processMessageSynchronously(message);
            messagesProcessed++;
            this.logger.log(`Successfully processed critical message ${message.messageId}`);
          } else {
            // Add to processing queue for non-critical messages
            this.logger.debug(`Enqueueing message ${message.messageId} to message queue...`);
            await this.messageQueue.enqueue(message);
            messagesProcessed++;
            this.logger.log(`Successfully queued message ${message.messageId} for processing`);
          }
        } catch (error) {
          const errorMsg = `Failed to process message ${message.messageId}: ${error.message}`;
          this.logger.error(errorMsg, error.stack);
          errors.push(errorMsg);
        }
      }

      this.logger.log(`Webhook processing completed: ${messagesProcessed} messages queued, ${errors.length} errors`);
      
      return { messagesProcessed, errors };
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      throw error;
    }
  }

  /**
   * Get message queue statistics
   */
  async getQueueStats(): Promise<any> {
    return this.messageQueue.getQueueStats();
  }

  /**
   * Check if a message is critical and should be processed synchronously
   * Critical messages include registration/onboarding commands that need immediate response
   */
  private isCriticalMessage(message: any): boolean {
    const messageBody = (message.body || '').toLowerCase().trim();
    
    // Critical keywords for registration/onboarding
    const criticalKeywords = [
      'créer une nouvelle entreprise',
      'créer nouvelle entreprise',
      'nouvelle entreprise',
      'créer entreprise',
      'inscription',
      'register',
      'bonjour',
      'hello',
      'aide',
      'help'
    ];
    
    return criticalKeywords.some(keyword => messageBody.includes(keyword));
  }

  /**
   * Process a message synchronously (for critical messages on Vercel)
   * This ensures the message is processed before the serverless function terminates
   */
  private async processMessageSynchronously(message: any): Promise<void> {
    try {
      // Use the message queue's bot controller to process the message directly
      // This bypasses the async queue for critical messages
      const botController = this.messageQueue.getBotController();
      
      if (botController) {
        this.logger.debug(`Processing message ${message.messageId} synchronously via BotController`);
        await botController.processMessage(message);
        this.logger.debug(`Successfully processed message ${message.messageId} synchronously`);
      } else {
        // Fallback to queue if bot controller not available
        this.logger.warn('Bot controller not available, falling back to queue');
        await this.messageQueue.enqueue(message);
      }
    } catch (error) {
      this.logger.error(`Error processing message ${message.messageId} synchronously:`, error);
      this.logger.error(`Error stack: ${error.stack}`);
      // Fallback to queue on error
      await this.messageQueue.enqueue(message);
    }
  }

  /**
   * Send a WhatsApp message
   */
  async sendMessage(
    to: string, 
    message: string, 
    preferredProvider?: WhatsAppProvider
  ): Promise<void> {
    // Use dual provider service if available (defaults to Twilio)
    if (this.dualProviderService) {
      const result = await this.dualProviderService.sendMessage(to, message, preferredProvider || 'twilio');
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
      return;
    }

    // Fallback to direct Meta API implementation (deprecated - use dual provider service)
    this.logger.warn('Using deprecated Meta API fallback. Consider configuring dual provider service.');
    throw new Error('Direct Meta API calls are deprecated. Please configure Twilio or dual provider service.');
  }

  /**
   * Send a PDF document via WhatsApp
   */
  async sendPDFDocument(
    to: string, 
    documentUrl: string, 
    fileName: string, 
    caption?: string,
    preferredProvider?: WhatsAppProvider
  ): Promise<void> {
    // Use dual provider service if available (defaults to Twilio)
    if (this.dualProviderService) {
      const result = await this.dualProviderService.sendMedia(
        to, 
        documentUrl, 
        caption || `Rapport financier - ${fileName}`, 
        fileName, 
        preferredProvider || 'twilio'
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to send PDF document');
      }
      return;
    }

    // Fallback to direct Meta API implementation (deprecated - use dual provider service)
    this.logger.warn('Using deprecated Meta API fallback. Consider configuring dual provider service.');
    throw new Error('Direct Meta API calls are deprecated. Please configure Twilio or dual provider service.');
  }

  /**
   * Get webhook configuration status
   */
  getWebhookConfig(): {
    hasVerifyToken: boolean;
    hasAppSecret: boolean;
    hasPhoneNumberId: boolean;
    hasAccessToken: boolean;
  } {
    return {
      hasVerifyToken: !!this.configService.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN'),
      hasAppSecret: !!this.configService.get('WHATSAPP_APP_SECRET'),
      hasPhoneNumberId: !!this.configService.get('WHATSAPP_PHONE_NUMBER_ID'),
      hasAccessToken: !!this.configService.get('WHATSAPP_ACCESS_TOKEN'),
    };
  }

  /**
   * Get provider configuration and health status
   */
  async getProviderStatus(): Promise<{
    dualProviderEnabled: boolean;
    providerHealth?: any;
    providerConfiguration?: any;
  }> {
    if (!this.dualProviderService) {
      return { dualProviderEnabled: false };
    }

    const [providerHealth, providerConfiguration] = await Promise.all([
      this.dualProviderService.getProviderHealth(),
      Promise.resolve(this.dualProviderService.getProviderConfiguration()),
    ]);

    return {
      dualProviderEnabled: true,
      providerHealth,
      providerConfiguration,
    };
  }

  /**
   * Send message with specific provider (convenience method)
   */
  async sendMessageWithProvider(
    to: string, 
    message: string, 
    provider: WhatsAppProvider
  ): Promise<void> {
    return this.sendMessage(to, message, provider);
  }

  /**
   * Send PDF document with specific provider (convenience method)
   */
  async sendPDFDocumentWithProvider(
    to: string, 
    documentUrl: string, 
    fileName: string, 
    caption?: string,
    provider?: WhatsAppProvider
  ): Promise<void> {
    return this.sendPDFDocument(to, documentUrl, fileName, caption, provider);
  }
}