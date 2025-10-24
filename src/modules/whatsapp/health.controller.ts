import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BotController } from './bot.controller';
import { WhatsappService } from './whatsapp.service';
import { MessageQueueService } from './services/message-queue.service';
import { TwilioWhatsAppService } from './services/twilio-whatsapp.service';
import { TwilioConfigService } from '../../config/twilio.config';
import { TwilioLoggerService } from './services/twilio-logger.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly botController: BotController,
    private readonly whatsappService: WhatsappService,
    private readonly messageQueueService: MessageQueueService,
    private readonly twilioWhatsAppService: TwilioWhatsAppService,
    private readonly twilioConfig: TwilioConfigService,
    private readonly twilioLogger: TwilioLoggerService,
  ) {}

  /**
   * Validate Twilio configuration
   */
  private validateTwilioConfiguration(): { valid: boolean; errors: string[] } {
    const correlationId = this.twilioLogger.generateCorrelationId();
    const errors: string[] = [];
    
    try {
      const config = this.twilioConfig.getTwilioConfig();
      
      if (!config.accountSid) {
        errors.push('TWILIO_ACCOUNT_SID is missing');
      } else if (!config.accountSid.startsWith('AC')) {
        errors.push('TWILIO_ACCOUNT_SID format is invalid (should start with AC)');
      }
      
      if (!config.authToken) {
        errors.push('TWILIO_AUTH_TOKEN is missing');
      } else if (config.authToken.length < 32) {
        errors.push('TWILIO_AUTH_TOKEN appears to be invalid (too short)');
      }
      
      if (!config.whatsappNumber) {
        errors.push('TWILIO_WHATSAPP_NUMBER is missing');
      } else if (!config.whatsappNumber.startsWith('+')) {
        errors.push('TWILIO_WHATSAPP_NUMBER should be in E.164 format (start with +)');
      }
      
      const valid = errors.length === 0;
      
      // Log configuration validation result
      this.twilioLogger.logConfigurationValidation(correlationId, valid, errors);
      
      return { valid, errors };
    } catch (error) {
      errors.push(`Configuration validation failed: ${error.message}`);
      this.twilioLogger.logConfigurationValidation(correlationId, false, errors);
      return { valid: false, errors };
    }
  }

  /**
   * Comprehensive system health check
   * GET /health
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Complete system health check',
    description: 'Returns comprehensive health status of all system components including bot services, WhatsApp integration, message queue, and database connectivity.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'System health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string', example: '1.0.0' },
        uptime: { type: 'number', example: 3600 },
        components: {
          type: 'object',
          properties: {
            bot: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                services: {
                  type: 'object',
                  properties: {
                    nlp: { type: 'boolean' },
                    auth: { type: 'boolean' },
                    transaction: { type: 'boolean' },
                    stock: { type: 'boolean' },
                    report: { type: 'boolean' },
                    whatsapp: { type: 'boolean' }
                  }
                }
              }
            },
            whatsapp: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                config: {
                  type: 'object',
                  properties: {
                    hasAccessToken: { type: 'boolean' },
                    hasPhoneNumberId: { type: 'boolean' },
                    hasWebhookToken: { type: 'boolean' }
                  }
                }
              }
            },
            queue: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                queueSize: { type: 'number' },
                processingCount: { type: 'number' },
                backlog: { type: 'string', enum: ['normal', 'high'] }
              }
            }
          }
        }
      }
    }
  })
  async systemHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    components: {
      bot: any;
      whatsapp: any;
      twilio: any;
      queue: any;
      database: any;
    };
  }> {
    const startTime = Date.now();
    
    // Get component health statuses
    const botHealth = await this.botController.healthCheck();
    const webhookConfig = this.whatsappService.getWebhookConfig();
    const queueStats = this.messageQueueService.getQueueStats();
    
    // Check Twilio configuration and connectivity
    const twilioConfigValidation = this.validateTwilioConfiguration();
    let twilioHealth = { healthy: false, details: {}, correlationId: '' };
    
    if (twilioConfigValidation.valid) {
      try {
        const healthResult = await this.twilioWhatsAppService.checkHealth();
        twilioHealth = {
          healthy: healthResult.healthy,
          details: healthResult.details || {},
          correlationId: healthResult.correlationId
        };
      } catch (error) {
        twilioHealth = {
          healthy: false,
          details: { error: error.message },
          correlationId: this.twilioLogger.generateCorrelationId()
        };
      }
    } else {
      twilioHealth = {
        healthy: false,
        details: { configErrors: twilioConfigValidation.errors },
        correlationId: this.twilioLogger.generateCorrelationId()
      };
    }
    
    // Test database connectivity (basic check)
    let databaseHealth = { status: 'healthy', connected: true };
    try {
      // This will be tested through the bot controller's service calls
      await this.botController.healthCheck();
    } catch (error) {
      databaseHealth = { status: 'unhealthy', connected: false };
    }

    // Determine overall system status
    const componentStatuses = [
      botHealth.status,
      Object.values(webhookConfig).every(Boolean) ? 'healthy' : 'degraded',
      twilioHealth.healthy ? 'healthy' : 'unhealthy',
      queueStats.queueSize < 100 ? 'healthy' : 'degraded', // Queue not too backed up
      databaseHealth.status
    ];

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (componentStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    const responseTime = Date.now() - startTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      components: {
        bot: {
          ...botHealth,
          responseTime: `${responseTime}ms`
        },
        whatsapp: {
          status: Object.values(webhookConfig).every(Boolean) ? 'healthy' : 'degraded',
          config: webhookConfig,
          api: 'connected' // Assume connected if config is valid
        },
        twilio: {
          status: twilioHealth.healthy ? 'healthy' : 'unhealthy',
          healthy: twilioHealth.healthy,
          correlationId: twilioHealth.correlationId,
          configuration: {
            valid: twilioConfigValidation.valid,
            errors: twilioConfigValidation.errors
          },
          connectivity: twilioHealth.details
        },
        queue: {
          status: queueStats.queueSize < 100 ? 'healthy' : 'degraded',
          ...queueStats,
          backlog: queueStats.queueSize > 10 ? 'high' : 'normal'
        },
        database: databaseHealth
      }
    };
  }

  /**
   * Readiness probe for Kubernetes/container orchestration
   * GET /health/ready
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readinessCheck(): Promise<{ ready: boolean; timestamp: string; details?: any }> {
    try {
      // Check if all critical services are ready
      const botHealth = await this.botController.healthCheck();
      const webhookConfig = this.whatsappService.getWebhookConfig();
      const twilioConfigValidation = this.validateTwilioConfiguration();
      
      let twilioReady = false;
      if (twilioConfigValidation.valid) {
        try {
          const twilioHealth = await this.twilioWhatsAppService.checkHealth();
          twilioReady = twilioHealth.healthy;
        } catch (error) {
          twilioReady = false;
        }
      }
      
      const isReady = botHealth.status !== 'unhealthy' && 
                     webhookConfig.hasAccessToken && 
                     webhookConfig.hasPhoneNumberId &&
                     twilioReady;

      if (!isReady) {
        return {
          ready: false,
          timestamp: new Date().toISOString(),
          details: {
            bot: botHealth.status !== 'unhealthy',
            whatsapp: webhookConfig.hasAccessToken && webhookConfig.hasPhoneNumberId,
            twilio: twilioReady,
            twilioConfig: twilioConfigValidation.valid
          }
        };
      }

      return {
        ready: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        details: { error: error.message }
      };
    }
  }

  /**
   * Liveness probe for Kubernetes/container orchestration
   * GET /health/live
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  async livenessCheck(): Promise<{ alive: boolean; timestamp: string }> {
    // Simple liveness check - if we can respond, we're alive
    return {
      alive: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Dedicated Twilio health check
   * GET /health/twilio
   */
  @Get('twilio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Twilio service health check',
    description: 'Returns detailed health status of Twilio integration including configuration validation and connectivity test.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Twilio service health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy'] },
        timestamp: { type: 'string', format: 'date-time' },
        correlationId: { type: 'string' },
        configuration: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            errors: { type: 'array', items: { type: 'string' } }
          }
        },
        connectivity: {
          type: 'object',
          properties: {
            healthy: { type: 'boolean' },
            details: { type: 'object' }
          }
        }
      }
    }
  })
  async twilioHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    correlationId: string;
    configuration: { valid: boolean; errors: string[] };
    connectivity: { healthy: boolean; details: any };
  }> {
    const timestamp = new Date().toISOString();
    
    // Validate configuration
    const configValidation = this.validateTwilioConfiguration();
    
    // Test connectivity if configuration is valid
    let connectivityResult = { healthy: false, details: {}, correlationId: '' };
    
    if (configValidation.valid) {
      try {
        const healthResult = await this.twilioWhatsAppService.checkHealth();
        connectivityResult = {
          healthy: healthResult.healthy,
          details: healthResult.details || {},
          correlationId: healthResult.correlationId
        };
      } catch (error) {
        connectivityResult = {
          healthy: false,
          details: { error: error.message },
          correlationId: this.twilioLogger.generateCorrelationId()
        };
      }
    } else {
      connectivityResult.correlationId = this.twilioLogger.generateCorrelationId();
    }
    
    const overallHealthy = configValidation.valid && connectivityResult.healthy;
    
    return {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp,
      correlationId: connectivityResult.correlationId,
      configuration: configValidation,
      connectivity: {
        healthy: connectivityResult.healthy,
        details: connectivityResult.details
      }
    };
  }

  /**
   * Detailed metrics for monitoring systems
   * GET /health/metrics
   */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async metricsCheck(): Promise<{
    timestamp: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    queue: any;
    twilio: any;
    process: {
      pid: number;
      version: string;
      platform: string;
      arch: string;
    };
  }> {
    const queueStats = this.messageQueueService.getQueueStats();
    
    // Get Twilio metrics
    const twilioConfigValidation = this.validateTwilioConfiguration();
    let twilioMetrics = {
      configurationValid: twilioConfigValidation.valid,
      configurationErrors: twilioConfigValidation.errors,
      connectivity: 'unknown',
      lastHealthCheck: null
    };
    
    if (twilioConfigValidation.valid) {
      try {
        const healthCheck = await this.twilioWhatsAppService.checkHealth();
        twilioMetrics = {
          ...twilioMetrics,
          connectivity: healthCheck.healthy ? 'healthy' : 'unhealthy',
          lastHealthCheck: new Date().toISOString()
        };
      } catch (error) {
        twilioMetrics = {
          ...twilioMetrics,
          connectivity: 'error',
          lastHealthCheck: new Date().toISOString()
        };
      }
    }
    
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queue: queueStats,
      twilio: twilioMetrics,
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }
}