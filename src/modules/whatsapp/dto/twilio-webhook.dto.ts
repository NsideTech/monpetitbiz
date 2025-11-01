import { IsString, IsOptional, IsIn, IsNumberString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TwilioWebhookPayloadDto {
  @ApiProperty({
    description: 'Unique identifier for the message',
    example: 'SM1234567890abcdef1234567890abcdef'
  })
  @IsString()
  MessageSid: string;

  @ApiProperty({
    description: 'Twilio Account SID',
    example: 'xxxxxxxxxxxxxxxxx'
  })
  @IsString()
  AccountSid: string;

  @ApiProperty({
    description: 'Messaging Service SID (optional)',
    example: 'MG1234567890abcdef1234567890abcdef',
    required: false
  })
  @IsOptional()
  @IsString()
  MessagingServiceSid?: string;

  @ApiProperty({
    description: 'Sender phone number in WhatsApp format',
    example: 'whatsapp:+226123456789'
  })
  @IsString()
  From: string;

  @ApiProperty({
    description: 'Recipient phone number in WhatsApp format',
    example: 'whatsapp:+14155238886'
  })
  @IsString()
  To: string;

  @ApiProperty({
    description: 'Message body text',
    example: 'vente pain 1500',
    required: false
  })
  @IsOptional()
  @IsString()
  Body?: string;

  @ApiProperty({
    description: 'Number of media attachments',
    example: '0'
  })
  @IsOptional()
  @IsNumberString()
  NumMedia?: string;

  @ApiProperty({
    description: 'WhatsApp profile name of sender',
    example: 'John Doe',
    required: false
  })
  @IsOptional()
  @IsString()
  ProfileName?: string;

  @ApiProperty({
    description: 'WhatsApp ID (phone number without + prefix)',
    example: '221123456789',
    required: false
  })
  @IsOptional()
  @IsString()
  WaId?: string;

  @ApiProperty({
    description: 'SMS Message SID (same as MessageSid for WhatsApp)',
    example: 'SM1234567890abcdef1234567890abcdef',
    required: false
  })
  @IsOptional()
  @IsString()
  SmsMessageSid?: string;

  @ApiProperty({
    description: 'Message status',
    example: 'received',
    enum: ['received', 'sent', 'delivered', 'failed', 'undelivered']
  })
  @IsString()
  @IsIn(['received', 'sent', 'delivered', 'failed', 'undelivered'])
  SmsStatus: 'received' | 'sent' | 'delivered' | 'failed' | 'undelivered';

  @ApiProperty({
    description: 'SMS SID (same as MessageSid for WhatsApp)',
    example: 'SM1234567890abcdef1234567890abcdef',
    required: false
  })
  @IsOptional()
  @IsString()
  SmsSid?: string;

  @ApiProperty({
    description: 'API Version used',
    example: '2010-04-01',
    required: false
  })
  @IsOptional()
  @IsString()
  ApiVersion?: string;

  // Media-related fields (for future media support)
  @ApiProperty({
    description: 'Media URL (for media messages)',
    required: false
  })
  @IsOptional()
  @IsString()
  MediaUrl0?: string;

  @ApiProperty({
    description: 'Media content type (for media messages)',
    required: false
  })
  @IsOptional()
  @IsString()
  MediaContentType0?: string;
}