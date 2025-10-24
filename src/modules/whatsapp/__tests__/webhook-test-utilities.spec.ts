import { Test, TestingModule } from '@nestjs/testing';
import { TwilioWebhookMock } from '../test-utils/twilio-webhook-mock';
import { WebhookTestServer } from '../test-utils/webhook-test-server';
import { NgrokHelper } from '../test-utils/ngrok-helper';

describe('Webhook Test Utilities', () => {
  let webhookTestServer: WebhookTestServer;
  let ngrokHelper: NgrokHelper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookTestServer, NgrokHelper],
    }).compile();

    webhookTestServer = module.get<WebhookTestServer>(WebhookTestServer);
    ngrokHelper = module.get<NgrokHelper>(NgrokHelper);
  });

  describe('TwilioWebhookMock', () => {
    it('should generate valid incoming message payload', () => {
      const payload = TwilioWebhookMock.incomingMessage();

      expect(payload).toHaveProperty('MessageSid');
      expect(payload).toHaveProperty('AccountSid');
      expect(payload).toHaveProperty('From');
      expect(payload).toHaveProperty('To');
      expect(payload).toHaveProperty('Body');
      expect(payload).toHaveProperty('SmsStatus', 'received');
      expect(payload.MessageSid).toMatch(/^SM[a-z0-9]+$/);
      expect(payload.From).toMatch(/^whatsapp:\+\d+$/);
    });

    it('should generate media message payload', () => {
      const payload = TwilioWebhookMock.incomingMediaMessage();

      expect(payload).toHaveProperty('NumMedia', '1');
      expect(payload).toHaveProperty('MediaUrl0');
      expect(payload).toHaveProperty('MediaContentType0');
      expect(payload.MediaContentType0).toBe('image/jpeg');
    });

    it('should generate delivery status payloads', () => {
      const statuses = ['sent', 'delivered', 'failed', 'undelivered'] as const;

      statuses.forEach(status => {
        const payload = TwilioWebhookMock.deliveryStatus(status);
        expect(payload).toHaveProperty('SmsStatus', status);
      });
    });

    it('should generate business command payloads', () => {
      const commands = ['help', 'vente 100 produit', 'depense 50 transport', 'rapport'];

      commands.forEach(command => {
        const payload = TwilioWebhookMock.businessCommand(command);
        expect(payload).toHaveProperty('Body', command);
        expect(payload).toHaveProperty('ProfileName', 'Business User');
      });
    });

    it('should generate registration flow payloads', () => {
      const steps = ['start', 'business_code', 'employee_name'] as const;

      steps.forEach(step => {
        const payload = TwilioWebhookMock.registrationMessage(step);
        expect(payload).toHaveProperty('Body');
        expect(payload).toHaveProperty('ProfileName', 'New Employee');
      });
    });

    it('should generate invalid payload for error testing', () => {
      const payload = TwilioWebhookMock.invalidPayload();

      expect(payload).toHaveProperty('MessageSid', 'INVALID_SID');
      expect(payload).toHaveProperty('Body');
      expect(payload).not.toHaveProperty('From');
      expect(payload).not.toHaveProperty('To');
    });

    it('should generate webhook signatures', () => {
      const payload = 'Body=Hello&From=whatsapp%3A%2B1234567890';
      const authToken = 'test_auth_token';
      const url = 'https://example.com/webhook';

      const signature = TwilioWebhookMock.generateSignature(payload, authToken, url);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should convert payload to URL-encoded string', () => {
      const payload = TwilioWebhookMock.incomingMessage({
        Body: 'Hello World',
        From: 'whatsapp:+1234567890',
      });

      const urlEncoded = TwilioWebhookMock.toUrlEncoded(payload);

      expect(urlEncoded).toContain('Body=Hello%20World');
      expect(urlEncoded).toContain('From=whatsapp%3A%2B1234567890');
      expect(urlEncoded).toContain('&');
    });

    it('should handle special characters in URL encoding', () => {
      const payload = TwilioWebhookMock.incomingMessage({
        Body: 'Test with special chars: @#$%^&*()',
      });

      const urlEncoded = TwilioWebhookMock.toUrlEncoded(payload);

      expect(urlEncoded).toContain('Body=Test%20with%20special%20chars%3A%20%40%23%24%25%5E%26*()');
    });
  });

  describe('WebhookTestServer', () => {
    it('should be instantiated correctly', () => {
      expect(webhookTestServer).toBeDefined();
      expect(webhookTestServer.sendTestWebhook).toBeDefined();
      expect(webhookTestServer.simulateConversation).toBeDefined();
      expect(webhookTestServer.testRegistrationFlow).toBeDefined();
      expect(webhookTestServer.testBusinessCommands).toBeDefined();
      expect(webhookTestServer.testErrorScenarios).toBeDefined();
    });

    it('should handle webhook URL validation', async () => {
      const invalidUrl = 'not-a-url';
      const payload = TwilioWebhookMock.incomingMessage();

      const result = await webhookTestServer.sendTestWebhook(invalidUrl, payload);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should prepare conversation simulation data', async () => {
      const messages = ['hello', 'help', 'vente 100 test'];
      const webhookUrl = 'http://localhost:3000/test';

      // Mock fetch to avoid actual HTTP calls in tests
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('<Response></Response>'),
      });

      const results = await webhookTestServer.simulateConversation(
        webhookUrl,
        messages,
        '+1234567890',
      );

      expect(results).toHaveLength(messages.length);
      results.forEach((result, index) => {
        expect(result.message).toBe(messages[index]);
        expect(result.success).toBe(true);
      });

      global.fetch = originalFetch;
    });

    it('should prepare registration flow test data', async () => {
      const webhookUrl = 'http://localhost:3000/test';
      const businessCode = 'ABC123';
      const employeeName = 'John Doe';

      // Mock fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('<Response></Response>'),
      });

      const results = await webhookTestServer.testRegistrationFlow(
        webhookUrl,
        businessCode,
        employeeName,
      );

      expect(results).toHaveLength(3); // start, business_code, employee_name
      expect(results[0].step).toBe('start');
      expect(results[1].step).toBe('business_code');
      expect(results[2].step).toBe('employee_name');

      global.fetch = originalFetch;
    });

    it('should prepare business commands test data', async () => {
      const webhookUrl = 'http://localhost:3000/test';

      // Mock fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('<Response></Response>'),
      });

      const results = await webhookTestServer.testBusinessCommands(webhookUrl);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('command');
      expect(results[0]).toHaveProperty('success');

      global.fetch = originalFetch;
    });

    it('should prepare error scenarios test data', async () => {
      const webhookUrl = 'http://localhost:3000/test';

      // Mock fetch to simulate different error responses
      const originalFetch = global.fetch;
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: () => Promise.resolve('Invalid payload'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: () => Promise.resolve('Invalid signature'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: () => Promise.resolve('Invalid signature'),
        });

      const results = await webhookTestServer.testErrorScenarios(webhookUrl, 'test_token');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('scenario');
      expect(results[0]).toHaveProperty('success');

      global.fetch = originalFetch;
    });
  });

  describe('NgrokHelper', () => {
    it('should be instantiated correctly', () => {
      expect(ngrokHelper).toBeDefined();
      expect(ngrokHelper.getPublicUrl).toBeDefined();
      expect(ngrokHelper.getWebhookUrl).toBeDefined();
      expect(ngrokHelper.displaySetupInstructions).toBeDefined();
    });

    it('should return null for public URL when not started', () => {
      const publicUrl = ngrokHelper.getPublicUrl();
      expect(publicUrl).toBeNull();
    });

    it('should return null for webhook URL when not started', () => {
      const webhookUrl = ngrokHelper.getWebhookUrl();
      expect(webhookUrl).toBeNull();
    });

    it('should generate correct webhook URL when public URL is set', () => {
      // Simulate setting public URL
      (ngrokHelper as any).publicUrl = 'https://abc123.ngrok.io';

      const webhookUrl = ngrokHelper.getWebhookUrl();
      expect(webhookUrl).toBe('https://abc123.ngrok.io/whatsapp/twilio/webhook');

      const customWebhookUrl = ngrokHelper.getWebhookUrl('/custom/webhook');
      expect(customWebhookUrl).toBe('https://abc123.ngrok.io/custom/webhook');
    });

    it('should display setup instructions without errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      ngrokHelper.displaySetupInstructions();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Ngrok Setup Instructions'));

      consoleSpy.mockRestore();
    });

    it('should handle ngrok status check gracefully', async () => {
      // Mock fetch to simulate ngrok not running
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const status = await ngrokHelper.getStatus();
      expect(status).toBeNull();

      global.fetch = originalFetch;
    });

    it('should handle ngrok status when running', async () => {
      // Mock fetch to simulate ngrok running
      const originalFetch = global.fetch;
      const mockTunnels = {
        tunnels: [
          {
            name: 'command_line',
            uri: '/api/tunnels/command_line',
            public_url: 'https://abc123.ngrok.io',
            proto: 'https',
            config: {
              addr: 'localhost:3000',
              inspect: true,
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTunnels),
      });

      const status = await ngrokHelper.getStatus();
      expect(status).toEqual(mockTunnels);

      global.fetch = originalFetch;
    });
  });

  describe('Integration between utilities', () => {
    it('should work together for complete testing workflow', () => {
      // Generate a mock payload
      const payload = TwilioWebhookMock.incomingMessage({
        Body: 'integration test',
      });

      // Convert to URL-encoded format
      const urlEncoded = TwilioWebhookMock.toUrlEncoded(payload);

      // Generate signature
      const signature = TwilioWebhookMock.generateSignature(
        urlEncoded,
        'test_token',
        'https://example.com/webhook',
      );

      expect(payload).toHaveProperty('Body', 'integration test');
      expect(urlEncoded).toContain('Body=integration%20test');
      expect(signature).toBeTruthy();
    });

    it('should support end-to-end testing scenarios', async () => {
      // This test demonstrates how all utilities work together
      const testScenarios = [
        {
          name: 'Basic message',
          payload: TwilioWebhookMock.incomingMessage({ Body: 'hello' }),
        },
        {
          name: 'Business command',
          payload: TwilioWebhookMock.businessCommand('vente 100 test'),
        },
        {
          name: 'Registration start',
          payload: TwilioWebhookMock.registrationMessage('start'),
        },
        {
          name: 'Media message',
          payload: TwilioWebhookMock.incomingMediaMessage(),
        },
      ];

      testScenarios.forEach(scenario => {
        expect(scenario.payload).toHaveProperty('MessageSid');
        expect(scenario.payload).toHaveProperty('Body');
        
        const urlEncoded = TwilioWebhookMock.toUrlEncoded(scenario.payload);
        expect(urlEncoded).toContain('MessageSid=');
        expect(urlEncoded).toContain('Body=');
      });
    });
  });
});