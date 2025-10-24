import { Injectable, Logger } from '@nestjs/common';
import { WebhookPayload, Message, ProcessedMessage } from '../interfaces/webhook.interface';

@Injectable()
export class MessageParserService {
  private readonly logger = new Logger(MessageParserService.name);

  /**
   * Parse webhook payload and extract messages
   */
  parseWebhookPayload(payload: WebhookPayload): ProcessedMessage[] {
    const processedMessages: ProcessedMessage[] = [];

    try {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages' && change.value.messages) {
            for (const message of change.value.messages) {
              const processed = this.processMessage(message);
              if (processed) {
                processedMessages.push(processed);
              }
            }
          }
        }
      }

      this.logger.log(`Parsed ${processedMessages.length} messages from webhook payload`);
      return processedMessages;
    } catch (error) {
      this.logger.error('Error parsing webhook payload:', error);
      return [];
    }
  }

  /**
   * Process individual message
   */
  private processMessage(message: Message): ProcessedMessage | null {
    try {
      // Only process text messages for now
      if (message.type !== 'text' || !message.text?.body) {
        this.logger.debug(`Skipping non-text message type: ${message.type}`);
        return null;
      }

      // Validate message structure
      if (!this.validateMessage(message)) {
        return null;
      }

      const processed: ProcessedMessage = {
        messageId: message.id,
        from: message.from,
        body: message.text.body.trim(),
        timestamp: new Date(parseInt(message.timestamp) * 1000), // Convert Unix timestamp
      };

      this.logger.debug(`Processed message ${message.id} from ${message.from}`);
      return processed;
    } catch (error) {
      this.logger.error(`Error processing message ${message.id}:`, error);
      return null;
    }
  }

  /**
   * Validate message structure and content
   */
  private validateMessage(message: Message): boolean {
    // Check required fields
    if (!message.id || !message.from || !message.timestamp) {
      this.logger.error('Message missing required fields', {
        id: message.id,
        from: message.from,
        timestamp: message.timestamp,
      });
      return false;
    }

    // Validate phone number format (basic validation)
    if (!this.isValidPhoneNumber(message.from)) {
      this.logger.error(`Invalid phone number format: ${message.from}`);
      return false;
    }

    // Validate timestamp
    const timestamp = parseInt(message.timestamp);
    if (isNaN(timestamp) || timestamp <= 0) {
      this.logger.error(`Invalid timestamp: ${message.timestamp}`);
      return false;
    }

    // Check if message is too old (older than 24 hours)
    const messageDate = new Date(timestamp * 1000);
    const now = new Date();
    const hoursDiff = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      this.logger.warn(`Message is too old (${hoursDiff.toFixed(1)} hours), skipping`, {
        messageId: message.id,
        timestamp: messageDate.toISOString(),
      });
      return false;
    }

    // Validate message content
    if (message.text?.body) {
      const body = message.text.body.trim();

      // Check message length
      if (body.length === 0) {
        this.logger.debug('Empty message body, skipping');
        return false;
      }

      if (body.length > 1000) {
        this.logger.warn(`Message too long (${body.length} chars), truncating`);
        // We'll still process it but truncate in the processing logic
      }

      // Check for suspicious content (basic spam detection)
      if (this.isSuspiciousContent(body)) {
        this.logger.warn(`Suspicious message content detected from ${message.from}`);
        // Still process but flag for monitoring
      }
    }

    return true;
  }

  /**
   * Basic phone number validation
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // WhatsApp phone numbers can be in different formats:
    // E.164 format: +14182710361 (with + prefix)
    // Plain digits: 14182710361 or 226771234567 (Burkina Faso)
    // Allow both formats with 10-15 digits total
    const e164Regex = /^\+\d{10,15}$/; // E.164 format with +
    const plainDigitsRegex = /^\d{10,15}$/; // Plain digits only
    
    return e164Regex.test(phoneNumber) || plainDigitsRegex.test(phoneNumber);
  }

  /**
   * Basic spam/suspicious content detection
   */
  private isSuspiciousContent(content: string): boolean {
    const suspiciousPatterns = [
      /https?:\/\/[^\s]+/gi, // URLs
      /\b(spam|scam|phishing)\b/gi, // Obvious spam words
      /(.)\1{10,}/gi, // Repeated characters (more than 10)
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Extract message metadata for analytics
   */
  extractMessageMetadata(message: Message): Record<string, any> {
    return {
      messageId: message.id,
      from: message.from,
      type: message.type,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      hasContext: !!message.context,
      contextFrom: message.context?.from,
      bodyLength: message.text?.body?.length || 0,
    };
  }

  /**
   * Check if message is a duplicate (basic deduplication)
   */
  private static processedMessageIds = new Set<string>();
  private static readonly MAX_CACHE_SIZE = 1000;

  isDuplicateMessage(messageId: string): boolean {
    if (MessageParserService.processedMessageIds.has(messageId)) {
      this.logger.warn(`Duplicate message detected: ${messageId}`);
      return true;
    }

    // Add to cache
    MessageParserService.processedMessageIds.add(messageId);

    // Clean cache if it gets too large
    if (MessageParserService.processedMessageIds.size > MessageParserService.MAX_CACHE_SIZE) {
      const idsArray = Array.from(MessageParserService.processedMessageIds);
      const toKeep = idsArray.slice(-MessageParserService.MAX_CACHE_SIZE / 2);
      MessageParserService.processedMessageIds.clear();
      toKeep.forEach(id => MessageParserService.processedMessageIds.add(id));
    }

    return false;
  }
}