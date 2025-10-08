import { IsString, IsArray, ValidateNested, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class WebhookVerificationDto {
  @IsString()
  'hub.mode': string;

  @IsString()
  'hub.challenge': string;

  @IsString()
  'hub.verify_token': string;
}

class MessageDto {
  @IsString()
  id: string;

  @IsString()
  from: string;

  @IsString()
  timestamp: string;

  @IsOptional()
  text?: {
    body: string;
  };

  @IsString()
  @IsIn(['text', 'document', 'image', 'audio', 'video'])
  type: 'text' | 'document' | 'image' | 'audio' | 'video';

  @IsOptional()
  context?: {
    from: string;
    id: string;
  };
}

class ContactDto {
  profile: {
    name: string;
  };

  @IsString()
  wa_id: string;
}

class StatusDto {
  @IsString()
  id: string;

  @IsString()
  @IsIn(['sent', 'delivered', 'read', 'failed'])
  status: 'sent' | 'delivered' | 'read' | 'failed';

  @IsString()
  timestamp: string;

  @IsString()
  recipient_id: string;

  @IsOptional()
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin: {
      type: string;
    };
  };

  @IsOptional()
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
}

class ValueDto {
  @IsString()
  messaging_product: string;

  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts?: ContactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages?: MessageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusDto)
  statuses?: StatusDto[];
}

class ChangeDto {
  @ValidateNested()
  @Type(() => ValueDto)
  value: ValueDto;

  @IsString()
  field: string;
}

class EntryDto {
  @IsString()
  id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangeDto)
  changes: ChangeDto[];
}

export class WebhookPayloadDto {
  @IsString()
  object: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntryDto)
  entry: EntryDto[];
}