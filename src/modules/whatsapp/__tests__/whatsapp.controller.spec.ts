import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { WhatsappController } from '../whatsapp.controller';
import { WhatsappService } from '../whatsapp.service';
import { WebhookSecurityService } from '../services/webhook-security.service';
import { MessageParserService } from '../services/message-parser.service';
import { MessageQueueService } from '../services/message-queue.service';

describe('WhatsappController', () => {
  let controller: WhatsappController;
  let whatsappService: WhatsappService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
        WHATSAPP_APP_SECRET: 'test-app-secret',
        WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
        WHATSAPP_ACCESS_TOKEN: 'test-access-token',
        NODE_ENV: 'test',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappController],
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

    controller = module.get<WhatsappController>(WhatsappController);
    whatsappService = module.get<WhatsappService>(WhatsappService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyWebhook', () => {
    it('should return challenge for valid verification', async () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.challenge': 'test-challenge-123',
        'hub.verify_token': 'test-verify-token',
      };

      const result = await controller.verifyWebhook(query);
      expect(result).toBe('test-challenge-123');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.challenge': 'test-challenge-123',
        'hub.verify_token': 'invalid-token',
      };

      await expect(controller.verifyWebhook(query)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid mode', async () => {
      const query = {
        'hub.mode': 'invalid',
        'hub.challenge': 'test-challenge-123',
        'hub.verify_token': 'test-verify-token',
      };

      await expect(controller.verifyWebhook(query)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleWebhook', () => {
    const validPayload = {
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
                    type: 'text' as const,
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    it('should process valid webhook payload', async () => {
      const mockReq = {
        rawBody: Buffer.from(JSON.stringify(validPayload)),
      } as any;

      const result = await controller.handleWebhook(mockReq, validPayload);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Processed');
    });

    it('should handle payload with no messages', async () => {
      const emptyPayload = {
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

      const mockReq = {
        rawBody: Buffer.from(JSON.stringify(emptyPayload)),
      } as any;

      const result = await controller.handleWebhook(mockReq, emptyPayload);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Processed 0 messages');
    });

    it('should return error response for invalid payload', async () => {
      const invalidPayload = {
        object: 'invalid',
        entry: [],
      } as any;

      const mockReq = {
        rawBody: Buffer.from(JSON.stringify(invalidPayload)),
      } as any;

      const result = await controller.handleWebhook(mockReq, invalidPayload);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid payload structure');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const result = await controller.healthCheck();

      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('queue');
      expect(result.queue).toHaveProperty('queueSize');
      expect(result.queue).toHaveProperty('processingCount');
      expect(result.queue).toHaveProperty('isProcessing');
    });
  });

  describe('testMessage', () => {
    it('should process test message in non-production environment', async () => {
      const testBody = {
        from: '221771234567',
        message: 'test vente 1000',
      };

      const result = await controller.testMessage(testBody);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Test message processed');
      expect(result.result).toBeDefined();
    });

    it('should throw BadRequestException in production', async () => {
      // Mock production environment
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          NODE_ENV: 'production',
          WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
          WHATSAPP_APP_SECRET: 'test-app-secret',
          WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
          WHATSAPP_ACCESS_TOKEN: 'test-access-token',
        };
        return config[key] || 'test-value';
      });

      const testBody = {
        from: '221771234567',
        message: 'test message',
      };

      await expect(controller.testMessage(testBody)).rejects.toThrow(BadRequestException);
    });
  });
});