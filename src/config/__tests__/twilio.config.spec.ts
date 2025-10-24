import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TwilioConfigService } from '../twilio.config';

describe('TwilioConfigService', () => {
  let service: TwilioConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwilioConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TwilioConfigService>(TwilioConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTwilioConfig', () => {
    it('should return valid config when all required env vars are present', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockImplementation((key: string, defaultValue?: any) => {
        const values = {
          TWILIO_ACCOUNT_SID: 'test_account_sid',
          TWILIO_AUTH_TOKEN: 'test_auth_token',
          TWILIO_WHATSAPP_NUMBER: 'whatsapp:+1234567890',
          TWILIO_WEBHOOK_SECRET: 'test_webhook_secret',
          TWILIO_ENVIRONMENT: 'sandbox',
          TWILIO_RETRY_ATTEMPTS: 5,
          TWILIO_TIMEOUT: 60000,
        };
        return values[key] || defaultValue;
      });

      const config = service.getTwilioConfig();

      expect(config).toEqual({
        accountSid: 'test_account_sid',
        authToken: 'test_auth_token',
        whatsappNumber: 'whatsapp:+1234567890',
        webhookSecret: 'test_webhook_secret',
        environment: 'sandbox',
        retryAttempts: 5,
        timeout: 60000,
      });
    });

    it('should use default values for optional config', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockImplementation((key: string, defaultValue?: any) => {
        const values = {
          TWILIO_ACCOUNT_SID: 'test_account_sid',
          TWILIO_AUTH_TOKEN: 'test_auth_token',
          TWILIO_WHATSAPP_NUMBER: 'whatsapp:+1234567890',
        };
        return values[key] || defaultValue;
      });

      const config = service.getTwilioConfig();

      expect(config.environment).toBe('production');
      expect(config.retryAttempts).toBe(3);
      expect(config.timeout).toBe(30000);
    });

    it('should throw error when TWILIO_ACCOUNT_SID is missing', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockImplementation((key: string, defaultValue?: any) => {
        const values = {
          TWILIO_AUTH_TOKEN: 'test_auth_token',
          TWILIO_WHATSAPP_NUMBER: 'whatsapp:+1234567890',
        };
        return values[key] || defaultValue;
      });

      expect(() => service.getTwilioConfig()).toThrow('TWILIO_ACCOUNT_SID environment variable is required');
    });

    it('should throw error when TWILIO_AUTH_TOKEN is missing', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockImplementation((key: string, defaultValue?: any) => {
        const values = {
          TWILIO_ACCOUNT_SID: 'test_account_sid',
          TWILIO_WHATSAPP_NUMBER: 'whatsapp:+1234567890',
        };
        return values[key] || defaultValue;
      });

      expect(() => service.getTwilioConfig()).toThrow('TWILIO_AUTH_TOKEN environment variable is required');
    });

    it('should throw error when TWILIO_WHATSAPP_NUMBER is missing', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockImplementation((key: string, defaultValue?: any) => {
        const values = {
          TWILIO_ACCOUNT_SID: 'test_account_sid',
          TWILIO_AUTH_TOKEN: 'test_auth_token',
        };
        return values[key] || defaultValue;
      });

      expect(() => service.getTwilioConfig()).toThrow('TWILIO_WHATSAPP_NUMBER environment variable is required');
    });
  });

  describe('validateConfig', () => {
    it('should not throw when config is valid', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockImplementation((key: string, defaultValue?: any) => {
        const values = {
          TWILIO_ACCOUNT_SID: 'AC1234567890abcdef1234567890abcdef',
          TWILIO_AUTH_TOKEN: '1234567890abcdef1234567890abcdef',
          TWILIO_WHATSAPP_NUMBER: 'whatsapp:+1234567890',
          TWILIO_ENVIRONMENT: 'sandbox',
        };
        return values[key] || defaultValue;
      });

      expect(() => service.validateConfigOrThrow()).not.toThrow();
    });

    it('should throw when config is invalid', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockReturnValue(undefined);

      expect(() => service.validateConfigOrThrow()).toThrow('Twilio configuration validation failed');
    });
  });

  describe('isConfigured', () => {
    it('should return true when config is valid', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockImplementation((key: string, defaultValue?: any) => {
        const values = {
          TWILIO_ACCOUNT_SID: 'AC1234567890abcdef1234567890abcdef',
          TWILIO_AUTH_TOKEN: '1234567890abcdef1234567890abcdef',
          TWILIO_WHATSAPP_NUMBER: 'whatsapp:+1234567890',
          TWILIO_ENVIRONMENT: 'sandbox',
        };
        return values[key] || defaultValue;
      });

      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when config is invalid', () => {
      const mockGet = configService.get as jest.Mock;
      mockGet.mockReturnValue(undefined);

      expect(service.isConfigured()).toBe(false);
    });
  });
});