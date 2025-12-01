import { Injectable, Logger } from '@nestjs/common';
import { TwilioConfigService } from '../../../config/twilio.config';
import { TwilioLoggerService, TwilioLogContext } from './twilio-logger.service';

export interface TwilioError {
  code: number;
  message: string;
  moreInfo?: string;
  status: number;
  details?: any;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterRange: number;
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  RATE_LIMITING = 'rate_limiting',
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  UNKNOWN = 'unknown'
}

@Injectable()
export class TwilioErrorHandlerService {
  private readonly logger = new Logger(TwilioErrorHandlerService.name);
  private readonly retryConfig: RetryConfig;

  constructor(
    private readonly twilioConfig: TwilioConfigService,
    private readonly twilioLogger: TwilioLoggerService
  ) {
    const config = this.twilioConfig.getTwilioConfig();
    this.retryConfig = {
      maxAttempts: config.retryAttempts,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitterRange: 0.1
    };
  }

  /**
   * Categorize Twilio error based on error code
   */
  categorizeError(error: any): ErrorCategory {
    const errorCode = error.code || error.status;

    // Authentication errors
    if ([20003, 20004, 20005].includes(errorCode)) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Rate limiting errors
    if ([20429, 30007].includes(errorCode)) {
      return ErrorCategory.RATE_LIMITING;
    }

    // Validation errors (including delivery failures, media errors, and template errors which shouldn't be retried)
    if ([21211, 21614, 21408, 21610, 21612, 21623, 30008, 63016].includes(errorCode)) {
      return ErrorCategory.VALIDATION;
    }

    // Service unavailable errors
    if ([20500, 20503, 30001].includes(errorCode)) {
      return ErrorCategory.SERVICE_UNAVAILABLE;
    }

    // Network/timeout errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || errorCode >= 500) {
      return ErrorCategory.NETWORK;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine if an error should be retried
   */
  shouldRetry(error: any, attemptNumber: number): boolean {
    if (attemptNumber >= this.retryConfig.maxAttempts) {
      return false;
    }

    const category = this.categorizeError(error);

    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        // Don't retry authentication errors
        return false;
      
      case ErrorCategory.VALIDATION:
        // Don't retry validation errors
        return false;
      
      case ErrorCategory.RATE_LIMITING:
      case ErrorCategory.NETWORK:
      case ErrorCategory.SERVICE_UNAVAILABLE:
        // Retry these types of errors
        return true;
      
      case ErrorCategory.UNKNOWN:
        // Retry unknown errors cautiously
        return attemptNumber < 2;
      
      default:
        return false;
    }
  }

  /**
   * Calculate delay for exponential backoff with jitter
   */
  calculateDelay(attemptNumber: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attemptNumber - 1),
      this.retryConfig.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * this.retryConfig.jitterRange * (Math.random() * 2 - 1);
    
