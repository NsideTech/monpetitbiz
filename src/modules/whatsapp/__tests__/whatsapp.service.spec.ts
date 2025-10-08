import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { WhatsappService } from '../whatsapp.service';
import { WebhookSecurityService } from '../services/webhook-security.service';
import { MessageParserService } from '../services/message-parser.service';
import { MessageQueueService } from '../services/message-queue.service';
import { WebhookPayload } from '../interfaces/webhook.interface';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let webhookSecurity: WebhookSecurityService;
  let messageParser: MessageParserService;
  let messageQueue: MessageQueueService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
        WHATSAPP_APP_SECRET: 'test-app-secret',
        WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
        WHATSAPP_ACCESS_TOKEN: 'test-access-token',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        WebhookSecurityService,
        MessageParserService,
        MessageQueueService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
    webhookSecurity = module.get<WebhookSecurityService>(WebhookSecurityService);
    messageParser = module.get<MessageParserService>(MessageParserService);
    messageQueue = module.get<MessageQueueService>(MessageQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    messageQueue.clearQueue();
  });

  describe('verifyWebhook', () => {
    it('should verify webhook successfully with correct parameters', async () => {
      const challenge = 'test-challenge';
      const result = await service.verifyWebhook('subscribe', challenge, 'test-verify-token');
      expect(result).toBe(challenge);
    });

    it('should throw UnauthorizedException for invalid mode', async () => {
      await expect(
        service.verifyWebhook('invalid', 'challenge', 'test-verify-token')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid verify token', async () => {
      await expect(
        service.verifyWebhook('subscribe', 'challenge', 'invalid-token')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('processWebhook', () => {
    const validPayload: WebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'test-entry-id',
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
                    id: 'test-message-id',
                    from: '221771234567',
                    timestamp: Math.floor(Date.now() / 1000).toString(),
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

    it('should process webhook payload successfully', async () => {
      const result = await service.processWebhook(validPayload);
      
      expect(result.messagesProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle payload with no messages', async () => {
      const emptyPayload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'test-entry-id',
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

      const result = await service.processWebhook(emptyPayload);
      
      expect(result.messagesProcessed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should throw BadRequestException for invalid payload structure', async () => {
      const invalidPayload = {
        object: 'invalid',
        entry: [],
      } as any;

      await expect(
        service.processWebhook(invalidPayload)
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify signature when provided', async () => {
      const rawBody = JSON.stringify(validPayload);
      const signature = 'sha256=test-signature';
      
      // Mock signature verification to return false
      jest.spyOn(webhookSecurity, 'verifyWebhookSignature').mockReturnValue(false);

      await expect(
        service.processWebhook(validPayload, signature, rawBody)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should process multiple messages in payload', async () => {
      const multiMessagePayload: WebhookPayload = {
        ...validPayload,
        entry: [
          {
            id: 'test-entry-id',
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
                      id: 'test-message-1',
                      from: '221771234567',
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      text: { body: 'vente 5000 pain' },
                      type: 'text',
                    },
                    {
                      id: 'test-message-2',
                      from: '221771234567',
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      text: { body: 'stock pain 20' },
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

      const result = await service.processWebhook(multiMessagePayload);
      
      expect(result.messagesProcessed).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await service.getQueueStats();
      
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('processingCount');
      expect(stats).toHaveProperty('isProcessing');
      expect(typeof stats.queueSize).toBe('number');
      expect(typeof stats.processingCount).toBe('number');
      expect(typeof stats.isProcessing).toBe('boolean');
    });
  });

  describe('getWebhookConfig', () => {
    it('should return webhook configuration status', () => {
      const config = service.getWebhookConfig();
      
      expect(config).toEqual({
        hasVerifyToken: true,
        hasAppSecret: true,
        hasPhoneNumberId: true,
        hasAccessToken: true,
      });
    });

    it('should return false for missing configuration', () => {
      // Mock missing configuration
      mockConfigService.get.mockReturnValue(undefined);
      
      const config = service.getWebhookConfig();
      
      expect(config).toEqual({
        hasVerifyToken: false,
        hasAppSecret: false,
        hasPhoneNumberId: false,
        hasAccessToken: false,
      });
    });
  });
});