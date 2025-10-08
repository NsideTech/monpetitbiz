export interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Contact[];
        messages?: Message[];
        statuses?: Status[];
      };
      field: string;
    }>;
  }>;
}

export interface Contact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface Message {
  id: string;
  from: string;
  timestamp: string;
  text?: {
    body: string;
  };
  type: 'text' | 'document' | 'image' | 'audio' | 'video';
  context?: {
    from: string;
    id: string;
  };
}

export interface Status {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin: {
      type: string;
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
}

export interface ProcessedMessage {
  messageId: string;
  from: string;
  body: string;
  timestamp: Date;
  businessId?: string;
  userId?: string;
}