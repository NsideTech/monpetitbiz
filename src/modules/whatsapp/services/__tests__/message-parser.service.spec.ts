import { Test, TestingModule } from '@nestjs/testing';
import { MessageParserService } from '../message-parser.service';
import { WebhookPayload, Message } from '../../interfaces/webhook.interface';

describe('MessageParserService', () => {
  let service: MessageParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessageParserService],
    }).compile();

    service = module.get<MessageParserService>(MessageParserService);
  });

  describe('parseWebhookPayload', () => {
    it('should parse valid webhook payload with text messages', () => {
      // Use a recent timestamp to avoid the "too old" validation
      const recentTimestamp = Math.floor(Date.now() / 1000).toString();
      
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'test-entry',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'test-phone-id',
                  },
                  messages: [
                    {
                      id: 'msg-1',
                      from: '221771234567',
                      timestamp: recentTimestamp,
                      text: {
                        body: 'vente 5000 pain',
                      },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = service.parseWebhookPayload(payload);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        messageId: 'msg-1',
        from: '221771234567',
        body: 'vente 5000 pain',
        timestamp: new Date(parseInt(recentTimestamp) * 1000),
      });
    });

    it('should skip non-text messages', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'test-entry',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'test-phone-id',
                  },
                  messages: [
                    {
                      id: 'msg-1',
                      from: '221771234567',
                      timestamp: '1640995200',
                      type: 'image',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = service.parseWebhookPayload(payload);

      expect(result).toHaveLength(0);
    });

    it('should handle payload with no messages', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'test-entry',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'test-phone-id',
                  },
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = service.parseWebhookPayload(payload);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple entries and changes', () => {
      // Use recent timestamps to avoid the "too old" validation
      const timestamp1 = Math.floor(Date.now() / 1000).toString();
      const timestamp2 = (Math.floor(Date.now() / 1000) + 60).toString();
      
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'test-phone-id',
                  },
                  messages: [
                    {
                      id: 'msg-1',
                      from: '221771234567',
                      timestamp: timestamp1,
                      text: { body: 'message 1' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'test-phone-id',
                  },
                  messages: [
                    {
                      id: 'msg-2',
                      from: '221771234567',
                      timestamp: timestamp2,
                      text: { body: 'message 2' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = service.parseWebhookPayload(payload);

      expect(result).toHaveLength(2);
      expect(result[0].messageId).toBe('msg-1');
      expect(result[1].messageId).toBe('msg-2');
    });

    it('should skip messages with invalid phone numbers', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'test-entry',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'test-phone-id',
                  },
                  messages: [
                    {
                      id: 'msg-1',
                      from: 'invalid-phone',
                      timestamp: '1640995200',
                      text: { body: 'test message' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = service.parseWebhookPayload(payload);

      expect(result).toHaveLength(0);
    });

    it('should skip messages that are too old', () => {
      const oldTimestamp = Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000); // 25 hours ago
      
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'test-entry',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'test-phone-id',
                  },
                  messages: [
                    {
                      id: 'msg-1',
                      from: '221771234567',
                      timestamp: oldTimestamp.toString(),
                      text: { body: 'old message' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = service.parseWebhookPayload(payload);

      expect(result).toHaveLength(0);
    });
  });

  describe('isDuplicateMessage', () => {
    it('should detect duplicate messages', () => {
      const messageId = 'test-message-id';
      
      // First call should return false (not duplicate)
      expect(service.isDuplicateMessage(messageId)).toBe(false);
      
      // Second call should return true (duplicate)
      expect(service.isDuplicateMessage(messageId)).toBe(true);
    });

    it('should handle different message IDs', () => {
      expect(service.isDuplicateMessage('msg-1')).toBe(false);
      expect(service.isDuplicateMessage('msg-2')).toBe(false);
      expect(service.isDuplicateMessage('msg-1')).toBe(true);
      expect(service.isDuplicateMessage('msg-2')).toBe(true);
    });
  });

  describe('extractMessageMetadata', () => {
    it('should extract message metadata correctly', () => {
      const message: Message = {
        id: 'test-id',
        from: '221771234567',
        timestamp: '1640995200',
        text: {
          body: 'test message',
        },
        type: 'text',
        context: {
          from: '221771234568',
          id: 'context-id',
        },
      };

      const metadata = service.extractMessageMetadata(message);

      expect(metadata).toEqual({
        messageId: 'test-id',
        from: '221771234567',
        type: 'text',
        timestamp: new Date(1640995200 * 1000),
        hasContext: true,
        contextFrom: '221771234568',
        bodyLength: 12,
      });
    });

    it('should handle message without context', () => {
      const message: Message = {
        id: 'test-id',
        from: '221771234567',
        timestamp: '1640995200',
        text: {
          body: 'test',
        },
        type: 'text',
      };

      const metadata = service.extractMessageMetadata(message);

      expect(metadata.hasContext).toBe(false);
      expect(metadata.contextFrom).toBeUndefined();
    });
  });
});