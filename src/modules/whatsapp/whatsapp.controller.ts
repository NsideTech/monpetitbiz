import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Query, 
  Headers, 
  HttpCode, 
  HttpStatus, 
  Logger,
  BadRequestException,
  UnauthorizedException,
  RawBodyRequest,
  Req
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery, ApiBody } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { BotController } from './bot.controller';
import { WebhookVerificationDto, WebhookPayloadDto } from './dto/webhook.dto';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly botController: BotController,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Webhook verification endpoint for WhatsApp setup
   * GET /whatsapp/webhook
   */
  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Webhook verification',
    description: 'Verifies the webhook during WhatsApp setup. This endpoint is called by Meta to verify your webhook URL.'
  })
  @ApiQuery({ name: 'hub.mode', description: 'Webhook mode (should be "subscribe")', example: 'subscribe' })
  @ApiQuery({ name: 'hub.challenge', description: 'Challenge string to echo back', example: '1234567890' })
  @ApiQuery({ name: 'hub.verify_token', description: 'Verification token', example: 'your_verify_token' })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook verified successfully',
    schema: { type: 'string', example: '1234567890' }
  })
  @ApiResponse({ status: 401, description: 'Invalid verify token' })
  async verifyWebhook(@Query() query: WebhookVerificationDto): Promise<string> {
    this.logger.log('Webhook verification request received');
    
    try {
      const challenge = await this.whatsappService.verifyWebhook(
        query['hub.mode'],
        query['hub.challenge'],
        query['hub.verify_token']
      );
      
      this.logger.log('Webhook verification successful');
      return challenge;
    } catch (error) {
      this.logger.error('Webhook verification failed:', error);
      throw new UnauthorizedException('Webhook verification failed');
    }
  }

  /**
   * Webhook endpoint to receive WhatsApp messages
   * POST /whatsapp/webhook
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Receive WhatsApp messages',
    description: 'Processes incoming WhatsApp messages and executes business logic. This endpoint receives webhooks from Meta WhatsApp Cloud API.'
  })
  @ApiHeader({ 
    name: 'x-hub-signature-256', 
    description: 'WhatsApp signature for payload verification',
    required: false,
    example: 'sha256=abc123...'
  })
  @ApiBody({
    description: 'WhatsApp webhook payload',
    schema: {
      type: 'object',
      properties: {
        object: { type: 'string', example: 'whatsapp_business_account' },
        entry: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              changes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    value: {
                      type: 'object',
                      properties: {
                        messaging_product: { type: 'string', example: 'whatsapp' },
                        metadata: {
                          type: 'object',
                          properties: {
                            display_phone_number: { type: 'string' },
                            phone_number_id: { type: 'string' }
                          }
                        },
                        messages: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              from: { type: 'string', example: '221123456789' },
                              timestamp: { type: 'string' },
                              text: {
                                type: 'object',
                                properties: {
                                  body: { type: 'string', example: 'vente 1000' }
                                }
                              },
                              type: { type: 'string', example: 'text' }
                            }
                          }
                        }
                      }
                    },
                    field: { type: 'string', example: 'messages' }
                  }
                }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Message processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Processed 1 messages' }
      }
    }
  })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: WebhookPayloadDto,
    @Headers('x-hub-signature-256') signature?: string
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log('Webhook message received');
    
    try {
      // Get raw body for signature verification
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(payload);
      
      // Process the webhook payload
      const result = await this.whatsappService.processWebhook(payload, signature, rawBody);
      
      this.logger.log(`Webhook processed successfully: ${result.messagesProcessed} messages`);
      
      return {
        success: true,
        message: `Processed ${result.messagesProcessed} messages`
      };
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      
      // Return success to WhatsApp to avoid retries for client errors
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        return {
          success: false,
          message: error.message
        };
      }
      
      // For server errors, let WhatsApp retry
      throw error;
    }
  }

  /**
   * Health check endpoint
   * GET /whatsapp/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(): Promise<{ 
    status: string; 
    timestamp: string; 
    queue: any;
    bot: any;
    webhook: any;
  }> {
    const queueStats = await this.whatsappService.getQueueStats();
    const botHealth = await this.botController.healthCheck();
    const webhookConfig = this.whatsappService.getWebhookConfig();
    
    const overallStatus = botHealth.status === 'healthy' && 
                         Object.values(webhookConfig).every(Boolean) ? 
                         'healthy' : 'degraded';
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      queue: queueStats,
      bot: botHealth,
      webhook: webhookConfig
    };
  }

  /**
   * Test endpoint for development (should be removed in production)
   * POST /whatsapp/test
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testMessage(@Body() body: { from: string; message: string }): Promise<any> {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new BadRequestException('Test endpoint not available in production');
    }

    this.logger.log(`Test message from ${body.from}: ${body.message}`);
    
    // Create a mock message for testing
    const testPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'test-entry',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '1234567890',
              phone_number_id: 'test-phone-id'
            },
            messages: [{
              id: `test-${Date.now()}`,
              from: body.from,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: body.message
              },
              type: 'text' as const
            }]
          },
          field: 'messages'
        }]
      }]
    };

    const result = await this.whatsappService.processWebhook(testPayload, undefined, JSON.stringify(testPayload));
    
    return {
      success: true,
      message: 'Test message processed',
      result
    };
  }
}