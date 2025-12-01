import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody } from '@nestjs/swagger';
import { TwilioConfigService } from '../../../config/twilio.config';
import { TwilioMessageParser, ProcessedTwilioMessage } from '../services/twilio-message-parser.service';
import { WhatsappService } from '../whatsapp.service';
import { TwilioWebhookPayloadDto } from '../dto/twilio-webhook.dto';

@ApiTags('Twilio WhatsApp')
@Controller('whatsapp/twilio')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(
    private readonly twilioConfig: TwilioConfigService,
    private readonly twilioMessageParser: TwilioMessageParser,
    private readonly whatsappService: WhatsappService,
  ) { }

  /**
   * Twilio WhatsApp webhook endpoint
   * POST /whatsapp/twilio/webhook
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive Twilio WhatsApp messages',
    description: 'Processes incoming WhatsApp messages from Twilio Programmable Messaging API with signature verification'
  })
  @ApiHeader({
    name: 'x-twilio-signature',
    description: 'Twilio signature for payload verification',
    required: false,
    example: 'sha1=abc123...'
  })
  @ApiBody({
    description: 'Twilio WhatsApp webhook payload',
    type: TwilioWebhookPayloadDto,
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
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleTwilioWebhook(
    @Req() req: any,
    @Res() res: Response,
    @Body() payload: TwilioWebhookPayloadDto,
    @Headers('x-twilio-signature') signature?: string,
  ): Promise<void> {
    this.logger.log('Twilio webhook message received');
    this.logger.debug('Twilio payload:', {
      MessageSid: payload.MessageSid,
      From: payload.From,
      To: payload.To,
      Body: payload.Body?.substring(0, 50) + (payload.Body?.length > 50 ? '...' : ''),
      SmsStatus: payload.SmsStatus,
    });

    try {
      // Validate payload structure using parser
      this.twilioMessageParser.validatePayload(payload);

      // Verify webhook signature if secret is configured
      const config = this.twilioConfig.getTwilioConfig();
      if (config.webhookSecret && signature) {
        this.verifyWebhookSignature(req, signature, config.webhookSecret);
      } else if (config.webhookSecret && !signature) {
        this.logger.warn('Webhook secret configured but no signature provided');
        throw new UnauthorizedException('Missing webhook signature');
      }

      // Parse Twilio payload to internal format
      const processedMessage = this.twilioMessageParser.parseWebhookPayload(payload);

      // Check for message deduplication using parser
      if (this.twilioMessageParser.isMessageProcessed(payload.MessageSid)) {
        this.logger.log(`Duplicate message detected: ${payload.MessageSid}`);
        // Return TwiML response without charset (Twilio requirement)
        res.setHeader('Content-Type', 'text/xml');
        res.status(HttpStatus.OK).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        return;
      }

      // Convert to internal webhook format and process
      const internalPayload = this.convertToInternalFormat(processedMessage, payload);
      this.logger.debug('Converted payload to internal format:', {
        messageId: processedMessage.messageId,
        from: processedMessage.from,
        body: processedMessage.body.substring(0, 50)
      });

      this.logger.log('Processing webhook via WhatsAppService...');
      const result = await this.whatsappService.processWebhook(
        internalPayload,
        undefined, // No Meta signature for Twilio
        JSON.stringify(internalPayload)
      );

      this.logger.log(`WhatsAppService processed webhook: ${result.messagesProcessed} messages queued, ${result.errors.length} errors`);
      if (result.errors.length > 0) {
        this.logger.error('Errors during webhook processing:', result.errors);
      }

      // Mark message as processed for deduplication
      this.twilioMessageParser.markMessageAsProcessed(payload.MessageSid);

      this.logger.log(`Twilio webhook processed successfully: ${result.messagesProcessed} messages queued`);

      // Return TwiML response (Twilio expects XML, not JSON)
      // Content-Type must be text/xml without charset=utf-8
      res.setHeader('Content-Type', 'text/xml');
      res.status(HttpStatus.OK).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      this.logger.debug('TwiML response sent to Twilio');
    } catch (error) {
      this.logger.error('Twilio webhook processing failed:', error);

      // Return appropriate error response as TwiML
      res.setHeader('Content-Type', 'text/xml');
      
      if (error instanceof UnauthorizedException) {
        res.status(HttpStatus.UNAUTHORIZED).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        return;
      }
      
      if (error instanceof BadRequestException) {
        res.status(HttpStatus.BAD_REQUEST).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
        return;
      }

      // For unexpected errors, return 500 to trigger Twilio retry
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }



  /**
   * Verify Twilio webhook signature
   */
  private verifyWebhookSignature(
    req: any,
    signature: string,
    webhookSecret: string
  ): void {
    try {
      const rawBody = req.rawBody ? req.rawBody.toString() : '';
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

      // Use Twilio's signature validation
      const twilioLib = require('twilio');
      const isValid = twilioLib.validateRequest(webhookSecret, rawBody, signature, url);

      if (!isValid) {
        this.logger.warn('Invalid Twilio webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }

      this.logger.debug('Twilio webhook signature verified successfully');
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Error verifying Twilio webhook signature:', error);
      throw new UnauthorizedException('Signature verification failed');
    }
  }



  /**
   * Convert processed message to internal webhook format
   */
  private convertToInternalFormat(processedMessage: ProcessedTwilioMessage, originalPayload: TwilioWebhookPayloadDto): any {
    return {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'twilio-entry',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: this.twilioMessageParser.extractPhoneNumber(originalPayload.To || ''),
              phone_number_id: 'twilio_phone_id'
            },
            messages: [{
              id: processedMessage.messageId,
              from: processedMessage.from,
              timestamp: Math.floor(processedMessage.timestamp.getTime() / 1000).toString(),
              text: {
                body: processedMessage.body
              },
              type: 'text' as const
            }],
            contacts: originalPayload.ProfileName ? [{
              profile: {
                name: originalPayload.ProfileName
              },
              wa_id: originalPayload.WaId || processedMessage.from.replace('+', '')
            }] : undefined
          },
          field: 'messages'
        }]
      }]
    };
  }
}