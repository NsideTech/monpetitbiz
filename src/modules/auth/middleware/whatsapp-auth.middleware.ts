import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class WhatsAppAuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Skip verification for GET requests (webhook verification)
    if (req.method === 'GET') {
      return next();
    }

    const signature = req.headers['x-hub-signature-256'] as string;
    const webhookSecret = this.configService.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (!signature || !webhookSecret) {
      throw new UnauthorizedException('Missing webhook signature or secret');
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const signatureHash = signature.replace('sha256=', '');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signatureHash))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    next();
  }
}