import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { TwilioWebhookPayloadDto } from '../dto/twilio-webhook.dto';

export interface ProcessedTwilioMessage {
  messageId: string;
  from: string;
  body: string;
  timestamp: Date;
  provider: 'twilio';
  twilioData: {
    accountSid: string;
    messagingServiceSid?: string;
    profileName?: string;
    waId: string;
    smsStatus: string;
    to: string;
  };
}

@Injectable()
export class TwilioMessageParser {
  private readonly logger = new Logger(TwilioMessageParser.name);
  private readonly processedMessages = new Set<string>();

  /**
   * Parse Twilio webhook payload directly without conversion
   */
  parseWebhookPayload(payload: TwilioWebhookPayloadDto): ProcessedTwilioMessage {
    this.logger.debug('Parsing Twilio webhook payload', {
      MessageSid: payload.MessageSid,
      From: payload.From,
      SmsStatus: payload.SmsStatus
    });

    try {
      // Validate payload structure
      this.validatePayload(payload);

      // Extract phone number from Twilio format
      const from = this.extractPhoneNumber(payload.From);
      const to = this.extractPhoneNumber(payload.To);

      // Create processed message
      const processedMessage: ProcessedTwilioMessage = {
        messageId: payload.MessageSid,
        from: from,
        body: payload.Body || '',
        timestamp: new Date(),
        provider: 'twilio',
        twilioData: {
          accountSid: payload.AccountSid,
          messagingServiceSid: payload.MessagingServiceSid,
          profileName: payload.ProfileName,
          waId: payload.WaId || from.replace('+', ''),
          smsStatus: payload.SmsStatus,
          to: to,
        }
      };

      this.logger.debug('Successfully parsed Twilio message', {
        messageId: processedMessage.messageId,
        from: processedMessage.from,
        bodyLength: processedMessage.body.length
      });

      return processedMessage;
    } catch (error) {
      this.logger.error('Failed to parse Twilio webhook payload:', error);
      throw new BadRequestException(`Invalid Twilio webhook payload: ${error.message}`);
    }
  }

