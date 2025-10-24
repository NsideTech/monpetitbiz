# Implementation Plan

- [x] 1. Set up Twilio SDK infrastructure and dependencies
  - Install Twilio Node.js SDK package and update package.json
  - Create Twilio configuration service with environment variable loading
  - Add Twilio-specific environment variables to .env.example
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2. Implement core Twilio WhatsApp service
  - [x] 2.1 Create TwilioWhatsAppService with SDK integration
    - Implement sendMessage method using Twilio SDK
    - Implement sendMedia method for PDF and document sending
    - Add phone number formatting to E.164 standard
    - _Requirements: 1.1, 2.1, 2.6, 7.1_

  - [x] 2.2 Implement Twilio error handling and retry logic
    - Create TwilioErrorHandler with error categorization
    - Implement exponential backoff retry mechanism
    - Add rate limiting detection and handling
    - _Requirements: 1.4, 5.1, 5.2, 5.5_

  - [ ]* 2.3 Write unit tests for TwilioWhatsAppService
    - Test message sending with mocked Twilio client
    - Test error handling scenarios
    - Test phone number formatting
    - _Requirements: 1.1, 2.1, 5.1_

- [x] 3. Create Twilio webhook processing system
  - [x] 3.1 Implement TwilioWebhookController
    - Create dedicated endpoint for Twilio webhooks
    - Implement webhook signature verification
    - Add payload validation and sanitization
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.2 Create TwilioMessageParser for direct payload processing
    - Parse Twilio webhook format without conversion
    - Extract phone numbers from Twilio format (whatsapp:+number)
    - Implement message deduplication using Twilio MessageSid
    - _Requirements: 3.1, 3.4_

  - [ ]* 3.3 Write unit tests for webhook processing
    - Test webhook payload parsing
    - Test signature verification
    - Test invalid payload handling
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Implement dual provider support for migration
  - [x] 4.1 Create DualProviderService for gradual migration
    - Implement provider selection logic with feature flags
    - Create unified interface for both Meta and Twilio providers
    - Add provider health checking and fallback logic
    - _Requirements: 6.1, 6.4_

  - [x] 4.2 Update existing WhatsappService to support provider switching
    - Modify sendMessage to route to appropriate provider
    - Update processWebhook to handle both webhook formats
    - Add configuration for provider selection
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 4.3 Write integration tests for dual provider functionality
    - Test provider switching scenarios
    - Test fallback behavior
    - Test configuration changes
    - _Requirements: 6.1, 6.4_

- [x] 5. Update message sending throughout the application
  - [x] 5.1 Replace Meta API calls in BotController
    - Update sendSuccessMessage to use Twilio service
    - Update sendErrorMessage to use Twilio service
    - Modify PDF document sending for reports
    - _Requirements: 2.1, 2.2, 2.3, 7.1_

  - [x] 5.2 Update ReportService for Twilio media sending
    - Modify generateAndSendPDFReport to use Twilio SDK
    - Update media URL handling for Twilio requirements
    - Add proper error handling for document sending failures
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.3 Update RegistrationHandlerService message sending
    - Replace Meta API calls with Twilio service
    - Update welcome message sending
    - Modify registration flow messaging
    - _Requirements: 2.4_

- [x] 6. Enhance error handling and monitoring
  - [x] 6.1 Implement comprehensive Twilio error logging
    - Add structured logging for all Twilio operations
    - Create error categorization and alerting
    - Implement correlation IDs for message tracking
    - _Requirements: 5.1, 5.3, 5.4_

  - [x] 6.2 Update health check endpoints
    - Add Twilio connectivity checks to health endpoint
    - Include Twilio service status in health responses
    - Add configuration validation checks
    - _Requirements: 5.4_

  - [ ]* 6.3 Write monitoring and alerting tests
    - Test error categorization logic
    - Test health check responses
    - Test logging functionality
    - _Requirements: 5.1, 5.4_

- [x] 7. Update configuration and environment management
  - [x] 7.1 Add Twilio environment variables and validation
    - Update ConfigService to load Twilio credentials
    - Add environment variable validation on startup
    - Create configuration documentation
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Update deployment scripts and documentation
    - Modify quick-start script to include Twilio setup
    - Update environment setup documentation
    - Add Twilio credential configuration guide
    - _Requirements: 4.5_

- [x] 8. Implement testing infrastructure
  - [x] 8.1 Create Twilio webhook testing utilities
    - Build test endpoint for webhook simulation
    - Create mock Twilio webhook payloads
    - Add ngrok integration for local testing
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 8.2 Add comprehensive integration tests
    - Test complete message flow with Twilio
    - Test business logic with Twilio webhooks
    - Test error scenarios and recovery
    - _Requirements: 8.3, 8.4_

  - [ ]* 8.3 Create performance and load tests
    - Test webhook processing under load
    - Test message sending throughput
    - Test concurrent webhook handling
    - _Requirements: 8.4_

- [x] 9. Migration validation and cleanup
  - [x] 9.1 Implement migration validation tools
    - Create comparison tools for Meta vs Twilio responses
    - Add migration status tracking
    - Implement rollback mechanisms
    - _Requirements: 6.1, 6.4_

  - [x] 9.2 Update all business logic to use Twilio by default
    - Switch default provider to Twilio in configuration
    - Update all service dependencies
    - Remove Meta API fallback logic
    - _Requirements: 6.2, 6.3_

  - [x] 9.3 Clean up legacy Meta API code and dependencies
    - Remove unused Meta API service methods
    - Clean up Meta-specific configuration
    - Update documentation to reflect Twilio usage
    - _Requirements: 6.5_

- [x] 10. Documentation and deployment preparation
  - [x] 10.1 Update API documentation
    - Update OpenAPI specs for Twilio webhooks
    - Document new environment variables
    - Create migration guide for existing deployments
    - _Requirements: 4.5_

  - [x] 10.2 Create deployment and monitoring guides
    - Document production deployment steps
    - Create troubleshooting guide for Twilio issues
    - Add monitoring and alerting setup instructions
    - _Requirements: 5.4_