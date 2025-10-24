import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../whatsapp.service';
import { TwilioWhatsAppService } from './twilio-whatsapp.service';
import { WebhookPayload } from '../interfaces/webhook.interface';
import { TwilioWebhookPayloadDto } from '../dto/twilio-webhook.dto';

export interface TwilioWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  MessagingServiceSid?: string;
  From: string;
  To: string;
  Body?: string;
  NumMedia?: string;
  ProfileName?: string;
  WaId?: string;
  SmsMessageSid?: string;
  SmsStatus: 'received' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  SmsSid?: string;
  ApiVersion?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

export type WhatsAppProvider = 'meta' | 'twilio';

export interface ProviderHealth {
  meta: boolean;
  twilio: boolean;
}

export interface DualProviderConfig {
  primaryProvider: WhatsAppProvider;
  fallbackEnabled: boolean;
  healthCheckInterval: number;
  featureFlags: {
    enableTwilioSending: boolean;
    enableTwilioWebhooks: boolean;
    enableMetaFallback: boolean;
  };
}

@Injectable()
export class DualProviderService {
  private readonly logger = new Logger(DualProviderService.name);
  private providerHealth: ProviderHealth = { meta: true, twilio: true };
  private lastHealthCheck: Date = new Date();

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    private readonly twilioService: TwilioWhatsAppService,
  ) {
    this.initializeHealthChecking();
  }

  /**
   * Get dual provider configuration from environment variables
   */
  private getDualProviderConfig(): DualProviderConfig {
    return {
      primaryProvider: this.configService.get<WhatsAppProvider>('WHATSAPP_PRIMARY_PROVIDER', 'twilio'),
      fallbackEnabled: this.configService.get<boolean>('WHATSAPP_FALLBACK_ENABLED', true),
      healthCheckInterval: this.configService.get<number>('WHATSAPP_HEALTH_CHECK_INTERVAL', 300000), // 5 minutes
      featureFlags: {
        enableTwilioSending: this.configService.get<boolean>('WHATSAPP_ENABLE_TWILIO_SENDING', true),
        enableTwilioWebhooks: this.configService.get<boolean>('WHATSAPP_ENABLE_TWILIO_WEBHOOKS', true),
        enableMetaFallback: this.configService.get<boolean>('WHATSAPP_ENABLE_META_FALLBACK', false),
      },
    };
  }

  /**
   * Send a WhatsApp message using the appropriate provider
   */
  async sendMessage(
    to: string, 
    message: string, 
    preferredProvider?: WhatsAppProvider
  ): Promise<{ success: boolean; provider: WhatsAppProvider; messageId?: string; error?: string }> {
    const config = this.getDualProviderConfig();
    const provider = this.selectProvider(preferredProvider, 'sending');

    this.logger.debug(`Sending message via ${provider} provider to ${to}`);

    try {
      if (provider === 'twilio') {
        const result = await this.twilioService.sendMessage(to, message);
        return {
          success: true,
          provider: 'twilio',
          messageId: result.sid,
        };
      } else {
        await this.whatsappService.sendMessage(to, message);
        return {
          success: true,
          provider: 'meta',
          messageId: 'meta-message-id', // Meta doesn't return message ID in current implementation
        };
      }
    } catch (error) {
      this.logger.error(`Failed to send message via ${provider}:`, error);

      // Try fallback if enabled and primary provider failed
      if (config.fallbackEnabled && !preferredProvider) {
        const fallbackProvider = provider === 'twilio' ? 'meta' : 'twilio';
        
        if (this.isProviderHealthy(fallbackProvider)) {
          this.logger.warn(`Attempting fallback to ${fallbackProvider} provider`);
          return this.sendMessage(to, message, fallbackProvider);
        }
      }

      return {
        success: false,
        provider,
        error: error.message,
      };
    }
  }

  /**
   * Send media/document using the appropriate provider
   */
  async sendMedia(
    to: string,
    mediaUrl: string,
    caption?: string,
    fileName?: string,
    preferredProvider?: WhatsAppProvider
  ): Promise<{ success: boolean; provider: WhatsAppProvider; messageId?: string; error?: string }> {
    const config = this.getDualProviderConfig();
    const provider = this.selectProvider(preferredProvider, 'sending');

    this.logger.debug(`Sending media via ${provider} provider to ${to}`);

    try {
      if (provider === 'twilio') {
        const result = await this.twilioService.sendMedia(to, mediaUrl, caption, fileName);
        return {
          success: true,
          provider: 'twilio',
          messageId: result.sid,
        };
      } else {
        await this.whatsappService.sendPDFDocument(to, mediaUrl, fileName || 'document.pdf', caption);
        return {
          success: true,
          provider: 'meta',
          messageId: 'meta-media-id',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to send media via ${provider}:`, error);

      // Try fallback if enabled and primary provider failed
      if (config.fallbackEnabled && !preferredProvider) {
        const fallbackProvider = provider === 'twilio' ? 'meta' : 'twilio';
        
        if (this.isProviderHealthy(fallbackProvider)) {
          this.logger.warn(`Attempting fallback to ${fallbackProvider} provider`);
          return this.sendMedia(to, mediaUrl, caption, fileName, fallbackProvider);
        }
      }

      return {
        success: false,
        provider,
        error: error.message,
      };
    }
  }

  /**
   * Process webhook from either provider
   */
  async processWebhook(
    payload: WebhookPayload | TwilioWebhookPayload,
    source: WhatsAppProvider,
    signature?: string,
    rawBody?: string
  ): Promise<{ success: boolean; messagesProcessed: number; errors: string[] }> {
    const config = this.getDualProviderConfig();

    this.logger.debug(`Processing ${source} webhook`);

    try {
      if (source === 'twilio' && config.featureFlags.enableTwilioWebhooks) {
        // Process Twilio webhook directly
        // For now, we'll convert it to Meta format and use existing processing
        // This will be improved in later tasks
        const convertedPayload = this.convertTwilioToMetaFormat(payload as TwilioWebhookPayload);
        const result = await this.whatsappService.processWebhookDirect(convertedPayload, signature, rawBody);
        return { success: true, ...result };
      } else if (source === 'meta') {
        // Process Meta webhook using existing service
        const result = await this.whatsappService.processWebhookDirect(payload as WebhookPayload, signature, rawBody);
        return { success: true, ...result };
      } else {
        this.logger.warn(`Webhook processing for ${source} is disabled or not supported`);
        return { success: false, messagesProcessed: 0, errors: ['Provider not enabled'] };
      }
    } catch (error) {
      this.logger.error(`Failed to process ${source} webhook:`, error);
      return { success: false, messagesProcessed: 0, errors: [error.message] };
    }
  }

  /**
   * Get health status of both providers
   */
  async getProviderHealth(): Promise<ProviderHealth> {
    await this.performHealthCheck();
    return { ...this.providerHealth };
  }

  /**
   * Check if a specific provider is healthy
   */
  isProviderHealthy(provider: WhatsAppProvider): boolean {
    return this.providerHealth[provider];
  }

  /**
   * Get configuration status for both providers
   */
  getProviderConfiguration(): {
    meta: { configured: boolean; details: any };
    twilio: { configured: boolean; details: any };
    dualProvider: DualProviderConfig;
  } {
    const metaConfig = this.whatsappService.getWebhookConfig();
    const twilioConfigured = this.configService.get('TWILIO_ACCOUNT_SID') && 
                            this.configService.get('TWILIO_AUTH_TOKEN') && 
                            this.configService.get('TWILIO_WHATSAPP_NUMBER');

    return {
      meta: {
        configured: metaConfig.hasAccessToken && metaConfig.hasPhoneNumberId,
        details: metaConfig,
      },
      twilio: {
        configured: !!twilioConfigured,
        details: {
          hasAccountSid: !!this.configService.get('TWILIO_ACCOUNT_SID'),
          hasAuthToken: !!this.configService.get('TWILIO_AUTH_TOKEN'),
          hasWhatsAppNumber: !!this.configService.get('TWILIO_WHATSAPP_NUMBER'),
          hasWebhookSecret: !!this.configService.get('TWILIO_WEBHOOK_SECRET'),
        },
      },
      dualProvider: this.getDualProviderConfig(),
    };
  }

  /**
   * Select the appropriate provider based on configuration and health
   */
  private selectProvider(
    preferredProvider?: WhatsAppProvider,
    operation: 'sending' | 'webhook' = 'sending'
  ): WhatsAppProvider {
    const config = this.getDualProviderConfig();

    // If a specific provider is requested, use it (if healthy)
    if (preferredProvider) {
      if (this.isProviderHealthy(preferredProvider)) {
        return preferredProvider;
      } else {
        this.logger.warn(`Preferred provider ${preferredProvider} is unhealthy, falling back to primary`);
      }
    }

    // Check feature flags for operation type
    if (operation === 'sending' && config.featureFlags.enableTwilioSending) {
      return this.isProviderHealthy('twilio') ? 'twilio' : config.primaryProvider;
    }

    if (operation === 'webhook' && config.featureFlags.enableTwilioWebhooks) {
      return 'twilio';
    }

    // Use primary provider if healthy, otherwise fallback
    if (this.isProviderHealthy(config.primaryProvider)) {
      return config.primaryProvider;
    }

    // Return the other provider if primary is unhealthy
    const fallbackProvider = config.primaryProvider === 'twilio' ? 'meta' : 'twilio';
    return this.isProviderHealthy(fallbackProvider) ? fallbackProvider : config.primaryProvider;
  }

  /**
   * Initialize periodic health checking
   */
  private initializeHealthChecking(): void {
    const config = this.getDualProviderConfig();
    
    // Perform initial health check
    this.performHealthCheck();

    // Set up periodic health checks
    setInterval(() => {
      this.performHealthCheck();
    }, config.healthCheckInterval);
  }

  /**
   * Perform health check on both providers
   */
  private async performHealthCheck(): Promise<void> {
    const now = new Date();
    
    // Skip if we've checked recently (within 1 minute)
    if (now.getTime() - this.lastHealthCheck.getTime() < 60000) {
      return;
    }

    this.logger.debug('Performing provider health checks');

    // Check Meta provider health (basic configuration check)
    try {
      const metaConfig = this.whatsappService.getWebhookConfig();
      this.providerHealth.meta = metaConfig.hasAccessToken && metaConfig.hasPhoneNumberId;
    } catch (error) {
      this.logger.warn('Meta provider health check failed:', error);
      this.providerHealth.meta = false;
    }

    // Check Twilio provider health
    try {
      const twilioHealth = await this.twilioService.checkHealth();
      this.providerHealth.twilio = twilioHealth.healthy;
    } catch (error) {
      this.logger.warn('Twilio provider health check failed:', error);
      this.providerHealth.twilio = false;
    }

    this.lastHealthCheck = now;
    
    this.logger.debug('Provider health status:', this.providerHealth);
  }

  /**
   * Convert Twilio webhook payload to Meta format for compatibility
   * This is a temporary solution until dedicated Twilio webhook processing is implemented
   */
  private convertTwilioToMetaFormat(twilioPayload: TwilioWebhookPayload): WebhookPayload {
    // Extract phone number from Twilio format (whatsapp:+1234567890)
    const fromNumber = twilioPayload.From?.replace('whatsapp:', '') || '';
    const toNumber = twilioPayload.To?.replace('whatsapp:', '') || '';

    // Create a Meta-compatible payload structure
    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: twilioPayload.AccountSid || '',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: toNumber,
                  phone_number_id: 'twilio-converted',
                },
                messages: [
                  {
                    id: twilioPayload.MessageSid || '',
                    from: fromNumber,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'text',
                    text: {
                      body: twilioPayload.Body || '',
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };
  }
}