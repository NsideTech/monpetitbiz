# Implementation Plan

- [x] 1. Enhance data models for business codes and employee information
  - Add businessCode field to Business entity with unique constraint
  - Add employeeName field to User entity for employee display names
  - Create database migration for new fields
  - _Requirements: 1.1, 1.2, 5.1_

- [-] 2. Implement conversation state management service
  - [x] 2.1 Create ConversationStateService with in-memory state storage
    - Implement state storage with automatic expiration (30 minutes)
    - Add methods for getting, setting, and clearing conversation state
    - Create type-safe registration state management methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.2 Write unit tests for conversation state management
    - Test state storage and retrieval functionality
    - Test automatic expiration and cleanup mechanisms
    - Test type-safe registration state methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 3. Enhance authentication service with business code functionality
  - [x] 3.1 Add business code generation method to AuthService
    - Implement secure 6-character alphanumeric code generation
    - Add uniqueness validation and collision handling
    - Exclude confusing characters (0/O, 1/I/L) from generation
    - _Requirements: 1.1, 1.2, 9.4_

  - [x] 3.2 Implement business owner registration method
    - Create registerBusinessOwner method that generates business code
    - Integrate business code into business creation process
    - Return business code in registration response
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Implement employee registration method
    - Create registerEmployee method with business code validation
    - Validate business code exists before creating employee user
    - Link employee to correct business using business code
    - Assign appropriate role and permissions
    - _Requirements: 4.1, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 3.4 Add business lookup by code method
    - Implement getBusinessByCode method for validation
    - Include business name and employee count in response
    - Handle non-existent business codes gracefully
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ]* 3.5 Write unit tests for enhanced auth service
    - Test business code generation and uniqueness
    - Test business owner registration flow
    - Test employee registration with valid/invalid codes
    - Test business lookup functionality
    - _Requirements: 1.1, 3.1, 4.1, 5.1_

- [x] 4. Create registration handler service for conversation orchestration
  - [x] 4.1 Implement core registration message handling
    - Create handleRegistrationMessage method for routing messages
    - Implement registration intent detection using NLP patterns
    - Add conversation flow routing based on user state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 Implement user type selection flow
    - Handle owner vs employee selection logic
    - Validate user responses and provide clear guidance
    - Update conversation state based on user choice
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.3 Implement business owner registration flow
    - Collect business name and owner name in sequence
    - Integrate with AuthService for business creation
    - Provide business code in completion message
    - Handle registration errors with user-friendly messages
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.4 Implement employee registration flow
    - Collect and validate business code format
    - Verify business code exists and show business name
    - Collect employee name and role selection
    - Complete employee registration with role assignment
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.5 Add comprehensive error handling and user guidance
    - Implement specific error messages for each failure scenario
    - Add input validation with helpful examples
    - Provide recovery suggestions for common errors
    - Handle system errors gracefully with retry options
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 4.6 Write unit tests for registration handler service
    - Test registration intent detection
    - Test user type selection handling
    - Test business owner and employee registration flows
    - Test error handling and recovery scenarios
    - _Requirements: 2.1, 3.1, 4.1, 5.1, 8.1_

- [x] 5. Update authentication controller with new registration endpoints
  - [x] 5.1 Add business owner registration endpoint
    - Create POST /auth/register-business-owner endpoint
    - Include business code in response for employee sharing
    - Add proper validation and error handling
    - _Requirements: 3.1, 3.4_

  - [x] 5.2 Add employee registration endpoint
    - Create POST /auth/register-employee endpoint
    - Validate business code and employee information
    - Return appropriate success message with permissions
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 5.3 Add business lookup endpoint for code validation
    - Create GET /auth/business/:code endpoint
    - Return business information for employee verification
    - Handle invalid codes with appropriate error responses
    - _Requirements: 4.3, 4.4, 4.5_

  - [ ]* 5.4 Write integration tests for new auth endpoints
    - Test business owner registration endpoint
    - Test employee registration endpoint
    - Test business lookup endpoint
    - Test error scenarios and validation
    - _Requirements: 3.1, 4.1, 5.1_

- [x] 6. Integrate registration system with WhatsApp bot controller
  - [x] 6.1 Update bot controller to use registration handler
    - Integrate RegistrationHandlerService into message processing
    - Route registration messages to registration handler
    - Handle registration completion and user authentication
    - _Requirements: 2.1, 6.1, 10.1_

  - [x] 6.2 Add registration flow detection to message parser
    - Update NLP service with registration intent patterns
    - Detect business codes, role selections, and registration keywords
    - Integrate conversation state checking into message routing
    - _Requirements: 2.5, 6.1, 10.2_

  - [x] 6.3 Implement role-based command filtering
    - Add permission checking before processing commands
    - Return appropriate error messages for unauthorized actions
    - Display user permissions clearly in help messages
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 6.4 Write integration tests for WhatsApp bot registration
    - Test complete registration flows via WhatsApp messages
    - Test conversation state persistence across messages
    - Test role-based command filtering
    - Test error handling and user guidance
    - _Requirements: 2.1, 6.1, 7.1, 10.1_

- [x] 7. Add user experience enhancements and visual feedback
  - [x] 7.1 Implement progress indicators for multi-step flows
    - Add step completion confirmations with emojis
    - Show remaining steps in registration process
    - Provide clear next action guidance
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 7.2 Add registration completion summaries
    - Create detailed completion messages with user information
    - Include business code sharing instructions for owners
    - Display permission summaries for employees
    - Provide examples of available commands
    - _Requirements: 10.4, 10.5_

  - [x] 7.3 Implement conversation timeout handling
    - Add automatic cleanup of expired conversation states
    - Send timeout notifications to users when appropriate
    - Allow users to restart registration after timeout
    - _Requirements: 6.3, 6.4_

- [x] 8. Create comprehensive documentation and examples
  - [x] 8.1 Document registration API endpoints
    - Create OpenAPI specifications for new endpoints
    - Add request/response examples for each endpoint
    - Document error codes and messages
    - _Requirements: 3.1, 4.1, 5.1_

  - [x] 8.2 Create user guide for business owners
    - Document how to share business codes with employees
    - Explain role differences and permissions
    - Provide troubleshooting guide for common issues
    - _Requirements: 1.4, 7.1, 8.1_

  - [x] 8.3 Create employee onboarding guide
    - Document registration process step-by-step
    - Explain how to get business code from employer
    - List available commands by role
    - _Requirements: 5.1, 7.1, 8.1_