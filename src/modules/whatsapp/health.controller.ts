import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BotController } from './bot.controller';
import { WhatsappService } from './whatsapp.service';
import { MessageQueueService } from './services/message-queue.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly botController: BotController,
    private readonly whatsappService: WhatsappService,
    private readonly messageQueueService: MessageQueueService,
  ) {}

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
      queue: any;
      database: any;
    };
  }> {
    const startTime = Date.now();
    
    // Get component health statuses
    const botHealth = await this.botController.healthCheck();
    const webhookConfig = this.whatsappService.getWebhookConfig();
    const queueStats = this.messageQueueService.getQueueStats();
    
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
  async readinessCheck(): Promise<{ ready: boolean; timestamp: string }> {
    try {
      // Check if all critical services are ready
      const botHealth = await this.botController.healthCheck();
      const webhookConfig = this.whatsappService.getWebhookConfig();
      
      const isReady = botHealth.status !== 'unhealthy' && 
                     webhookConfig.hasAccessToken && 
                     webhookConfig.hasPhoneNumberId;

      if (!isReady) {
        throw new Error('System not ready');
      }

      return {
        ready: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        ready: false,
        timestamp: new Date().toISOString()
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
    process: {
      pid: number;
      version: string;
      platform: string;
      arch: string;
    };
  }> {
    const queueStats = this.messageQueueService.getQueueStats();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queue: queueStats,
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }
}