  /**
   * Validate Twilio webhook payload structure
   */
  validatePayload(payload: TwilioWebhookPayloadDto): boolean {
    const errors: string[] = [];

    // Required fields validation
    if (!payload.MessageSid) {
      errors.push('MessageSid is required');
    }

    if (!payload.AccountSid) {
      errors.push('AccountSid is required');
    }

    if (!payload.From) {
      errors.push('From field is required');
    }

    if (!payload.To) {
      errors.push('To field is required');
    }

    if (!payload.SmsStatus) {
      errors.push('SmsStatus is required');
    }

    // Format validation
    if (payload.From && !this.isValidTwilioPhoneFormat(payload.From)) {
      errors.push('From field must be in format whatsapp:+[country_code][number]');
    }

    if (payload.To && !this.isValidTwilioPhoneFormat(payload.To)) {
      errors.push('To field must be in format whatsapp:+[country_code][number]');
    }

    // MessageSid format validation
    if (payload.MessageSid && !this.isValidMessageSid(payload.MessageSid)) {
      errors.push('MessageSid must be a valid Twilio SID format');
    }

    // Body validation for received messages
    if (payload.SmsStatus === 'received' && !payload.Body) {
      errors.push('Body is required for received messages');
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Payload validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Extract phone number from Twilio format (whatsapp:+number)
   */
  extractPhoneNumber(twilioFormat: string): string {
    if (!twilioFormat) {
      throw new BadRequestException('Phone number cannot be empty');
    }

    // Remove 'whatsapp:' prefix
    if (twilioFormat.startsWith('whatsapp:')) {
      const phoneNumber = twilioFormat.replace('whatsapp:', '');
      
      // Validate E.164 format
      if (!this.isValidE164Format(phoneNumber)) {
        throw new BadRequestException(`Invalid phone number format: ${phoneNumber}`);
      }
      
      return phoneNumber;
    }

    throw new BadRequestException(`Invalid Twilio phone format: ${twilioFormat}`);
  }

  /**
   * Implement message deduplication using Twilio MessageSid
   */
  isMessageProcessed(messageSid: string): boolean {
    return this.processedMessages.has(messageSid);
  }

  /**
   * Mark message as processed for deduplication
   */
  markMessageAsProcessed(messageSid: string): void {
    this.processedMessages.add(messageSid);
    
    // Clean up old entries to prevent memory leaks
    // Keep only the last 1000 processed messages
    if (this.processedMessages.size > 1000) {
      const entries = Array.from(this.processedMessages);
      this.processedMessages.clear();
      
      // Keep the most recent 500 entries
      entries.slice(-500).forEach(sid => this.processedMessages.add(sid));
    }
  }

  /**
   * Get deduplication statistics
   */
  getDeduplicationStats(): { totalProcessed: number; cacheSize: number } {
    return {
      totalProcessed: this.processedMessages.size,
      cacheSize: this.processedMessages.size
    };
  }

  /**
   * Clear deduplication cache (for testing purposes)
   */
  clearDeduplicationCache(): void {
    this.processedMessages.clear();
    this.logger.debug('Deduplication cache cleared');
  }

  /**
   * Validate Twilio phone number format
   */
  private isValidTwilioPhoneFormat(phone: string): boolean {
    // Should match: whatsapp:+[country_code][number]
    const twilioPhoneRegex = /^whatsapp:\+\d{1,15}$/;
    return twilioPhoneRegex.test(phone);
  }

  /**
   * Validate E.164 phone number format
   */
  private isValidE164Format(phone: string): boolean {
    // E.164 format: +[country_code][number] (max 15 digits total)
    const e164Regex = /^\+\d{1,15}$/;
    return e164Regex.test(phone);
  }

  /**
   * Validate Twilio MessageSid format
   */
  private isValidMessageSid(messageSid: string): boolean {
    // Twilio SIDs are 34 characters long and start with specific prefixes
    // MessageSid starts with 'SM' followed by 32 alphanumeric characters
    const sidRegex = /^SM[a-f0-9]{32}$/i;
    return sidRegex.test(messageSid);
  }

  /**
   * Extract media information from Twilio payload (for future media support)
   */
  extractMediaInfo(payload: TwilioWebhookPayloadDto): Array<{ url: string; contentType: string }> {
    const mediaItems: Array<{ url: string; contentType: string }> = [];
    
    const numMedia = parseInt(payload.NumMedia || '0', 10);
    
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = payload[`MediaUrl${i}` as keyof TwilioWebhookPayloadDto] as string;
      const contentType = payload[`MediaContentType${i}` as keyof TwilioWebhookPayloadDto] as string;
      
      if (mediaUrl && contentType) {
        mediaItems.push({
          url: mediaUrl,
          contentType: contentType
        });
      }
    }
    
    return mediaItems;
  }

  /**
   * Convert Twilio status to internal status format
   */
  convertTwilioStatus(twilioStatus: string): 'sent' | 'delivered' | 'read' | 'failed' {
    switch (twilioStatus.toLowerCase()) {
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
      case 'undelivered':
        return 'failed';
      default:
        this.logger.warn(`Unknown Twilio status: ${twilioStatus}, defaulting to 'sent'`);
        return 'sent';
    }
  }

  /**
   * Parse Twilio error information from webhook
   */
  parseErrorInfo(payload: TwilioWebhookPayloadDto): { errorCode?: string; errorMessage?: string } | null {
    // Twilio includes error information in failed message webhooks
    // This would be extended based on actual Twilio error webhook format
    if (payload.SmsStatus === 'failed') {
      return {
        errorCode: 'TWILIO_DELIVERY_FAILED',
        errorMessage: 'Message delivery failed'
      };
    }
    
    return null;
  }

  /**
   * Generate correlation ID for message tracking
   */
  generateCorrelationId(payload: TwilioWebhookPayloadDto): string {
    return `twilio-${payload.MessageSid}-${Date.now()}`;
  }
}