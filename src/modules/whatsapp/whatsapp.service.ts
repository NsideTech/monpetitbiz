import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSecurityService } from './services/webhook-security.service';
import { MessageParserService } from './services/message-parser.service';
import { MessageQueueService } from './services/message-queue.service';
import { WebhookPayload } from './interfaces/webhook.interface';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookSecurity: WebhookSecurityService,
    private readonly messageParser: MessageParserService,
    private readonly messageQueue: MessageQueueService,
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
    rawBody?: string
  ): Promise<{ messagesProcessed: number; errors: string[] }> {
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
      const messages = this.messageParser.parseWebhookPayload(payload);
      
      if (messages.length === 0) {
        this.logger.debug('No processable messages found in webhook payload');
        return { messagesProcessed: 0, errors: [] };
      }

      // Process each message
      for (const message of messages) {
        try {
          // Check for duplicates
          if (this.messageParser.isDuplicateMessage(message.messageId)) {
            this.logger.warn(`Skipping duplicate message: ${message.messageId}`);
            continue;
          }

          // Add to processing queue
          await this.messageQueue.enqueue(message);
          messagesProcessed++;

          this.logger.debug(`Queued message ${message.messageId} for processing`);
        } catch (error) {
          const errorMsg = `Failed to queue message ${message.messageId}: ${error.message}`;
          this.logger.error(errorMsg);
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
   * Send a WhatsApp message
   */
  async sendMessage(to: string, message: string): Promise<void> {
    try {
      const accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN');
      const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');

      if (!accessToken || !phoneNumberId) {
        this.logger.error('WhatsApp API credentials not configured');
        throw new Error('WhatsApp API credentials not configured');
      }

      // Format phone number (remove any non-digit characters except +)
      const formattedPhone = to.replace(/[^\d+]/g, '');

      const payload = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      this.logger.log(`Message sent successfully to ${formattedPhone}: ${result.messages?.[0]?.id}`);
      
    } catch (error) {
      this.logger.error(`Failed to send message to ${to}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a PDF document via WhatsApp
   */
  async sendPDFDocument(
    to: string, 
    documentUrl: string, 
    fileName: string, 
    caption?: string
  ): Promise<void> {
    try {
      const accessToken = this.configService.get('WHATSAPP_ACCESS_TOKEN');
      const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID');

      if (!accessToken || !phoneNumberId) {
        this.logger.error('WhatsApp API credentials not configured');
        throw new Error('WhatsApp API credentials not configured');
      }

      // Format phone number (remove any non-digit characters except +)
      const formattedPhone = to.replace(/[^\d+]/g, '');

      const payload = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'document',
        document: {
          link: documentUrl,
          filename: fileName,
          caption: caption || `Rapport financier - ${fileName}`
        }
      };

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      this.logger.log(`PDF document sent successfully to ${formattedPhone}: ${result.messages?.[0]?.id}`);
      
    } catch (error) {
      this.logger.error(`Failed to send PDF document to ${to}: ${error.message}`);
      throw error;
    }
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
}