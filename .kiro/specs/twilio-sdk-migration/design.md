# Design Document

## Overview

This design outlines the migration from Meta's WhatsApp Cloud API to Twilio's Programmable Messaging SDK. The migration will replace direct HTTP calls with Twilio's official Node.js SDK, improve error handling, and streamline webhook processing while maintaining all existing business functionality.

The design follows a phased approach to minimize disruption and ensure reliability throughout the migration process.

## Architecture

### Current Architecture
```
User WhatsApp Message → Meta Webhook → Format Conversion → Business Logic → Meta Graph API → WhatsApp Response
```

### Target Architecture
```
User WhatsApp Message → Twilio Webhook → Direct Processing → Business Logic → Twilio SDK → WhatsApp Response
```

### Key Architectural Changes

1. **SDK Integration**: Replace HTTP fetch calls with Twilio SDK methods
2. **Webhook Simplification**: Process Twilio webhooks directly without format conversion
3. **Configuration Centralization**: Unified Twilio configuration management
4. **Error Handling Enhancement**: Leverage Twilio's built-in error handling and retry mechanisms

## Components and Interfaces

### 1. Twilio Service Layer

#### TwilioWhatsAppService
Primary service for Twilio SDK integration:

```typescript
interface TwilioWhatsAppService {
  sendMessage(to: string, message: string): Promise<MessageInstance>
  sendMedia(to: string, mediaUrl: string, caption?: string): Promise<MessageInstance>
  validateWebhookSignature(payload: string, signature: string): boolean
  getMessageStatus(messageSid: string): Promise<MessageInstance>
}
```

#### TwilioConfigService
Configuration management for Twilio credentials:

```typescript
interface TwilioConfig {
  accountSid: string
  authToken: string
  whatsappNumber: string
  webhookSecret?: string
  environment: 'sandbox' | 'production'
}
```### 2. 
Webhook Processing Layer

#### TwilioWebhookController
Dedicated controller for Twilio webhook processing:

```typescript
interface TwilioWebhookPayload {
  MessageSid: string
  AccountSid: string
  From: string  // whatsapp:+1234567890
  To: string    // whatsapp:+0987654321
  Body: string
  ProfileName?: string
  WaId: string
  SmsStatus: 'received' | 'sent' | 'delivered' | 'failed'
}
```

#### TwilioMessageParser
Direct parsing of Twilio webhook format:

```typescript
interface TwilioMessageParser {
  parseWebhookPayload(payload: TwilioWebhookPayload): ProcessedMessage
  validatePayload(payload: TwilioWebhookPayload): boolean
  extractPhoneNumber(twilioFormat: string): string
}
```

### 3. Enhanced Error Handling

#### TwilioErrorHandler
Comprehensive error handling for Twilio operations:

```typescript
interface TwilioError {
  code: number
  message: string
  moreInfo: string
  status: number
  details?: any
}

interface ErrorHandlingStrategy {
  handleRateLimitError(error: TwilioError): Promise<void>
  handleAuthenticationError(error: TwilioError): void
  handleValidationError(error: TwilioError): void
  shouldRetry(error: TwilioError): boolean
}
```

### 4. Migration Support Layer

#### DualProviderService
Temporary service to support both Meta and Twilio during migration:

```typescript
interface DualProviderService {
  sendMessage(to: string, message: string, provider?: 'meta' | 'twilio'): Promise<any>
  processWebhook(payload: any, source: 'meta' | 'twilio'): Promise<any>
  getProviderHealth(): { meta: boolean, twilio: boolean }
}
```

## Data Models

### Enhanced ProcessedMessage
Extended to support Twilio-specific fields:

```typescript
interface ProcessedMessage {
  messageId: string        // Twilio MessageSid
  from: string            // E.164 format phone number
  body: string
  timestamp: Date
  provider: 'twilio' | 'meta'
  twilioData?: {
    accountSid: string
    messagingServiceSid?: string
    profileName?: string
    waId: string
    smsStatus: string
  }
}
```

### TwilioMessageStatus
Track message delivery status:

```typescript
interface TwilioMessageStatus {
  messageSid: string
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered'
  errorCode?: number
  errorMessage?: string
  dateCreated: Date
  dateUpdated: Date
}
```

### Configuration Schema
Environment variables for Twilio integration:

```typescript
interface TwilioEnvironmentConfig {
  TWILIO_ACCOUNT_SID: string
  TWILIO_AUTH_TOKEN: string
  TWILIO_WHATSAPP_NUMBER: string
  TWILIO_WEBHOOK_SECRET?: string
  TWILIO_ENVIRONMENT?: 'sandbox' | 'production'
  TWILIO_RETRY_ATTEMPTS?: number
  TWILIO_TIMEOUT?: number
}
```

## Error Handling

### Error Categories and Strategies

#### 1. Authentication Errors (20003, 20004)
- **Strategy**: Fail fast, log critical error, notify administrators
- **Recovery**: Validate credentials, check account status
- **User Impact**: Service unavailable message

#### 2. Rate Limiting Errors (20429)
- **Strategy**: Exponential backoff with jitter
- **Recovery**: Queue messages, retry with increasing delays
- **User Impact**: Delayed message delivery notification

#### 3. Validation Errors (21211, 21614)
- **Strategy**: Log error, validate input format, provide user feedback
- **Recovery**: Format correction, alternative delivery methods
- **User Impact**: Clear error message with correction guidance

#### 4. Network/Timeout Errors
- **Strategy**: Retry with circuit breaker pattern
- **Recovery**: Fallback to alternative endpoints, queue for later
- **User Impact**: Retry notification, eventual consistency

### Retry Logic Implementation

