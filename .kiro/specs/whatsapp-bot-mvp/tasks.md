# Implementation Plan

- [x] 1. Set up project structure and core configuration
  - Create NestJS project with TypeScript configuration
  - Set up PostgreSQL database connection with TypeORM
  - Configure environment variables for WhatsApp API, database, and AWS
  - Create basic project structure (modules, services, controllers)
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 2. Implement database models and migrations
  - Create TypeORM entities for businesses, users, transactions, stock_items, otp_sessions
  - Write database migrations with proper indexes for performance
  - Set up database seeding for development and testing
  - _Requirements: 7.1, 7.2, 7.3, 1.1, 2.1, 3.1_

- [x] 2.1 Write unit tests for database models
  - Create unit tests for entity validation and relationships
  - Test database constraints and unique indexes
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 3. Create authentication and user management system
  - Implement OTP generation and SMS/WhatsApp sending service
  - Create user registration and verification endpoints
  - Build JWT token generation and validation middleware
  - Implement role-based permission checking (owner/seller)
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ]* 3.1 Write unit tests for authentication service
  - Test OTP generation, validation, and expiration
  - Test JWT token creation and validation
  - Test role-based permission checks
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 4. Build WhatsApp webhook handler and message processing
  - Create webhook endpoint to receive WhatsApp messages
  - Implement message validation and parsing
  - Build webhook signature verification for security
  - Create message queue system for processing incoming messages
  - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.1, 3.3, 4.1, 8.1_

- [x] 5. Implement natural language processing for commands
  - Create command parser with regex patterns for French
  - Build multilingual support with language detection
  - Implement amount and product extraction from natural language
  - Create fallback mechanisms for unrecognized commands
  - _Requirements: 1.1, 1.4, 2.1, 2.4, 8.1, 8.2, 8.3_

- [ ]* 5.1 Write unit tests for command parsing
  - Test regex patterns for different command variations
  - Test multilingual command recognition
  - Test amount and product extraction accuracy
  - _Requirements: 1.1, 1.4, 2.1, 2.4, 8.1, 8.2, 8.3_- [ ] 6. C
reate transaction management services
  - Build TransactionService for recording sales and expenses
  - Implement data validation and business rules
  - Create transaction history retrieval with filtering
  - Add currency handling and amount formatting
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [ ]* 6.1 Write unit tests for transaction service
  - Test transaction creation and validation
  - Test business rules and data integrity
  - Test transaction retrieval and filtering
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 7. Implement stock management system
  - Create StockService for product inventory tracking
  - Build stock update and retrieval functionality
  - Implement automatic stock decrement on sales
  - Add stock level validation and warnings
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ]* 7.1 Write unit tests for stock service
  - Test stock updates and quantity validation
  - Test automatic stock decrement on sales
  - Test stock retrieval and filtering
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8. Build reporting and balance calculation system
  - Create ReportService for generating financial summaries
  - Implement balance calculations (sales, expenses, profit)
  - Build period-based reporting (day, week, month)
  - Add top products and performance metrics
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 8.1 Write unit tests for reporting service
  - Test balance calculations and financial metrics
  - Test period-based report generation
  - Test performance metrics and top products calculation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 9. Create PDF report generation system
  - Set up PDF generation library (puppeteer or similar)
  - Design PDF template with business branding
  - Implement PDF generation service with S3 upload
  - Create PDF sharing via WhatsApp document message
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 9.1 Write unit tests for PDF generation
  - Test PDF template rendering with sample data
  - Test S3 upload and URL generation
  - Test error handling for PDF generation failures
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 10. Implement automated daily reporting system
  - Create cron job scheduler for daily reports at 8 PM
  - Build timezone-aware scheduling system
  - Implement automatic report generation and sending
  - Add handling for businesses with no activity
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 10.1 Write unit tests for automated reporting
  - Test cron job scheduling and execution
  - Test timezone handling for different businesses
  - Test report generation for inactive businesses
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 11. Build WhatsApp message sending service
  - Create WhatsApp API client for sending messages
  - Implement message formatting and localization
  - Build retry mechanism for failed message delivery
  - Add rate limiting to respect WhatsApp API limits
  - _Requirements: 1.3, 2.3, 4.5, 5.1, 8.1, 8.2, 10.1, 10.3_

- [ ]* 11.1 Write unit tests for WhatsApp messaging
  - Test message formatting and localization
  - Test retry mechanism and error handling
  - Test rate limiting functionality
  - _Requirements: 1.3, 2.3, 4.5, 5.1, 8.1, 8.2, 10.1, 10.3_

- [ ] 12. Create web dashboard frontend
  - Set up Next.js project with TypeScript and Tailwind CSS
  - Implement authentication pages with OTP verification
  - Build dashboard layout with navigation and responsive design
  - Create transaction list component with filtering and pagination
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 13. Implement dashboard data visualization
  - Create summary cards for daily/weekly/monthly totals
  - Build simple charts for sales and expense trends
  - Implement stock level display with low stock warnings
  - Add export functionality for transaction data
  - _Requirements: 9.1, 9.2_

- [ ]* 13.1 Write integration tests for dashboard
  - Test dashboard data loading and display
  - Test authentication flow and role-based access
  - Test responsive design on different screen sizes
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 14. Integrate all components and create main bot controller
  - Create main bot controller that orchestrates all services
  - Implement message routing based on command type
  - Add comprehensive error handling and user feedback
  - Create health check endpoints for monitoring
  - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.1, 3.3, 4.1, 4.5, 10.1, 10.2, 10.3_

- [ ]* 14.1 Write end-to-end integration tests
  - Test complete user workflows via WhatsApp simulation
  - Test error scenarios and recovery mechanisms
  - Test performance under concurrent user load
  - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.1, 3.3, 4.1, 4.5, 10.1, 10.2, 10.3_

- [ ] 15. Set up deployment and monitoring
  - Configure production environment variables and secrets
  - Set up database migrations for production deployment
  - Implement logging and error tracking with Sentry
  - Create monitoring dashboards for system health
  - _Requirements: 10.1, 10.2, 10.3_