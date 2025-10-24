import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Helper for ngrok integration during local development
 */
@Injectable()
export class NgrokHelper {
  private readonly logger = new Logger(NgrokHelper.name);
  private ngrokProcess: any;
  private publicUrl: string | null = null;

  /**
   * Start ngrok tunnel for local webhook testing
   */
  async startTunnel(port: number = 3000): Promise<string> {
    try {
      // Check if ngrok is installed
      await execAsync('which ngrok');
    } catch (error) {
      throw new Error('ngrok is not installed. Please install ngrok: https://ngrok.com/download');
    }

    try {
      // Start ngrok tunnel
      this.logger.log(`Starting ngrok tunnel on port ${port}...`);
      
      const { stdout } = await execAsync(`ngrok http ${port} --log=stdout --log-format=json`);
      
      // Parse ngrok output to get public URL
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('started tunnel')) {
          const match = line.match(/url=([^\s]+)/);
          if (match) {
            this.publicUrl = match[1];
            this.logger.log(`Ngrok tunnel started: ${this.publicUrl}`);
            return this.publicUrl;
          }
        }
      }

      throw new Error('Could not parse ngrok output');
    } catch (error) {
      this.logger.error(`Failed to start ngrok tunnel: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current public URL
   */
  getPublicUrl(): string | null {
    return this.publicUrl;
  }

  /**
   * Get webhook URL for Twilio configuration
   */
  getWebhookUrl(endpoint: string = '/whatsapp/twilio/webhook'): string | null {
    if (!this.publicUrl) {
      return null;
    }
    return `${this.publicUrl}${endpoint}`;
  }

  /**
   * Stop ngrok tunnel
   */
  async stopTunnel(): Promise<void> {
    if (this.ngrokProcess) {
      this.ngrokProcess.kill();
      this.ngrokProcess = null;
      this.publicUrl = null;
      this.logger.log('Ngrok tunnel stopped');
    }
  }

  /**
   * Get ngrok status and tunnels
   */
  async getStatus(): Promise<any> {
    try {
      const response = await fetch('http://localhost:4040/api/tunnels');
      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.warn('Could not get ngrok status. Make sure ngrok is running.');
      return null;
    }
  }

  /**
   * Display setup instructions
   */
  displaySetupInstructions(): void {
    console.log('\n=== Ngrok Setup Instructions ===');
    console.log('1. Install ngrok: https://ngrok.com/download');
    console.log('2. Sign up for a free account: https://ngrok.com/signup');
    console.log('3. Get your auth token: https://dashboard.ngrok.com/get-started/your-authtoken');
    console.log('4. Configure ngrok: ngrok config add-authtoken YOUR_TOKEN');
    console.log('5. Start your application and run the webhook test utilities');
    console.log('\n=== Usage ===');
    console.log('const ngrok = new NgrokHelper();');
    console.log('const publicUrl = await ngrok.startTunnel(3000);');
    console.log('console.log("Webhook URL:", ngrok.getWebhookUrl());');
    console.log('================================\n');
  }
}