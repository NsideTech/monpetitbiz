import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSecurityService {
  private readonly logger = new Logger(WebhookSecurityService.name);
  private readonly appSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.appSecret = this.configService.get<string>('WHATSAPP_APP_SECRET');
    
    if (!this.appSecret) {
      this.logger.warn('WHATSAPP_APP_SECRET not configured. Webhook signature verification will be skipped.');
    }
  }

  /**
   * Verify webhook signature from WhatsApp
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.appSecret) {
      this.logger.warn('Skipping signature verification - WHATSAPP_APP_SECRET not configured');
      return true; // Allow in development/testing
    }

    if (!signature) {
      this.logger.error('No signature provided in webhook request');
      return false;
    }

    try {
      // WhatsApp sends signature as "sha256=<hash>"
      const expectedSignature = signature.startsWith('sha256=') 
        ? signature 
        : `sha256=${signature}`;

      // Generate expected signature
      const hmac = crypto.createHmac('sha256', this.appSecret);
      hmac.update(payload, 'utf8');
      const computedSignature = `sha256=${hmac.digest('hex')}`;

      // Use timing-safe comparison to prevent timing attacks
      const expectedBuffer = Buffer.from(expectedSignature);
      const computedBuffer = Buffer.from(computedSignature);
      
      if (expectedBuffer.length !== computedBuffer.length) {
        this.logger.error('Webhook signature length mismatch');
        return false;
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, computedBuffer);

      if (!isValid) {
        this.logger.error('Webhook signature verification failed', {
          expected: computedSignature,
          received: expectedSignature,
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Verify webhook verification token for initial setup
   */
  verifyWebhookToken(token: string): boolean {
    const expectedToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    
    if (!expectedToken) {
      this.logger.error('WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured');
      return false;
    }

    // Ensure both buffers have the same length for timingSafeEqual
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expectedToken);
    
    if (tokenBuffer.length !== expectedBuffer.length) {
      this.logger.error('Webhook verification token length mismatch');
      return false;
    }

    const isValid = crypto.timingSafeEqual(tokenBuffer, expectedBuffer);

    if (!isValid) {
      this.logger.error('Webhook verification token mismatch');
    }

    return isValid;
  }

  /**
   * Validate request origin and rate limiting
   */
  validateRequest(req: any): void {
    // Check for required headers
    const userAgent = req.headers['user-agent'];
    if (!userAgent || !userAgent.includes('WhatsApp')) {
      this.logger.warn('Suspicious request - invalid user agent', { userAgent });
    }

    // Basic rate limiting check (can be enhanced with Redis)
    const clientIp = req.ip || req.connection.remoteAddress;
    this.logger.debug(`Webhook request from IP: ${clientIp}`);

    // TODO: Implement more sophisticated rate limiting
    // - Track requests per IP per minute
    // - Block suspicious IPs
    // - Implement exponential backoff for repeated failures
  }

  /**
   * Sanitize and validate payload structure
   */
  validatePayloadStructure(payload: any): boolean {
    try {
      // Basic structure validation
      if (!payload || typeof payload !== 'object') {
        this.logger.error('Invalid payload structure - not an object');
        return false;
      }

      if (!payload.object || payload.object !== 'whatsapp_business_account') {
        this.logger.error('Invalid payload structure - incorrect object type', {
          object: payload.object,
        });
        return false;
      }

      if (!Array.isArray(payload.entry)) {
        this.logger.error('Invalid payload structure - entry is not an array');
        return false;
      }

      // Validate each entry
      for (const entry of payload.entry) {
        if (!entry.id || !Array.isArray(entry.changes)) {
          this.logger.error('Invalid entry structure', { entry });
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error validating payload structure:', error);
      return false;
    }
  }

  /**
   * Extract and validate phone number ID from payload
   * Accepts Twilio payloads (phone_number_id: 'twilio_phone_id') and Meta payloads
   */
  validatePhoneNumberId(payload: any): boolean {
    try {
      const expectedPhoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
      
      if (!expectedPhoneNumberId) {
        this.logger.warn('WHATSAPP_PHONE_NUMBER_ID not configured - skipping validation');
        return true;
      }

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          const phoneNumberId = change.value?.metadata?.phone_number_id;
          
          // Accept Twilio phone number ID (converted payloads use 'twilio_phone_id')
          if (phoneNumberId === 'twilio_phone_id' || phoneNumberId === 'twilio-converted') {
            this.logger.debug('Twilio phone number ID detected, skipping Meta validation');
            return true;
          }
          
          if (phoneNumberId && phoneNumberId !== expectedPhoneNumberId) {
            this.logger.error('Phone number ID mismatch', {
              expected: expectedPhoneNumberId,
              received: phoneNumberId,
            });
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error validating phone number ID:', error);
      return false;
    }
  }
}