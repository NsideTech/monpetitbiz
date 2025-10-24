import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  whatsappNumber: string;
  webhookSecret?: string;
  environment: 'sandbox' | 'production';
  retryAttempts: number;
  timeout: number;
}

export interface TwilioValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class TwilioConfigService {
  private readonly logger = new Logger(TwilioConfigService.name);

  constructor(private configService: ConfigService) {}

  getTwilioConfig(): TwilioConfig {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const whatsappNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER');

    if (!accountSid) {
      throw new Error('TWILIO_ACCOUNT_SID environment variable is required');
    }

    if (!authToken) {
      throw new Error('TWILIO_AUTH_TOKEN environment variable is required');
    }

    if (!whatsappNumber) {
      throw new Error('TWILIO_WHATSAPP_NUMBER environment variable is required');
    }

    return {
      accountSid,
      authToken,
      whatsappNumber,
      webhookSecret: this.configService.get<string>('TWILIO_WEBHOOK_SECRET'),
      environment: this.configService.get<'sandbox' | 'production'>('TWILIO_ENVIRONMENT', 'production'),
      retryAttempts: this.configService.get<number>('TWILIO_RETRY_ATTEMPTS', 3),
      timeout: this.configService.get<number>('TWILIO_TIMEOUT', 30000),
    };
  }

  validateConfig(): TwilioValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const config = this.getTwilioConfig();

      // Validate Account SID format
      if (!config.accountSid.startsWith('AC') || config.accountSid.length !== 34) {
        errors.push('TWILIO_ACCOUNT_SID must start with "AC" and be 34 characters long');
      }

      // Validate Auth Token format (should be 32 characters)
      if (config.authToken.length !== 32) {
        errors.push('TWILIO_AUTH_TOKEN must be 32 characters long');
      }

      // Validate WhatsApp number format
      if (!config.whatsappNumber.startsWith('whatsapp:+')) {
        errors.push('TWILIO_WHATSAPP_NUMBER must be in format "whatsapp:+1234567890"');
      }

      // Validate environment
      if (!['sandbox', 'production'].includes(config.environment)) {
        errors.push('TWILIO_ENVIRONMENT must be either "sandbox" or "production"');
      }

      // Validate retry attempts
      if (config.retryAttempts < 0 || config.retryAttempts > 10) {
        warnings.push('TWILIO_RETRY_ATTEMPTS should be between 0 and 10 (current: ' + config.retryAttempts + ')');
      }

      // Validate timeout
      if (config.timeout < 1000 || config.timeout > 60000) {
        warnings.push('TWILIO_TIMEOUT should be between 1000ms and 60000ms (current: ' + config.timeout + 'ms)');
      }

      // Environment-specific validations
      if (config.environment === 'production') {
        if (!config.webhookSecret) {
          warnings.push('TWILIO_WEBHOOK_SECRET is recommended for production environments');
        }
        
        if (config.accountSid.includes('test') || config.authToken.includes('test')) {
          errors.push('Test credentials detected in production environment');
        }
      }

      // Sandbox-specific validations
      if (config.environment === 'sandbox') {
        if (!config.whatsappNumber.includes('14155238886')) {
          warnings.push('Sandbox environment typically uses Twilio\'s test WhatsApp number (+14155238886)');
        }
      }

    } catch (error) {
      errors.push(`Configuration loading failed: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateConfigOrThrow(): void {
    const validation = this.validateConfig();
    
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        this.logger.warn(`Twilio Configuration Warning: ${warning}`);
      });
    }

    if (!validation.isValid) {
      const errorMessage = `Twilio configuration validation failed:\n${validation.errors.join('\n')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.log('Twilio configuration validated successfully');
  }

  isConfigured(): boolean {
    try {
      const validation = this.validateConfig();
      return validation.isValid;
    } catch {
      return false;
    }
  }

  getConfigurationStatus(): {
    configured: boolean;
    environment: string;
    hasWebhookSecret: boolean;
    validation: TwilioValidationResult;
  } {
    const validation = this.validateConfig();
    
    if (!validation.isValid) {
      return {
        configured: false,
        environment: 'unknown',
        hasWebhookSecret: false,
        validation,
      };
    }

    try {
      const config = this.getTwilioConfig();
      return {
        configured: true,
        environment: config.environment,
        hasWebhookSecret: !!config.webhookSecret,
        validation,
      };
    } catch {
      return {
        configured: false,
        environment: 'unknown',
        hasWebhookSecret: false,
        validation,
      };
    }
  }
}