    return Math.max(exponentialDelay + jitter, 0);
  }

  /**
   * Handle authentication errors
   */
  handleAuthenticationError(error: TwilioError, correlationId?: string): void {
    this.logger.error('Twilio authentication error:', {
      code: error.code,
      message: error.message,
      moreInfo: error.moreInfo
    });

    // Create structured alert for authentication failure
    if (correlationId) {
      this.twilioLogger.createAlert(correlationId, 'authentication_failure', {
        errorCode: error.code,
        errorMessage: error.message,
        moreInfo: error.moreInfo
      });
    }

    // Log critical error for immediate attention
    this.logger.error('CRITICAL: Twilio authentication failed. Check credentials and account status.');
  }

  /**
   * Handle rate limiting errors
   */
  async handleRateLimitError(error: TwilioError, attemptNumber: number, context?: TwilioLogContext): Promise<void> {
    const delay = this.calculateDelay(attemptNumber);
    
    this.logger.warn('Twilio rate limit exceeded:', {
      code: error.code,
      message: error.message,
      attemptNumber,
      retryAfter: delay
    });

    // Log structured retry attempt
    if (context) {
      this.twilioLogger.logRetryAttempt(context, attemptNumber, delay);
    }

    // Wait before retry
    await this.sleep(delay);
  }

  /**
   * Handle validation errors
   */
  handleValidationError(error: TwilioError): void {
    this.logger.error('Twilio validation error:', {
      code: error.code,
      message: error.message,
      moreInfo: error.moreInfo,
      details: error.details
    });

    // Provide specific guidance based on error code
    switch (error.code) {
      case 21211:
        this.logger.error('Invalid phone number format. Ensure phone number is in E.164 format.');
        break;
      case 21614:
        this.logger.error('Invalid WhatsApp number. Verify the sender phone number is WhatsApp enabled.');
        break;
      case 21408:
        this.logger.error('Permission denied. Check if sender number has permission to send to recipient.');
        break;
      default:
        this.logger.error('Validation failed. Check request parameters and format.');
    }
  }

  /**
   * Handle network/timeout errors
   */
  async handleNetworkError(error: any, attemptNumber: number, context?: TwilioLogContext): Promise<void> {
    const delay = this.calculateDelay(attemptNumber);
    
    this.logger.warn('Twilio network error:', {
      code: error.code,
      message: error.message,
      attemptNumber,
      retryAfter: delay
    });

    // Log structured retry attempt
    if (context) {
      this.twilioLogger.logRetryAttempt(context, attemptNumber, delay);
    }

    // Wait before retry
    await this.sleep(delay);
  }

  /**
   * Handle service unavailable errors
   */
  async handleServiceUnavailableError(error: TwilioError, attemptNumber: number, context?: TwilioLogContext): Promise<void> {
    const delay = this.calculateDelay(attemptNumber);
    
    this.logger.warn('Twilio service unavailable:', {
      code: error.code,
      message: error.message,
      attemptNumber,
      retryAfter: delay
    });

    // Log structured retry attempt and create alert if critical
    if (context) {
      this.twilioLogger.logRetryAttempt(context, attemptNumber, delay);
      
      // Create alert for service unavailable if multiple attempts
      if (attemptNumber >= 2) {
        this.twilioLogger.createAlert(context.correlationId, 'service_unavailable', {
          errorCode: error.code,
          errorMessage: error.message,
          attemptNumber
        });
      }
    }

    // Wait before retry
    await this.sleep(delay);
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T> {
    // Generate correlation ID for tracking
    const correlationId = this.twilioLogger.generateCorrelationId();
    
    const logContext: TwilioLogContext = {
      correlationId,
      operation: operationName,
      phoneNumber: context?.to,
      timestamp: new Date(),
      metadata: context
    };

    // Log operation start
    this.twilioLogger.logOperationStart(logContext);
    
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        this.logger.debug(`Executing ${operationName} (attempt ${attempt}/${this.retryConfig.maxAttempts})`, context);
        
        const result = await operation();
        
        // Log successful completion
        this.twilioLogger.logOperationSuccess(logContext, result);
        
        if (attempt > 1) {
          this.logger.log(`${operationName} succeeded after ${attempt} attempts`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        const category = this.categorizeError(error);
        
        // Log operation failure with structured logging
        this.twilioLogger.logOperationFailure(logContext, error, attempt);
        
        this.logger.warn(`${operationName} failed (attempt ${attempt}):`, {
          category,
          code: error.code,
          message: error.message,
          correlationId,
          context
        });

        // Handle specific error types
        switch (category) {
          case ErrorCategory.AUTHENTICATION:
            this.handleAuthenticationError(error, correlationId);
            throw error; // Don't retry
          
          case ErrorCategory.VALIDATION:
            this.handleValidationError(error);
            throw error; // Don't retry
          
          case ErrorCategory.RATE_LIMITING:
            if (this.shouldRetry(error, attempt)) {
              await this.handleRateLimitError(error, attempt, logContext);
              continue;
            }
            break;
          
          case ErrorCategory.NETWORK:
            if (this.shouldRetry(error, attempt)) {
              await this.handleNetworkError(error, attempt, logContext);
              continue;
            }
            break;
          
          case ErrorCategory.SERVICE_UNAVAILABLE:
            if (this.shouldRetry(error, attempt)) {
              await this.handleServiceUnavailableError(error, attempt, logContext);
              continue;
            }
            break;
          
          default:
            if (this.shouldRetry(error, attempt)) {
              const delay = this.calculateDelay(attempt);
              this.twilioLogger.logRetryAttempt(logContext, attempt, delay);
              await this.sleep(delay);
              continue;
            }
        }

        // If we reach here, we're not retrying
        break;
      }
    }

    // All retries exhausted - log final failure
    this.twilioLogger.logOperationFailure(logContext, lastError);
    
    this.logger.error(`${operationName} failed after ${this.retryConfig.maxAttempts} attempts:`, {
      finalError: lastError.message,
      correlationId,
      context
    });
    
    throw lastError;
  }

  /**
   * Get error details for logging and monitoring
   */
  getErrorDetails(error: any): {
    category: ErrorCategory;
    code: number | string;
    message: string;
    retryable: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } {
    const category = this.categorizeError(error);
    const retryable = this.shouldRetry(error, 1);
    
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        severity = 'critical';
        break;
      case ErrorCategory.RATE_LIMITING:
        severity = 'high';
        break;
      case ErrorCategory.VALIDATION:
        severity = 'medium';
        break;
      case ErrorCategory.NETWORK:
        severity = 'low';
        break;
      case ErrorCategory.SERVICE_UNAVAILABLE:
        severity = 'high';
        break;
    }

    return {
      category,
      code: error.code || error.status || 'unknown',
      message: error.message || 'Unknown error',
      retryable,
      severity
    };
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}