```typescript
interface RetryConfig {
  maxAttempts: 3
  baseDelay: 1000  // ms
  maxDelay: 30000  // ms
  backoffMultiplier: 2
  jitterRange: 0.1
}
```

### Error Monitoring and Alerting

1. **Critical Errors**: Immediate notification (authentication, service down)
2. **Warning Errors**: Aggregated alerts (rate limits, validation issues)
3. **Info Errors**: Logged for analysis (temporary network issues)

## Testing Strategy

### Unit Testing
- **TwilioWhatsAppService**: Mock Twilio client, test all methods
- **TwilioMessageParser**: Test payload parsing and validation
- **TwilioErrorHandler**: Test error categorization and retry logic
- **Configuration**: Test environment variable loading and validation

### Integration Testing
- **Webhook Processing**: Test end-to-end webhook flow with Twilio format
- **Message Sending**: Test actual message delivery using Twilio test credentials
- **Error Scenarios**: Test various Twilio error responses
- **Dual Provider**: Test migration scenarios with both providers

### End-to-End Testing
- **Business Workflows**: Test complete user journeys (registration, sales, reports)
- **Webhook Reliability**: Test webhook processing under load
- **Failover Scenarios**: Test behavior when Twilio service is unavailable
- **Performance**: Test message throughput and response times

### Test Environment Setup
- **Twilio Sandbox**: Use test credentials for development
- **Webhook Testing**: ngrok for local webhook testing
- **Mock Services**: Mock Twilio responses for unit tests
- **Test Data**: Sanitized production data for realistic testing

## Migration Strategy

### Phase 1: Infrastructure Setup
1. Install Twilio SDK dependency
2. Create Twilio service layer
3. Add configuration management
4. Set up test environment

### Phase 2: Dual Provider Implementation
1. Implement TwilioWhatsAppService alongside existing Meta service
2. Create DualProviderService for gradual migration
3. Add feature flags for provider selection
4. Implement comprehensive logging for comparison

### Phase 3: Webhook Migration
1. Create dedicated Twilio webhook endpoint
2. Implement direct Twilio payload processing
3. Add webhook signature verification
4. Test webhook processing in parallel with Meta webhooks

### Phase 4: Message Sending Migration
1. Replace Meta API calls with Twilio SDK calls
2. Update error handling to use Twilio error types
3. Implement Twilio-specific retry logic
4. Test all message sending scenarios

### Phase 5: Validation and Cleanup
1. Comprehensive testing of all functionality
2. Performance comparison between providers
3. Remove Meta API dependencies
4. Clean up legacy code and configurations

### Rollback Strategy
- **Feature Flags**: Quick switch back to Meta API if issues arise
- **Dual Provider**: Maintain both providers during transition
- **Configuration**: Easy switching between provider configurations
- **Monitoring**: Real-time health checks for immediate issue detection

## Security Considerations

### Webhook Security
- **Signature Verification**: Validate all incoming Twilio webhooks
- **IP Whitelisting**: Restrict webhook endpoints to Twilio IPs
- **Rate Limiting**: Prevent webhook abuse and DoS attacks
- **Input Validation**: Sanitize all webhook payload data

### Credential Management
- **Environment Variables**: Store sensitive credentials securely
- **Rotation**: Support for credential rotation without downtime
- **Encryption**: Encrypt credentials at rest if stored in database
- **Access Control**: Limit access to Twilio credentials

### Data Privacy
- **Message Logging**: Implement privacy-compliant logging
- **Data Retention**: Follow data retention policies for message data
- **Encryption**: Encrypt sensitive data in transit and at rest
- **Compliance**: Ensure GDPR/privacy regulation compliance

## Performance Considerations

### Message Throughput
- **Concurrent Processing**: Handle multiple webhook requests simultaneously
- **Queue Management**: Implement message queuing for high-volume scenarios
- **Connection Pooling**: Optimize HTTP connections to Twilio API
- **Caching**: Cache frequently accessed data (user contexts, configurations)

### Response Times
- **Webhook Processing**: Target <200ms webhook response time
- **Message Sending**: Target <1s for message delivery initiation
- **Error Handling**: Fast failure detection and recovery
- **Database Queries**: Optimize queries for user lookup and message storage

### Resource Usage
- **Memory Management**: Efficient handling of webhook payloads
- **CPU Usage**: Optimize message parsing and processing
- **Network Usage**: Minimize API calls through batching where possible
- **Storage**: Efficient message and status storage

## Monitoring and Observability

### Metrics to Track
- **Message Success Rate**: Percentage of successfully sent messages
- **Webhook Processing Time**: Average time to process webhooks
- **Error Rates**: Categorized error rates by type and severity
- **API Response Times**: Twilio API call performance
- **Queue Depth**: Message queue size and processing lag

### Logging Strategy
- **Structured Logging**: JSON format for easy parsing and analysis
- **Correlation IDs**: Track messages through entire processing pipeline
- **Error Context**: Detailed error information for debugging
- **Performance Logs**: Timing information for optimization

### Alerting Rules
- **High Error Rate**: >5% error rate in 5-minute window
- **API Failures**: Consecutive Twilio API failures
- **Webhook Delays**: Webhook processing time >1 second
- **Queue Backup**: Message queue depth >100 messages

### Health Checks
- **Twilio Connectivity**: Regular API connectivity tests
- **Webhook Endpoint**: Synthetic webhook tests
- **Configuration**: Validate all required environment variables
- **Dependencies**: Check database and external service health

This design provides a comprehensive approach to migrating from Meta's WhatsApp API to Twilio's SDK while maintaining reliability, performance, and all existing business functionality.