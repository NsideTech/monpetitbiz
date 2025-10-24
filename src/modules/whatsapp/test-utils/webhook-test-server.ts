import { Injectable, Logger } from '@nestjs/common';
import { TwilioWebhookMock } from './twilio-webhook-mock';
import { TwilioWebhookPayloadDto } from '../dto/twilio-webhook.dto';

// Type alias for easier usage in tests
type TwilioWebhookPayload = TwilioWebhookPayloadDto;

/**
 * Test server for simulating Twilio webhook calls
 * Useful for local development and testing
 */
@Injectable()
export class WebhookTestServer {
  private readonly logger = new Logger(WebhookTestServer.name);

  /**
   * Send a test webhook to the specified endpoint
   */
  async sendTestWebhook(
    webhookUrl: string,
    payload: TwilioWebhookPayload,
    authToken?: string,
  ): Promise<{ success: boolean; response?: any; error?: string }> {
    try {
      const urlEncodedPayload = TwilioWebhookMock.toUrlEncoded(payload);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TwilioProxy/1.1',
      };

      // Add signature if auth token provided
      if (authToken) {
        const signature = TwilioWebhookMock.generateSignature(
          urlEncodedPayload,
          authToken,
          webhookUrl,
        );
        headers['X-Twilio-Signature'] = signature;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: urlEncodedPayload,
      });

      const responseText = await response.text();
      
      this.logger.log(`Webhook sent to ${webhookUrl}, status: ${response.status}`);
      
      return {
        success: response.ok,
        response: {
          status: response.status,
          statusText: response.statusText,
          body: responseText,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to send webhook: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a series of test messages to simulate a conversation
   */
  async simulateConversation(
    webhookUrl: string,
    messages: string[],
    phoneNumber: string = '+1234567890',
    authToken?: string,
  ): Promise<Array<{ message: string; success: boolean; response?: any; error?: string }>> {
    const results = [];

    for (const message of messages) {
      const payload = TwilioWebhookMock.incomingMessage({
        Body: message,
        From: `whatsapp:${phoneNumber}`,
      });

      const result = await this.sendTestWebhook(webhookUrl, payload, authToken);
      results.push({
        message,
        ...result,
      });

      // Small delay between messages to simulate real conversation
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Test registration flow
   */
  async testRegistrationFlow(
    webhookUrl: string,
    businessCode: string,
    employeeName: string,
    phoneNumber: string = '+1234567890',
    authToken?: string,
  ): Promise<Array<{ step: string; success: boolean; response?: any; error?: string }>> {
    const steps = [
      { step: 'start', payload: TwilioWebhookMock.registrationMessage('start', { From: `whatsapp:${phoneNumber}` }) },
      { step: 'business_code', payload: TwilioWebhookMock.registrationMessage('business_code', { Body: businessCode, From: `whatsapp:${phoneNumber}` }) },
      { step: 'employee_name', payload: TwilioWebhookMock.registrationMessage('employee_name', { Body: employeeName, From: `whatsapp:${phoneNumber}` }) },
    ];

    const results = [];

    for (const { step, payload } of steps) {
      const result = await this.sendTestWebhook(webhookUrl, payload, authToken);
      results.push({
        step,
        ...result,
      });

      // Delay between registration steps
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /**
   * Test business commands
   */
  async testBusinessCommands(
    webhookUrl: string,
    phoneNumber: string = '+1234567890',
    authToken?: string,
  ): Promise<Array<{ command: string; success: boolean; response?: any; error?: string }>> {
    const commands = [
      'help',
      'vente 100 produit test',
      'depense 50 transport',
      'stock produit test 10',
      'rapport',
      'status',
    ];

    const results = [];

    for (const command of commands) {
      const payload = TwilioWebhookMock.businessCommand(command, {
        From: `whatsapp:${phoneNumber}`,
      });

      const result = await this.sendTestWebhook(webhookUrl, payload, authToken);
      results.push({
        command,
        ...result,
      });

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  /**
   * Test error scenarios
   */
  async testErrorScenarios(
    webhookUrl: string,
    authToken?: string,
  ): Promise<Array<{ scenario: string; success: boolean; response?: any; error?: string }>> {
    const scenarios = [
      {
        scenario: 'invalid_payload',
        payload: TwilioWebhookMock.invalidPayload() as TwilioWebhookPayload,
      },
      {
        scenario: 'missing_signature',
        payload: TwilioWebhookMock.incomingMessage(),
        skipSignature: true,
      },
      {
        scenario: 'invalid_signature',
        payload: TwilioWebhookMock.incomingMessage(),
        invalidSignature: true,
      },
    ];

    const results = [];

    for (const { scenario, payload, skipSignature, invalidSignature } of scenarios) {
      let testAuthToken = authToken;
      
      if (skipSignature) {
        testAuthToken = undefined;
      } else if (invalidSignature) {
        testAuthToken = 'invalid_token';
      }

      const result = await this.sendTestWebhook(webhookUrl, payload, testAuthToken);
      results.push({
        scenario,
        ...result,
      });
    }

    return results;
  }
}