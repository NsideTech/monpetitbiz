import { Injectable, Logger } from '@nestjs/common';
import * as Twilio from 'twilio';
import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { TwilioConfigService } from '../../../config/twilio.config';
import { TwilioErrorHandlerService } from './twilio-error-handler.service';
import { TwilioLoggerService } from './twilio-logger.service';

@Injectable()
export class TwilioWhatsAppService {
  private readonly logger = new Logger(TwilioWhatsAppService.name);
  private twilioClient: Twilio.Twilio;

  constructor(
    private readonly twilioConfig: TwilioConfigService,
    private readonly errorHandler: TwilioErrorHandlerService,
    private readonly twilioLogger: TwilioLoggerService
  ) {
    this.initializeTwilioClient();
  }

  private initializeTwilioClient(): void {
    try {
      const config = this.twilioConfig.getTwilioConfig();
      this.twilioClient = Twilio(config.accountSid, config.authToken);
      this.logger.log('Twilio client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Twilio client:', error.message);
      throw error;
    }
  }

  /**
   * Send a WhatsApp message using Twilio SDK
   */
  async sendMessage(to: string, message: string): Promise<MessageInstance> {
    return this.errorHandler.executeWithRetry(
      async () => {
        const config = this.twilioConfig.getTwilioConfig();
        const formattedTo = this.formatPhoneNumber(to);
        const formattedFrom = this.formatWhatsAppNumber(config.whatsappNumber);

        this.logger.debug(`Sending message to ${formattedTo} from ${formattedFrom}`);

        const messageInstance = await this.twilioClient.messages.create({
          body: message,
          from: formattedFrom,
          to: formattedTo,
        });

        this.logger.log(`Message sent successfully: ${messageInstance.sid}`);
        return messageInstance;
      },
      'sendMessage',
      { to, messageLength: message.length }
    );
  }

  /**
   * Send media (PDF/document) via WhatsApp using Twilio SDK
   */
  async sendMedia(
    to: string,
    mediaUrl: string,
    caption?: string,
    fileName?: string
  ): Promise<MessageInstance> {
    return this.errorHandler.executeWithRetry(
      async () => {
        const config = this.twilioConfig.getTwilioConfig();
        const formattedTo = this.formatPhoneNumber(to);
        const formattedFrom = this.formatWhatsAppNumber(config.whatsappNumber);

        this.logger.debug(`Sending media to ${formattedTo} from ${formattedFrom}`);

        const messageOptions: any = {
          from: formattedFrom,
          to: formattedTo,
          mediaUrl: [mediaUrl],
        };

        if (caption) {
          messageOptions.body = caption;
        }

        const messageInstance = await this.twilioClient.messages.create(messageOptions);

        this.logger.log(`Media message sent successfully: ${messageInstance.sid}`);
        return messageInstance;
      },
      'sendMedia',
      { to, mediaUrl, fileName }
    );
  }

  /**
   * Get message status by SID
   */
  async getMessageStatus(messageSid: string): Promise<MessageInstance> {
    return this.errorHandler.executeWithRetry(
      async () => {
        const message = await this.twilioClient.messages(messageSid).fetch();
        return message;
      },
      'getMessageStatus',
      { messageSid }
    );
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, url: string): boolean {
    try {
      const config = this.twilioConfig.getTwilioConfig();

      if (!config.webhookSecret) {
        this.logger.warn('Webhook secret not configured, skipping signature validation');
        return true;
      }

      // Use Twilio's webhook validation utility
      const twilio = require('twilio');
      return twilio.validateRequest(
        config.webhookSecret,
        payload,
        signature,
        url
      );
    } catch (error) {
      this.logger.error('Webhook signature validation failed:', error);
      return false;
    }
  }

  /**
   * Format phone number to E.164 standard for Twilio
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // If it doesn't start with +, assume it's missing country code
    if (!cleaned.startsWith('+')) {
      // Add + if not present
      cleaned = '+' + cleaned;
    }

    // For WhatsApp, prepend with 'whatsapp:'
    return `whatsapp:${cleaned}`;
  }

  /**
   * Format WhatsApp number for Twilio (from number)
   */
  private formatWhatsAppNumber(whatsappNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = whatsappNumber.replace(/[^\d+]/g, '');

    // If it doesn't start with +, add it
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    // For WhatsApp, prepend with 'whatsapp:'
    return `whatsapp:${cleaned}`;
  }

  /**
   * Check if Twilio service is healthy
   */
  async checkHealth(): Promise<{ healthy: boolean; details?: any; correlationId: string }> {
    const correlationId = this.twilioLogger.generateCorrelationId();
    const startTime = Date.now();

    try {
      const config = this.twilioConfig.getTwilioConfig();

      // Try to fetch account information to verify connectivity
      const account = await this.twilioClient.api.accounts(config.accountSid).fetch();

      const duration = Date.now() - startTime;
      const details = {
        accountSid: account.sid,
        status: account.status,
        type: account.type,
      };

      // Log successful health check
      this.twilioLogger.logHealthCheck(correlationId, true, details, duration);

      return {
        healthy: true,
        details,
        correlationId
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorDetails = this.errorHandler.getErrorDetails(error);

      const details = {
        error: error.message,
        category: errorDetails.category,
        severity: errorDetails.severity,
      };

      // Log failed health check
      this.twilioLogger.logHealthCheck(correlationId, false, details, duration);

      this.logger.error('Twilio health check failed:', errorDetails);

      return {
        healthy: false,
        details,
        correlationId
      };
    }
  }
}