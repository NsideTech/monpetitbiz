import { Controller, Post, Body, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhookTestServer, TwilioWebhookMock, NgrokHelper } from '../test-utils';
import { TwilioWebhookPayloadDto } from '../dto/twilio-webhook.dto';

// Type alias for easier usage
type TwilioWebhookPayload = TwilioWebhookPayloadDto;

@ApiTags('webhook-testing')
@Controller('webhook-test')
export class WebhookTestController {
  private readonly logger = new Logger(WebhookTestController.name);
  private readonly webhookTestServer = new WebhookTestServer();
  private readonly ngrokHelper = new NgrokHelper();

  @Get('status')
  @ApiOperation({ summary: 'Get webhook testing status' })
  @ApiResponse({ status: 200, description: 'Testing utilities status' })
  async getStatus() {
    const ngrokStatus = await this.ngrokHelper.getStatus();
    
    return {
      status: 'active',
      ngrok: {
        installed: ngrokStatus !== null,
        publicUrl: this.ngrokHelper.getPublicUrl(),
        webhookUrl: this.ngrokHelper.getWebhookUrl(),
        tunnels: ngrokStatus?.tunnels || [],
      },
      endpoints: {
        sendWebhook: '/webhook-test/send',
        simulateConversation: '/webhook-test/simulate-conversation',
        testRegistration: '/webhook-test/test-registration',
        testBusinessCommands: '/webhook-test/test-business-commands',
        testErrorScenarios: '/webhook-test/test-error-scenarios',
      },
    };
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a test webhook' })
  @ApiResponse({ status: 200, description: 'Webhook sent successfully' })
  async sendWebhook(@Body() body: {
    webhookUrl: string;
    payload?: Partial<TwilioWebhookPayloadDto>;
    authToken?: string;
  }) {
    const { webhookUrl, payload = {}, authToken } = body;
    
    const testPayload = TwilioWebhookMock.incomingMessage(payload);
    const result = await this.webhookTestServer.sendTestWebhook(
      webhookUrl,
      testPayload,
      authToken,
    );

    this.logger.log(`Test webhook sent to ${webhookUrl}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    
    return {
      success: result.success,
      payload: testPayload,
      response: result.response,
      error: result.error,
    };
  }

  @Post('simulate-conversation')
  @ApiOperation({ summary: 'Simulate a WhatsApp conversation' })
  @ApiResponse({ status: 200, description: 'Conversation simulated successfully' })
  async simulateConversation(@Body() body: {
    webhookUrl: string;
    messages: string[];
    phoneNumber?: string;
    authToken?: string;
  }) {
    const { webhookUrl, messages, phoneNumber, authToken } = body;
    
    const results = await this.webhookTestServer.simulateConversation(
      webhookUrl,
      messages,
      phoneNumber,
      authToken,
    );

    this.logger.log(`Simulated conversation with ${messages.length} messages`);
    
    return {
      totalMessages: messages.length,
      successCount: results.filter(r => r.success).length,
      results,
    };
  }

  @Post('test-registration')
  @ApiOperation({ summary: 'Test employee registration flow' })
  @ApiResponse({ status: 200, description: 'Registration flow tested successfully' })
  async testRegistration(@Body() body: {
    webhookUrl: string;
    businessCode: string;
    employeeName: string;
    phoneNumber?: string;
    authToken?: string;
  }) {
    const { webhookUrl, businessCode, employeeName, phoneNumber, authToken } = body;
    
    const results = await this.webhookTestServer.testRegistrationFlow(
      webhookUrl,
      businessCode,
      employeeName,
      phoneNumber,
      authToken,
    );

    this.logger.log(`Tested registration flow for ${employeeName}`);
    
    return {
      businessCode,
      employeeName,
      phoneNumber,
      successCount: results.filter(r => r.success).length,
      results,
    };
  }

  @Post('test-business-commands')
  @ApiOperation({ summary: 'Test business commands' })
  @ApiResponse({ status: 200, description: 'Business commands tested successfully' })
  async testBusinessCommands(@Body() body: {
    webhookUrl: string;
    phoneNumber?: string;
    authToken?: string;
  }) {
    const { webhookUrl, phoneNumber, authToken } = body;
    
    const results = await this.webhookTestServer.testBusinessCommands(
      webhookUrl,
      phoneNumber,
      authToken,
    );

    this.logger.log(`Tested business commands`);
    
    return {
      phoneNumber,
      commandCount: results.length,
      successCount: results.filter(r => r.success).length,
      results,
    };
  }

  @Post('test-error-scenarios')
  @ApiOperation({ summary: 'Test error handling scenarios' })
  @ApiResponse({ status: 200, description: 'Error scenarios tested successfully' })
  async testErrorScenarios(@Body() body: {
    webhookUrl: string;
    authToken?: string;
  }) {
    const { webhookUrl, authToken } = body;
    
    const results = await this.webhookTestServer.testErrorScenarios(
      webhookUrl,
      authToken,
    );

    this.logger.log(`Tested error scenarios`);
    
    return {
      scenarioCount: results.length,
      results,
    };
  }

  @Get('mock-payloads')
  @ApiOperation({ summary: 'Get sample mock payloads' })
  @ApiResponse({ status: 200, description: 'Sample payloads returned' })
  getMockPayloads() {
    return {
      incomingMessage: TwilioWebhookMock.incomingMessage(),
      incomingMediaMessage: TwilioWebhookMock.incomingMediaMessage(),
      deliveryStatusSent: TwilioWebhookMock.deliveryStatus('sent'),
      deliveryStatusDelivered: TwilioWebhookMock.deliveryStatus('delivered'),
      deliveryStatusFailed: TwilioWebhookMock.deliveryStatus('failed'),
      businessCommand: TwilioWebhookMock.businessCommand('help'),
      registrationStart: TwilioWebhookMock.registrationMessage('start'),
      invalidPayload: TwilioWebhookMock.invalidPayload(),
    };
  }

  @Get('ngrok-setup')
  @ApiOperation({ summary: 'Get ngrok setup instructions' })
  @ApiResponse({ status: 200, description: 'Setup instructions returned' })
  getNgrokSetup() {
    return {
      instructions: [
        '1. Install ngrok: https://ngrok.com/download',
        '2. Sign up for a free account: https://ngrok.com/signup',
        '3. Get your auth token: https://dashboard.ngrok.com/get-started/your-authtoken',
        '4. Configure ngrok: ngrok config add-authtoken YOUR_TOKEN',
        '5. Start your application and use the webhook test utilities',
      ],
      usage: {
        startTunnel: 'POST /webhook-test/start-ngrok with { "port": 3000 }',
        getStatus: 'GET /webhook-test/status',
        stopTunnel: 'POST /webhook-test/stop-ngrok',
      },
      localDashboard: 'http://localhost:4040',
    };
  }

  @Post('start-ngrok')
  @ApiOperation({ summary: 'Start ngrok tunnel' })
  @ApiResponse({ status: 200, description: 'Ngrok tunnel started' })
  async startNgrok(@Body() body: { port?: number }) {
    const { port = 3000 } = body;
    
    try {
      const publicUrl = await this.ngrokHelper.startTunnel(port);
      const webhookUrl = this.ngrokHelper.getWebhookUrl();
      
      return {
        success: true,
        publicUrl,
        webhookUrl,
        port,
        dashboard: 'http://localhost:4040',
        message: `Ngrok tunnel started. Use ${webhookUrl} as your Twilio webhook URL.`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        instructions: 'Please install ngrok: https://ngrok.com/download',
      };
    }
  }

  @Post('stop-ngrok')
  @ApiOperation({ summary: 'Stop ngrok tunnel' })
  @ApiResponse({ status: 200, description: 'Ngrok tunnel stopped' })
  async stopNgrok() {
    await this.ngrokHelper.stopTunnel();
    
    return {
      success: true,
      message: 'Ngrok tunnel stopped',
    };
  }
}