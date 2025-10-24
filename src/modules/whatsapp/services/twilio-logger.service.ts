import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface TwilioLogContext {
  correlationId: string;
  operation: string;
  phoneNumber?: string;
  messageSid?: string;
  accountSid?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TwilioErrorLog {
  correlationId: string;
  operation: string;
  errorCategory: string;
  errorCode: number | string;
  errorMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  attemptNumber?: number;
  phoneNumber?: string;
  messageSid?: string;
  timestamp: Date;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface TwilioOperationLog {
  correlationId: string;
  operation: string;
  status: 'started' | 'success' | 'failed' | 'retrying';
  duration?: number;
  phoneNumber?: string;
  messageSid?: string;
  messageLength?: number;
  mediaUrl?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class TwilioLoggerService {
  private readonly logger = new Logger(TwilioLoggerService.name);
  private readonly operationStartTimes = new Map<string, number>();

  /**
   * Generate a new correlation ID for tracking operations
   */
  generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * Log the start of a Twilio operation
   */
  logOperationStart(context: TwilioLogContext): void {
    this.operationStartTimes.set(context.correlationId, Date.now());
    
    const logData: TwilioOperationLog = {
      correlationId: context.correlationId,
      operation: context.operation,
      status: 'started',
      phoneNumber: context.phoneNumber,
      messageSid: context.messageSid,
      timestamp: context.timestamp,
      metadata: context.metadata
    };

    this.logger.log('Twilio operation started', logData);
  }

  /**
   * Log successful completion of a Twilio operation
   */
  logOperationSuccess(context: TwilioLogContext, result?: any): void {
    const startTime = this.operationStartTimes.get(context.correlationId);
    const duration = startTime ? Date.now() - startTime : undefined;
    
    if (startTime) {
      this.operationStartTimes.delete(context.correlationId);
    }

    const logData: TwilioOperationLog = {
      correlationId: context.correlationId,
      operation: context.operation,
      status: 'success',
      duration,
      phoneNumber: context.phoneNumber,
      messageSid: result?.sid || context.messageSid,
      messageLength: result?.body?.length,
      timestamp: new Date(),
      metadata: {
        ...context.metadata,
        result: this.sanitizeResult(result)
      }
    };

    this.logger.log('Twilio operation completed successfully', logData);
  }

  /**
   * Log failed Twilio operation
   */
  logOperationFailure(context: TwilioLogContext, error: any, attemptNumber?: number): void {
    const startTime = this.operationStartTimes.get(context.correlationId);
    const duration = startTime ? Date.now() - startTime : undefined;
    
    if (startTime && !attemptNumber) {
      this.operationStartTimes.delete(context.correlationId);
    }

    const errorLog: TwilioErrorLog = {
      correlationId: context.correlationId,
      operation: context.operation,
      errorCategory: this.categorizeError(error),
      errorCode: error.code || error.status || 'unknown',
      errorMessage: error.message || 'Unknown error',
      severity: this.determineSeverity(error),
      retryable: this.isRetryableError(error),
      attemptNumber,
      phoneNumber: context.phoneNumber,
      messageSid: context.messageSid,
      timestamp: new Date(),
      stackTrace: error.stack,
      metadata: {
        ...context.metadata,
        duration,
        errorDetails: this.sanitizeError(error)
      }
    };

    const logLevel = this.getLogLevel(errorLog.severity);
    this.logger[logLevel]('Twilio operation failed', errorLog);
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(context: TwilioLogContext, attemptNumber: number, delay: number): void {
    const logData: TwilioOperationLog = {
      correlationId: context.correlationId,
      operation: context.operation,
      status: 'retrying',
      phoneNumber: context.phoneNumber,
      messageSid: context.messageSid,
      timestamp: new Date(),
      metadata: {
        ...context.metadata,
        attemptNumber,
        retryDelay: delay
      }
    };

    this.logger.warn('Twilio operation retrying', logData);
  }

  /**
   * Log webhook processing
   */
  logWebhookProcessing(
    correlationId: string,
    webhookData: any,
    processingResult: 'success' | 'failed',
    error?: any
  ): void {
    const logData = {
      correlationId,
      operation: 'webhook_processing',
      status: processingResult,
      messageSid: webhookData.MessageSid,
      phoneNumber: this.extractPhoneNumber(webhookData.From),
      smsStatus: webhookData.SmsStatus,
      timestamp: new Date(),
      metadata: {
        webhookData: this.sanitizeWebhookData(webhookData),
        error: error ? this.sanitizeError(error) : undefined
      }
    };

    if (processingResult === 'success') {
      this.logger.log('Webhook processed successfully', logData);
    } else {
      this.logger.error('Webhook processing failed', logData);
    }
  }

  /**
   * Log health check results
   */
  logHealthCheck(
    correlationId: string,
    healthy: boolean,
    details: any,
    duration: number
  ): void {
    const logData = {
      correlationId,
      operation: 'health_check',
      status: healthy ? 'success' : 'failed',
      duration,
      timestamp: new Date(),
      metadata: {
        healthy,
        details: this.sanitizeHealthDetails(details)
      }
    };

    // if (healthy) {
    //   this.logger.log('Twilio health check passed', logData);
    // } else {
    //   this.logger.error('Twilio health check failed', logData);
    // }
  }

  /**
   * Log configuration validation
   */
  logConfigurationValidation(
    correlationId: string,
    valid: boolean,
    errors?: string[]
  ): void {
    const logData = {
      correlationId,
      operation: 'configuration_validation',
      status: valid ? 'success' : 'failed',
      timestamp: new Date(),
      metadata: {
        valid,
        errors
      }
    };

    if (valid) {
      this.logger.log('Twilio configuration validation passed', logData);
    } else {
      this.logger.error('Twilio configuration validation failed', logData);
    }
  }

  /**
   * Create structured alert for critical errors
   */
  createAlert(
    correlationId: string,
    alertType: 'authentication_failure' | 'service_unavailable' | 'high_error_rate' | 'configuration_error',
    details: Record<string, any>
  ): void {
    const alertData = {
      correlationId,
      alertType,
      severity: 'critical',
      timestamp: new Date(),
      details,
      metadata: {
        environment: process.env.NODE_ENV,
        service: 'twilio-whatsapp'
      }
    };

    this.logger.error(`ALERT: ${alertType}`, alertData);
    
    // In a production environment, this would also send to monitoring systems
    // like DataDog, New Relic, or custom alerting systems
  }

  /**
   * Categorize error for structured logging
   */
  private categorizeError(error: any): string {
    const errorCode = error.code || error.status;

    if ([20003, 20004, 20005].includes(errorCode)) {
      return 'authentication';
    }
    if ([20429, 30007].includes(errorCode)) {
      return 'rate_limiting';
    }
    if ([21211, 21614, 21408, 21610, 21612].includes(errorCode)) {
      return 'validation';
    }
    if ([20500, 20503, 30001].includes(errorCode)) {
      return 'service_unavailable';
    }
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || errorCode >= 500) {
      return 'network';
    }
    return 'unknown';
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'authentication':
        return 'critical';
      case 'rate_limiting':
      case 'service_unavailable':
        return 'high';
      case 'validation':
        return 'medium';
      case 'network':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const category = this.categorizeError(error);
    return ['rate_limiting', 'network', 'service_unavailable'].includes(category);
  }

  /**
   * Get appropriate log level based on severity
   */
  private getLogLevel(severity: string): 'debug' | 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'low':
        return 'debug';
      case 'medium':
        return 'warn';
      case 'high':
      case 'critical':
        return 'error';
      default:
        return 'log';
    }
  }

  /**
   * Sanitize result data for logging (remove sensitive information)
   */
  private sanitizeResult(result: any): any {
    if (!result) return result;
    
    const sanitized = { ...result };
    
    // Remove or mask sensitive fields
    if (sanitized.accountSid) {
      sanitized.accountSid = this.maskSensitiveData(sanitized.accountSid);
    }
    if (sanitized.authToken) {
      delete sanitized.authToken;
    }
    
    return sanitized;
  }

  /**
   * Sanitize error data for logging
   */
  private sanitizeError(error: any): any {
    if (!error) return error;
    
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      moreInfo: error.moreInfo,
      details: error.details
    };
  }

  /**
   * Sanitize webhook data for logging
   */
  private sanitizeWebhookData(webhookData: any): any {
    if (!webhookData) return webhookData;
    
    const sanitized = { ...webhookData };
    
    // Keep important fields but remove potentially sensitive ones
    return {
      MessageSid: sanitized.MessageSid,
      AccountSid: this.maskSensitiveData(sanitized.AccountSid),
      From: this.maskPhoneNumber(sanitized.From),
      To: this.maskPhoneNumber(sanitized.To),
      SmsStatus: sanitized.SmsStatus,
      Body: sanitized.Body ? '[REDACTED]' : undefined,
      NumMedia: sanitized.NumMedia,
      ProfileName: sanitized.ProfileName ? '[REDACTED]' : undefined
    };
  }

  /**
   * Sanitize health check details
   */
  private sanitizeHealthDetails(details: any): any {
    if (!details) return details;
    
    const sanitized = { ...details };
    
    if (sanitized.accountSid) {
      sanitized.accountSid = this.maskSensitiveData(sanitized.accountSid);
    }
    
    return sanitized;
  }

  /**
   * Extract phone number from Twilio format
   */
  private extractPhoneNumber(twilioPhone: string): string {
    if (!twilioPhone) return '';
    return twilioPhone.replace('whatsapp:', '');
  }

  /**
   * Mask sensitive data for logging
   */
  private maskSensitiveData(data: string): string {
    if (!data || data.length < 8) return '[MASKED]';
    return data.substring(0, 4) + '****' + data.substring(data.length - 4);
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phone: string): string {
    if (!phone) return '';
    const cleaned = phone.replace('whatsapp:', '');
    if (cleaned.length < 8) return '[MASKED]';
    return cleaned.substring(0, 4) + '****' + cleaned.substring(cleaned.length - 4);
  }
}