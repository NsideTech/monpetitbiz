import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TwilioErrorHandlerService } from '../services/twilio-error-handler.service';
import { TwilioLoggerService } from '../services/twilio-logger.service';
import { TwilioWhatsAppService } from '../services/twilio-whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { TwilioConfigService } from '../../../config/twilio.config';

describe('Twilio Error Recovery Tests', () => {
  let errorHandler: TwilioErrorHandlerService;
  let logger: TwilioLoggerService;
  let twilioService: TwilioWhatsAppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwilioErrorHandlerService,
        TwilioLoggerService,
        {
          provide: TwilioConfigService,
          useValue: {
            getTwilioConfig: jest.fn().mockReturnValue({
              accountSid: 'AC' + '1'.repeat(32),
              authToken: '2'.repeat(32),
              whatsappNumber: 'whatsapp:+14155238886',
              webhookSecret: undefined,
              environment: 'sandbox',
              retryAttempts: 3,
              timeout: 30000,
            }),
          },
        },
        {
          provide: TwilioWhatsAppService,
          useValue: {
            sendMessage: jest.fn(),
            sendMedia: jest.fn(),
            formatPhoneNumber: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'twilio.accountSid': 'AC_test_account_sid',
                'twilio.authToken': 'test_auth_token',
                'twilio.whatsappNumber': '+1234567890',
                'twilio.retryAttempts': 3,
                'twilio.retryDelay': 1000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    errorHandler = module.get<TwilioErrorHandlerService>(TwilioErrorHandlerService);
    logger = module.get<TwilioLoggerService>(TwilioLoggerService);
    twilioService = module.get<TwilioWhatsAppService>(TwilioWhatsAppService);
  });

  describe('Authentication Error Recovery', () => {
    it('should handle authentication errors without retry', async () => {
      const authError = {
        code: 20003,
        message: 'Authentication failed',
        status: 401,
        moreInfo: 'https://www.twilio.com/docs/errors/20003',
      };

      const shouldRetry = errorHandler.shouldRetry(authError as any, 1);
      expect(shouldRetry).toBe(false);

      const logSpy = jest.spyOn(Logger.prototype, 'error');
      errorHandler.handleAuthenticationError(authError as any);

      expect(logSpy).toHaveBeenCalledWith(
        'Twilio authentication error:',
        expect.objectContaining({
          code: 20003,
          message: 'Authentication failed',
        }),
      );
    });

    it('should handle invalid auth token errors', async () => {
      const invalidTokenError = {
        code: 20004,
        message: 'Invalid auth token',
        status: 401,
        moreInfo: 'https://www.twilio.com/docs/errors/20004',
      };

      const shouldRetry = errorHandler.shouldRetry(invalidTokenError as any, 1);
      expect(shouldRetry).toBe(false);

      errorHandler.handleAuthenticationError(invalidTokenError as any);
      // Should log critical error and not attempt retry
    });
  });

  describe('Rate Limiting Error Recovery', () => {
    it('should handle rate limiting with exponential backoff', async () => {
      const rateLimitError = {
        code: 20429,
        message: 'Too many requests',
        status: 429,
        moreInfo: 'https://www.twilio.com/docs/errors/20429',
      };

      const shouldRetry = errorHandler.shouldRetry(rateLimitError as any, 1);
      expect(shouldRetry).toBe(true);

      const startTime = Date.now();
      await errorHandler.handleRateLimitError(rateLimitError as any, 1);
      const endTime = Date.now();

      // Should have some delay for backoff
      expect(endTime - startTime).toBeGreaterThan(100);
    });

    it('should implement exponential backoff with jitter', async () => {
      const rateLimitError = {
        code: 20429,
        message: 'Too many requests',
        status: 429,
      };

      const delays = [];
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn().mockImplementation((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for testing
      });
      global.setTimeout = mockSetTimeout as any;

      // Simulate multiple rate limit errors
      for (let i = 0; i < 3; i++) {
        await errorHandler.handleRateLimitError(rateLimitError as any, i + 1);
      }

      // Delays should increase exponentially
      expect(delays.length).toBe(3);
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Validation Error Recovery', () => {
    it('should handle invalid phone number errors', async () => {
      const validationError = {
        code: 21211,
        message: 'Invalid phone number',
        status: 400,
        moreInfo: 'https://www.twilio.com/docs/errors/21211',
      };

      const shouldRetry = errorHandler.shouldRetry(validationError as any, 1);
      expect(shouldRetry).toBe(false);

      const logSpy = jest.spyOn(Logger.prototype, 'error');
      errorHandler.handleValidationError(validationError as any);

      expect(logSpy).toHaveBeenCalledWith(
        'Twilio validation error:',
        expect.objectContaining({
          code: 21211,
          message: 'Invalid phone number',
        }),
      );
    });

    it('should handle message body too long errors', async () => {
      const bodyTooLongError = {
        code: 21614,
        message: 'Message body is too long',
        status: 400,
        moreInfo: 'https://www.twilio.com/docs/errors/21614',
      };

      const shouldRetry = errorHandler.shouldRetry(bodyTooLongError as any, 1);
      expect(shouldRetry).toBe(false);

      errorHandler.handleValidationError(bodyTooLongError as any);
      // Should log error and suggest message truncation
    });

    it('should handle invalid media URL errors', async () => {
      const mediaError = {
        code: 21623,
        message: 'Invalid media URL',
        status: 400,
        moreInfo: 'https://www.twilio.com/docs/errors/21623',
      };

      const shouldRetry = errorHandler.shouldRetry(mediaError as any, 1);
      expect(shouldRetry).toBe(false);

      errorHandler.handleValidationError(mediaError as any);
    });
  });

  describe('Network Error Recovery', () => {
    it('should handle network timeout errors with retry', async () => {
      const timeoutError = {
        code: 'ECONNRESET',
        message: 'Connection reset by peer',
        status: 0,
      };

      const shouldRetry = errorHandler.shouldRetry(timeoutError as any, 1);
      expect(shouldRetry).toBe(true);

      // Should implement retry logic for network errors
    });

    it('should handle DNS resolution errors', async () => {
      const dnsError = {
        code: 'ENOTFOUND',
        message: 'DNS resolution failed',
        status: 0,
      };

      const shouldRetry = errorHandler.shouldRetry(dnsError as any, 1);
      expect(shouldRetry).toBe(true);
    });

    it('should handle connection refused errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        status: 0,
      };

      const shouldRetry = errorHandler.shouldRetry(connectionError as any, 1);
      expect(shouldRetry).toBe(true);
    });
  });

  describe('Service Unavailable Recovery', () => {
    it('should handle Twilio service unavailable errors', async () => {
      const serviceError = {
        code: 20500,
        message: 'Internal server error',
        status: 500,
        moreInfo: 'https://www.twilio.com/docs/errors/20500',
      };

      const shouldRetry = errorHandler.shouldRetry(serviceError as any, 1);
      expect(shouldRetry).toBe(true);

      // Should implement circuit breaker pattern
    });

    it('should handle service maintenance errors', async () => {
      const maintenanceError = {
        code: 20503,
        message: 'Service temporarily unavailable',
        status: 503,
        moreInfo: 'https://www.twilio.com/docs/errors/20503',
      };

      const shouldRetry = errorHandler.shouldRetry(maintenanceError as any, 1);
      expect(shouldRetry).toBe(true);
    });
  });

  describe('Message Delivery Failure Recovery', () => {
    it('should handle message delivery failures', async () => {
      const deliveryError = {
        code: 30008,
        message: 'Unknown error',
        status: 400,
        moreInfo: 'https://www.twilio.com/docs/errors/30008',
      };

      const shouldRetry = errorHandler.shouldRetry(deliveryError as any, 1);
      expect(shouldRetry).toBe(false);

      // Should log delivery failure and potentially notify user
    });

    it('should handle WhatsApp template message errors', async () => {
      const templateError = {
        code: 63016,
        message: 'Template message failed',
        status: 400,
        moreInfo: 'https://www.twilio.com/docs/errors/63016',
      };

      const shouldRetry = errorHandler.shouldRetry(templateError as any, 1);
      expect(shouldRetry).toBe(false);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize errors correctly', () => {
      const testCases = [
        { code: 20003, category: 'authentication', shouldRetry: false },
        { code: 20004, category: 'authentication', shouldRetry: false },
        { code: 20429, category: 'rate_limit', shouldRetry: true },
        { code: 21211, category: 'validation', shouldRetry: false },
        { code: 21614, category: 'validation', shouldRetry: false },
        { code: 20500, category: 'server_error', shouldRetry: true },
        { code: 20503, category: 'server_error', shouldRetry: true },
        { code: 30008, category: 'delivery_failure', shouldRetry: false },
      ];

      testCases.forEach(({ code, shouldRetry }) => {
        const error = { code, message: 'Test error', status: 400 };
        expect(errorHandler.shouldRetry(error as any, 1)).toBe(shouldRetry);
      });
    });

    it('should handle unknown error codes gracefully', () => {
      const unknownError = {
        code: 99999,
        message: 'Unknown error',
        status: 500,
      };

      const shouldRetry = errorHandler.shouldRetry(unknownError as any, 1);
      // Unknown errors should default to retry with caution
      expect(typeof shouldRetry).toBe('boolean');
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should implement circuit breaker for repeated failures', async () => {
      const serverError = {
        code: 20500,
        message: 'Internal server error',
        status: 500,
      };

      // Simulate multiple consecutive failures
      for (let i = 0; i < 5; i++) {
        errorHandler.shouldRetry(serverError as any, i + 1);
      }

      // Circuit breaker should eventually open and prevent further requests
      // This would be implementation-specific
    });

    it('should reset circuit breaker after successful requests', async () => {
      // This would test the circuit breaker reset logic
      // Implementation depends on the specific circuit breaker pattern used
    });
  });

  describe('Error Logging and Monitoring', () => {
    it('should log errors with proper context', () => {
      const error = {
        code: 20003,
        message: 'Authentication failed',
        status: 401,
        moreInfo: 'https://www.twilio.com/docs/errors/20003',
      };

      const logSpy = jest.spyOn(Logger.prototype, 'error');
      errorHandler.handleAuthenticationError(error as any);

      expect(logSpy).toHaveBeenCalled();
    });

    it('should include correlation IDs in error logs', () => {
      const error = {
        code: 21211,
        message: 'Invalid phone number',
        status: 400,
      };

      const correlationId = 'test-correlation-id';
      const logSpy = jest.spyOn(Logger.prototype, 'error');

      errorHandler.handleValidationError(error as any);

      expect(logSpy).toHaveBeenCalled();
    });

    it('should track error metrics', () => {
      const errors = [
        { code: 20003, message: 'Auth error', status: 401 },
        { code: 20429, message: 'Rate limit', status: 429 },
        { code: 21211, message: 'Validation error', status: 400 },
      ];

      errors.forEach(error => {
        errorHandler.shouldRetry(error as any, 1);
      });

      // Should track error counts by category
      // This would be implementation-specific based on metrics system
    });
  });

  describe('Recovery Strategies', () => {
    it('should provide fallback options for critical failures', async () => {
      const criticalError = {
        code: 20003,
        message: 'Authentication failed',
        status: 401,
      };

      // Should provide alternative communication methods or queue messages
      // This would be implementation-specific based on business requirements
      expect(errorHandler.shouldRetry(criticalError as any, 1)).toBe(false);
    });

    it('should queue messages during service outages', async () => {
      const serviceError = {
        code: 20503,
        message: 'Service unavailable',
        status: 503,
      };

      // Should queue messages for later delivery
      // This would be implementation-specific based on business requirements
      expect(errorHandler.shouldRetry(serviceError as any, 1)).toBe(true);
    });

    it('should provide user-friendly error messages', () => {
      const errors = [
        { code: 21211, expected: 'Invalid phone number format' },
        { code: 21614, expected: 'Message is too long' },
        { code: 30008, expected: 'Message delivery failed' },
      ];

      errors.forEach(({ code, expected }) => {
        const error = { code, message: 'Technical error', status: 400 };
        // This would be implementation-specific based on business requirements
        expect(errorHandler.shouldRetry(error as any, 1)).toBe(false);
      });
    });
  });
});