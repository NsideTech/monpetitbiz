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
  /**
   * Generate a valid Twilio SID (34 characters: prefix + 32 hex characters)
   */
  static generateTwilioSid(prefix: string): string {
    const hexChars = '0123456789abcdef';
    let sid = prefix;
    for (let i = 0; i < 32; i++) {
      sid += hexChars[Math.floor(Math.random() * hexChars.length)];
    }
    return sid;
  }

  static incomingMessage(overrides: Partial<TwilioWebhookPayload> = {}): TwilioWebhookPayload {
    return {
      MessageSid: this.generateTwilioSid('SM'),
      AccountSid: this.generateTwilioSid('AC'),
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+14155238886', // Valid Twilio WhatsApp number
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
      MessageSid: this.generateTwilioSid('SM'),
      AccountSid: this.generateTwilioSid('AC'),
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+14155238886', // Valid Twilio WhatsApp number
      Body: '', // Empty body is allowed for media-only messages
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
      MessageSid: this.generateTwilioSid('SM'),
      AccountSid: this.generateTwilioSid('AC'),
      From: 'whatsapp:+14155238886', // Valid Twilio WhatsApp number format
      To: 'whatsapp:+1234567890', // Valid phone number format
      // Body is optional for delivery status webhooks (not required)
      Body: undefined,
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
      MessageSid: this.generateTwilioSid('SM'),
      AccountSid: this.generateTwilioSid('AC'),
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+14155238886', // Valid Twilio WhatsApp number
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
      MessageSid: this.generateTwilioSid('SM'),
      AccountSid: this.generateTwilioSid('AC'),
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