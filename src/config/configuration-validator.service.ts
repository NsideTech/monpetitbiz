import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioConfigService } from './twilio.config';

export interface ValidationResult {
  service: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SystemValidationResult {
  isValid: boolean;
  results: ValidationResult[];
  summary: {
    totalServices: number;
    validServices: number;
    invalidServices: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

@Injectable()
export class ConfigurationValidatorService {
  private readonly logger = new Logger(ConfigurationValidatorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly twilioConfigService: TwilioConfigService,
  ) {}

  async validateAllConfigurations(): Promise<SystemValidationResult> {
    const results: ValidationResult[] = [];

    // Validate Database Configuration
    results.push(this.validateDatabaseConfig());

    // Validate JWT Configuration
    results.push(this.validateJwtConfig());

    // Validate Twilio Configuration
    results.push(this.validateTwilioConfig());

    // Validate WhatsApp Configuration (Meta API - for backward compatibility)
    results.push(this.validateWhatsAppConfig());

    // Validate Application Configuration
    results.push(this.validateApplicationConfig());

    // Calculate summary
    const summary = {
      totalServices: results.length,
      validServices: results.filter(r => r.isValid).length,
      invalidServices: results.filter(r => !r.isValid).length,
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
    };

    const systemValidation: SystemValidationResult = {
      isValid: summary.invalidServices === 0,
      results,
      summary,
    };

    this.logValidationResults(systemValidation);
    return systemValidation;
  }

  private validateDatabaseConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const host = this.configService.get<string>('DATABASE_HOST');
    const port = this.configService.get<number>('DATABASE_PORT');
    const username = this.configService.get<string>('DATABASE_USERNAME');
    const password = this.configService.get<string>('DATABASE_PASSWORD');
    const database = this.configService.get<string>('DATABASE_NAME');

    if (!host) errors.push('DATABASE_HOST is required');
    if (!port || port < 1 || port > 65535) errors.push('DATABASE_PORT must be a valid port number');
    if (!username) errors.push('DATABASE_USERNAME is required');
    if (!password) errors.push('DATABASE_PASSWORD is required');
    if (!database) errors.push('DATABASE_NAME is required');

    // Warnings for common issues
    if (password && password.length < 8) {
      warnings.push('DATABASE_PASSWORD should be at least 8 characters long');
    }
    if (username === 'postgres' && this.configService.get('NODE_ENV') === 'production') {
      warnings.push('Using default postgres username in production is not recommended');
    }

    return {
      service: 'Database',
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateJwtConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const secret = this.configService.get<string>('JWT_SECRET');
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN');

    if (!secret) {
      errors.push('JWT_SECRET is required');
    } else {
      if (secret.length < 32) {
        errors.push('JWT_SECRET should be at least 32 characters long');
      }
      if (secret === 'your-super-secret-jwt-key-change-this-in-production') {
        errors.push('JWT_SECRET must be changed from the default value');
      }
    }

    if (!expiresIn) {
      warnings.push('JWT_EXPIRES_IN not set, using default expiration');
    }

    return {
      service: 'JWT',
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateTwilioConfig(): ValidationResult {
    const twilioValidation = this.twilioConfigService.validateConfig();
    
    return {
      service: 'Twilio',
      isValid: twilioValidation.isValid,
      errors: twilioValidation.errors,
      warnings: twilioValidation.warnings,
    };
  }

  private validateWhatsAppConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const verifyToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    const appSecret = this.configService.get<string>('WHATSAPP_APP_SECRET');

    // Check if Meta API configuration exists (optional - for fallback only)
    const hasMetaConfig = accessToken || phoneNumberId || verifyToken || appSecret;
    
    if (hasMetaConfig) {
      // Only validate if partial configuration is provided
      const configuredFields = [accessToken, phoneNumberId, verifyToken, appSecret].filter(Boolean).length;
      if (configuredFields > 0 && configuredFields < 3) {
        warnings.push('Partial Meta API configuration detected. Either provide all required fields or remove all for Twilio-only setup.');
      }
      
      if (hasMetaConfig && !accessToken) warnings.push('WHATSAPP_ACCESS_TOKEN is missing for Meta API fallback');
      if (hasMetaConfig && !phoneNumberId) warnings.push('WHATSAPP_PHONE_NUMBER_ID is missing for Meta API fallback');
      if (hasMetaConfig && !verifyToken) warnings.push('WHATSAPP_WEBHOOK_VERIFY_TOKEN is missing for Meta API fallback');
      if (hasMetaConfig && !appSecret) warnings.push('WHATSAPP_APP_SECRET is recommended for Meta API webhook verification');
    } else {
      // This is now the expected configuration for Twilio-only setup
      this.logger.debug('Meta WhatsApp API configuration not found - using Twilio-only setup');
    }

    return {
      service: 'WhatsApp (Meta API)',
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateApplicationConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const port = this.configService.get<number>('PORT');
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const useHttps = this.configService.get<string>('USE_HTTPS');

    if (port && (port < 1 || port > 65535)) {
      errors.push('PORT must be a valid port number');
    }

    if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
      warnings.push('NODE_ENV should be one of: development, production, test');
    }

    if (useHttps === 'true') {
      const keyPath = this.configService.get<string>('SSL_KEY_PATH');
      const certPath = this.configService.get<string>('SSL_CERT_PATH');
      
      if (!keyPath) warnings.push('SSL_KEY_PATH should be set when USE_HTTPS=true');
      if (!certPath) warnings.push('SSL_CERT_PATH should be set when USE_HTTPS=true');
    }

    return {
      service: 'Application',
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private logValidationResults(validation: SystemValidationResult): void {
    const { summary } = validation;

    if (validation.isValid) {
      this.logger.log(`✅ All ${summary.totalServices} services configured correctly`);
    } else {
      this.logger.error(`❌ ${summary.invalidServices}/${summary.totalServices} services have configuration errors`);
    }

    if (summary.totalWarnings > 0) {
      this.logger.warn(`⚠️  ${summary.totalWarnings} configuration warnings found`);
    }

    // Log detailed results
    validation.results.forEach(result => {
      if (!result.isValid) {
        this.logger.error(`❌ ${result.service} configuration errors:`);
        result.errors.forEach(error => this.logger.error(`   - ${error}`));
      }

      if (result.warnings.length > 0) {
        this.logger.warn(`⚠️  ${result.service} configuration warnings:`);
        result.warnings.forEach(warning => this.logger.warn(`   - ${warning}`));
      }
    });
  }

  async validateConfigurationOrThrow(): Promise<void> {
    const validation = await this.validateAllConfigurations();
    
    if (!validation.isValid) {
      const errorMessage = `Configuration validation failed with ${validation.summary.totalErrors} errors. Please check the logs above for details.`;
      throw new Error(errorMessage);
    }
  }
}