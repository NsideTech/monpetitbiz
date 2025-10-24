import { TwilioWebhookPayloadDto } from '../dto/twilio-webhook.dto';

// Type alias for easier usage in tests
export type TwilioWebhookPayload = TwilioWebhookPayloadDto;

/**
 * Mock Twilio webhook payloads for testing
 */
export class TwilioWebhookMock {
  /**
   * Generate a basic incoming message webhook payload
   */
  static incomingMessage(overrides: Partial<TwilioWebhookPayload> = {}): TwilioWebhookPayload {
    return {
      MessageSid: 'SM' + Math.random().toString(36).substr(2, 32),
      AccountSid: 'AC' + Math.random().toString(36).substr(2, 32),
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+0987654321',
      Body: 'Hello, this is a test message',
      ProfileName: 'Test User',
      WaId: '1234567890',
      SmsStatus: 'received',
      NumMedia: '0',
      ...overrides,
    };
  }

  /**
   * Generate a message with media webhook payload
   */
  static incomingMediaMessage(overrides: Partial<TwilioWebhookPayload> = {}): TwilioWebhookPayload {
    return {
      MessageSid: 'SM' + Math.random().toString(36).substr(2, 32),
      AccountSid: 'AC' + Math.random().toString(36).substr(2, 32),
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+0987654321',
      Body: '',
      ProfileName: 'Test User',
      WaId: '1234567890',
      SmsStatus: 'received',
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC.../Messages/SM.../Media/ME...',
      MediaContentType0: 'image/jpeg',
      ...overrides,
    };
  }

  /**
   * Generate a delivery status webhook payload
   */
  static deliveryStatus(status: 'sent' | 'delivered' | 'failed' | 'undelivered', overrides: Partial<TwilioWebhookPayload> = {}): TwilioWebhookPayload {
    const payload: TwilioWebhookPayload = {
      MessageSid: 'SM' + Math.random().toString(36).substr(2, 32),
      AccountSid: 'AC' + Math.random().toString(36).substr(2, 32),
      From: 'whatsapp:+0987654321',
      To: 'whatsapp:+1234567890',
      Body: '',
      SmsStatus: status,
      ...overrides,
    };

    return payload;
  }

  /**
   * Generate webhook payload for business commands
   */
  static businessCommand(command: string, overrides: Partial<TwilioWebhookPayload> = {}): TwilioWebhookPayload {
    return {
      MessageSid: 'SM' + Math.random().toString(36).substr(2, 32),
      AccountSid: 'AC' + Math.random().toString(36).substr(2, 32),
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+0987654321',
      Body: command,
      ProfileName: 'Business User',
      WaId: '1234567890',
      SmsStatus: 'received',
      NumMedia: '0',
      ...overrides,
    };
  }

  /**
   * Generate webhook payload for registration flow
   */
  static registrationMessage(step: 'start' | 'business_code' | 'employee_name', overrides: Partial<TwilioWebhookPayload> = {}): TwilioWebhookPayload {
    const messages = {
      start: 'register',
      business_code: 'ABC123',
      employee_name: 'John Doe',
    };

    return {
      MessageSid: 'SM' + Math.random().toString(36).substr(2, 32),
      AccountSid: 'AC' + Math.random().toString(36).substr(2, 32),
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+0987654321',
      Body: messages[step],
      ProfileName: 'New Employee',
      WaId: '1234567890',
      SmsStatus: 'received',
      NumMedia: '0',
      ...overrides,
    };
  }

  /**
   * Generate invalid webhook payload for error testing
   */
  static invalidPayload(): Partial<TwilioWebhookPayload> {
    return {
      MessageSid: 'INVALID_SID',
      // Missing required fields
      Body: 'Test message',
    };
  }

  /**
   * Generate webhook signature for testing signature verification
   */
  static generateSignature(payload: string, authToken: string, url: string): string {
    const crypto = require('crypto');
    const data = url + payload;
    return crypto
      .createHmac('sha1', authToken)
      .update(data, 'utf-8')
      .digest('base64');
  }

  /**
   * Convert payload to URL-encoded string (as Twilio sends it)
   */
  static toUrlEncoded(payload: TwilioWebhookPayload): string {
    return Object.entries(payload)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
  }
}