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
  ) { }

  /**
   * Webhook verification endpoint for WhatsApp setup
   * GET /whatsapp/webhook
   */
  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook verification',
    description: 'Verifies the webhook during WhatsApp setup. This endpoint is called by Meta to verify your webhook URL (for Meta API fallback only).'
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
    description: 'Processes incoming WhatsApp messages and executes business logic. This endpoint receives webhooks from Meta WhatsApp Cloud API (for fallback only). Primary webhook endpoint is /whatsapp/twilio/webhook.'
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
   * Twilio WhatsApp webhook endpoint
   * POST /whatsapp/twilio
   */
  @Post('twilio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive Twilio WhatsApp messages',
    description: 'Processes incoming WhatsApp messages from Twilio Programmable Messaging API'
  })
  @ApiBody({
    description: 'Twilio WhatsApp webhook payload',
    schema: {
      type: 'object',
      properties: {
        MessageSid: { type: 'string', example: 'SM1234567890abcdef1234567890abcdef' },
        AccountSid: { type: 'string', example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
        MessagingServiceSid: { type: 'string', example: 'MG1234567890abcdef1234567890abcdef' },
        From: { type: 'string', example: 'whatsapp:+226123456789' },
        To: { type: 'string', example: 'whatsapp:+14155238886' },
        Body: { type: 'string', example: 'vente pain 1500' },
        NumMedia: { type: 'string', example: '0' },
        ProfileName: { type: 'string', example: 'John Doe' },
        WaId: { type: 'string', example: '221123456789' },
        SmsMessageSid: { type: 'string', example: 'SM1234567890abcdef1234567890abcdef' },
        SmsStatus: { type: 'string', example: 'received' },
        SmsSid: { type: 'string', example: 'SM1234567890abcdef1234567890abcdef' }
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
        message: { type: 'string', example: 'Message processed successfully' }
      }
    }
  })
  async handleTwilioWebhook(@Body() payload: any): Promise<{ success: boolean; message: string }> {
    this.logger.log('Twilio webhook message received');
    this.logger.debug('Twilio payload:', payload);

    try {
      // Extract phone number from Twilio format (whatsapp:+226123456789 -> +226123456789)
      const from = payload.From?.replace('whatsapp:', '') || payload.WaId;
      const message = payload.Body || '';
      const messageId = payload.MessageSid || `twilio-${Date.now()}`;
      const profileName = payload.ProfileName || '';

      if (!from || !message) {
        this.logger.warn('Invalid Twilio payload: missing From or Body');
        return {
          success: false,
          message: 'Invalid payload: missing From or Body'
        };
      }

      // Convert Twilio format to our internal format
      const internalPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'twilio-entry',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: payload.To?.replace('whatsapp:', '') || '',
                phone_number_id: 'twilio_phone_id'
              },
              messages: [{
                id: messageId,
                from: from,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: message
                },
                type: 'text' as const
              }],
              contacts: [{
                profile: {
                  name: profileName
                },
                wa_id: payload.WaId || from
              }]
            },
            field: 'messages'
          }]
        }]
      };

      // Process using existing WhatsApp service
      const result = await this.whatsappService.processWebhook(
        internalPayload,
        undefined, // No signature verification for Twilio in this basic implementation
        JSON.stringify(internalPayload)
      );

      this.logger.log(`Twilio webhook processed successfully: ${result.messagesProcessed} messages`);

      return {
        success: true,
        message: `Message processed successfully`
      };
    } catch (error) {
      this.logger.error('Twilio webhook processing failed:', error);

      return {
        success: false,
        message: error.message || 'Failed to process message'
      };
    }
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
              phone_number_id: 'twilio_phone_id'
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

  /**
   * Test endpoint for Twilio WhatsApp format (development only)
   * POST /whatsapp/test-twilio
   */
  @Post('test-twilio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test Twilio WhatsApp webhook format',
    description: 'Test endpoint that simulates a Twilio WhatsApp webhook for development purposes'
  })
  @ApiBody({
    description: 'Test message data',
    schema: {
      type: 'object',
      properties: {
        from: { type: 'string', example: '+226123456789', description: 'Phone number without whatsapp: prefix' },
        message: { type: 'string', example: 'vente pain 1500', description: 'Message content' },
        profileName: { type: 'string', example: 'John Doe', description: 'WhatsApp profile name (optional)' }
      },
      required: ['from', 'message']
    }
  })
  async testTwilioMessage(@Body() body: { from: string; message: string; profileName?: string }): Promise<any> {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new BadRequestException('Test endpoint not available in production');
    }

    this.logger.log(`Test Twilio message from ${body.from}: ${body.message}`);

    // Create a mock Twilio payload
    const twilioPayload = {
      MessageSid: `SM${Math.random().toString(36).substring(2, 34)}`,
      AccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      MessagingServiceSid: 'MG1234567890abcdef1234567890abcdef',
      From: `whatsapp:${body.from}`,
      To: 'whatsapp:+14155238886',
      Body: body.message,
      NumMedia: '0',
      ProfileName: body.profileName || 'Test User',
      WaId: body.from.replace('+', ''),
      SmsMessageSid: `SM${Math.random().toString(36).substring(2, 34)}`,
      SmsStatus: 'received',
      SmsSid: `SM${Math.random().toString(36).substring(2, 34)}`
    };

    // Process through Twilio webhook handler
    const result = await this.handleTwilioWebhook(twilioPayload);

    return {
      success: true,
      message: 'Test Twilio message processed',
      twilioPayload,
      result
    };
  }

  /**
   * Test endpoint complètement offline (ne touche pas Twilio)
   * POST /whatsapp/test-offline
   */
  @Post('test-offline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test offline sans Twilio',
    description: 'Teste la logique du bot sans envoyer de messages Twilio - Aucune limite'
  })
  @ApiBody({
    description: 'Test message data',
    schema: {
      type: 'object',
      properties: {
        from: { type: 'string', example: '+226123456789', description: 'Phone number' },
        message: { type: 'string', example: 'vente pain 1500', description: 'Message content' },
        profileName: { type: 'string', example: 'Test User', description: 'Profile name (optional)' }
      },
      required: ['from', 'message']
    }
  })
  async testOfflineMessage(@Body() body: { from: string; message: string; profileName?: string }): Promise<any> {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new BadRequestException('Test endpoint not available in production');
    }

    this.logger.log(`Test offline message from ${body.from}: ${body.message}`);

    try {
      // Créer un message simulé pour le bot controller
      const simulatedMessage = {
        messageId: `offline-${Date.now()}`,
        from: body.from,
        body: body.message,
        timestamp: new Date(),
        type: 'text' as const
      };

      // Traiter avec le bot controller directement (sans Twilio)
      const result = await this.botController.processMessage(simulatedMessage);

      return {
        success: true,
        message: 'Message traité en mode offline',
        input: {
          from: body.from,
          message: body.message,
          profileName: body.profileName
        },
        result: result,
        note: 'Aucun message Twilio envoyé - Mode offline complet'
      };

    } catch (error) {
      this.logger.error('Erreur test offline:', error);
      return {
        success: false,
        message: 'Erreur lors du traitement offline',
        error: error.message,
        note: 'Aucun message Twilio envoyé même en cas d\'erreur'
      };
    }
  }
}