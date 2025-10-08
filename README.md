# MonPetitBiz - WhatsApp Business Bot

A WhatsApp bot designed for micro-businesses in the informal sector in Africa to record business transactions, track inventory, and generate financial reports through natural language conversations.

## 🚀 Features

### Core Business Functions
- **📱 Natural Language Processing**: Record sales and expenses using everyday language in French and local languages
- **📊 Transaction Management**: Automatic recording of sales and expenses with validation
- **📦 Inventory Tracking**: Real-time stock management with low-stock alerts
- **📈 Financial Reports**: Generate daily, weekly, and monthly business reports
- **📄 PDF Generation**: Automated PDF report generation and delivery via WhatsApp
- **🔐 Authentication**: Secure OTP-based authentication system
- **👥 Role Management**: Owner and seller roles with appropriate permissions

### Technical Features
- **🔄 Message Queue**: Asynchronous message processing with retry mechanisms
- **🏥 Health Monitoring**: Comprehensive health checks and system monitoring
- **🌐 RESTful API**: Complete API for integration and testing
- **📱 Web Dashboard**: Read-only dashboard for business insights
- **🔒 Security**: JWT authentication with role-based access control

## 🛠 Tech Stack

- **Backend**: NestJS (Node.js + TypeScript)
- **Database**: PostgreSQL with TypeORM
- **File Storage**: AWS S3 (for PDF reports)
- **WhatsApp**: Meta Cloud API
- **Frontend**: Next.js (for dashboard)
- **Authentication**: JWT + OTP
- **Testing**: Jest with comprehensive test coverage
- **Documentation**: OpenAPI/Swagger

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 13+ ([Download](https://www.postgresql.org/download/))
- **npm** or **yarn** package manager
- **WhatsApp Business Account** ([Setup Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started))
- **AWS Account** (for S3 storage - optional for development)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd monpetitbiz

# Install dependencies
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env
```

Update `.env` with your configuration:

```env
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=monpetitbiz

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# WhatsApp Configuration
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_APP_SECRET=your_app_secret

# AWS Configuration (Optional for development)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name

# Application Configuration
PORT=3000
NODE_ENV=development
```

### 3. Database Setup

```bash
# Start PostgreSQL service
# On macOS with Homebrew:
brew services start postgresql

# On Ubuntu/Debian:
sudo systemctl start postgresql

# Create database
createdb monpetitbiz

# Run database migrations (optional - app uses synchronize in development)
npm run migration:run
```

**Note**: The application uses TypeORM's `synchronize: true` in development mode, which automatically creates tables based on your entities. You don't need to run migrations for development, but they're available for production deployments.

### 4. Start the Application

#### Quick Start (Recommended)
```bash
# Automated setup and start
npm run quick-start
```

#### Manual Start
```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The application will be available at:
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/api (Swagger UI)

### 5. Test the API

```bash
# Run the test suite
npm run test-api

# Or manually test with curl
curl http://localhost:3000/health
```

## 📱 How It Works

### User Flow

1. **Registration**: Users register by sending their business information
2. **Authentication**: OTP-based authentication via WhatsApp
3. **Business Operations**: Users interact with the bot using natural language
4. **Automated Reports**: Daily reports sent automatically at 8 PM

### Supported Commands

#### Sales Recording
```
vente 1000
vente pain 1500
j'ai vendu du pain à 2000
```

#### Expense Recording
```
dépense 500
dépense 500 marchandise
j'ai acheté du sucre à 1000
```

#### Stock Management
```
stock pain 50        # Update stock
stock pain          # Check stock for specific product
stock              # Check all stock
```

#### Reports
```
bilan jour         # Daily balance
bilan semaine      # Weekly balance
bilan mois         # Monthly balance
rapport PDF        # Generate PDF report
```

### Message Processing Flow

1. **Webhook Reception**: WhatsApp sends message to `/whatsapp/webhook`
2. **Message Parsing**: Extract and validate message content
3. **Queue Processing**: Add message to processing queue
4. **NLP Analysis**: Analyze message intent and extract data
5. **Authentication**: Verify user permissions
6. **Business Logic**: Execute appropriate business operation
7. **Response**: Send confirmation back to user

## 🔧 Development

### Available Scripts

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugging

# Building
npm run build             # Build for production
npm run start:prod        # Start production build

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Run tests with coverage
npm run test:e2e          # Run end-to-end tests

# Database
npm run migration:generate # Generate new migration
npm run migration:run      # Run pending migrations
npm run migration:revert   # Revert last migration

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format code with Prettier
```

### Testing the WhatsApp Integration

1. **Webhook Setup**: Configure your WhatsApp webhook URL to point to your server
2. **Ngrok for Local Development**:
   ```bash
   # Install ngrok
   npm install -g ngrok
   
   # Expose local server
   ngrok http 3000
   
   # Use the ngrok URL for WhatsApp webhook
   ```

3. **Test Messages**: Send test messages to your WhatsApp Business number

### API Testing

Use the provided OpenAPI specification to test the API endpoints:
- Import `openapi.yaml` into Postman or Insomnia
- Use the Swagger UI at http://localhost:3000/api
- Test health endpoints at http://localhost:3000/health

## 📁 Project Structure

```
src/
├── config/                    # Configuration files
├── modules/                   # Feature modules
│   ├── auth/                 # Authentication & user management
│   │   ├── entities/         # User, Business, OtpSession entities
│   │   ├── auth.service.ts   # Authentication logic
│   │   └── auth.controller.ts # Auth endpoints
│   ├── whatsapp/             # WhatsApp integration
│   │   ├── services/         # NLP, message parsing, queue
│   │   ├── bot.controller.ts # Main bot orchestration
│   │   ├── whatsapp.controller.ts # Webhook endpoints
│   │   └── health.controller.ts # Health monitoring
│   ├── transaction/          # Sales & expense tracking
│   │   ├── entities/         # Transaction entity
│   │   └── transaction.service.ts # Transaction logic
│   ├── stock/               # Inventory management
│   │   ├── entities/        # StockItem entity
│   │   └── stock.service.ts # Stock operations
│   ├── report/              # Report generation
│   │   ├── services/        # PDF generation
│   │   └── report.service.ts # Report logic
│   └── dashboard/           # Web dashboard API
└── main.ts                  # Application entry point
```

## 🔍 Monitoring & Health Checks

The application provides comprehensive monitoring endpoints:

### Health Endpoints

- **`GET /health`** - Complete system health check
- **`GET /health/ready`** - Kubernetes readiness probe
- **`GET /health/live`** - Kubernetes liveness probe
- **`GET /health/metrics`** - Detailed system metrics
- **`GET /whatsapp/health`** - WhatsApp-specific health check

### Example Health Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "components": {
    "bot": {
      "status": "healthy",
      "services": {
        "nlp": true,
        "auth": true,
        "transaction": true,
        "stock": true,
        "report": true,
        "whatsapp": true
      }
    },
    "whatsapp": {
      "status": "healthy",
      "config": {
        "hasAccessToken": true,
        "hasPhoneNumberId": true,
        "hasWebhookToken": true
      }
    },
    "queue": {
      "status": "healthy",
      "queueSize": 0,
      "processingCount": 0,
      "backlog": "normal"
    }
  }
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL is running
   pg_isready -h localhost -p 5432
   
   # Create the database if it doesn't exist
   createdb monpetitbiz
   
   # Verify database exists
   psql -l | grep monpetitbiz
   
   # Test connection
   psql -d monpetitbiz -c "SELECT version();"
   ```

2. **WhatsApp Webhook Not Receiving Messages**
   - Verify webhook URL is accessible from internet
   - Check WHATSAPP_WEBHOOK_VERIFY_TOKEN matches Meta configuration
   - Ensure webhook endpoint returns 200 status

3. **PDF Generation Fails**
   - Verify AWS credentials are configured
   - Check S3 bucket permissions
   - Ensure bucket exists and is accessible

4. **Message Processing Stuck**
   - Check queue status at `/whatsapp/health`
   - Review application logs for errors
   - Restart the application if needed

### Logs

```bash
# View application logs
npm run start:dev

# For production, use PM2 or similar
pm2 logs monpetitbiz
```

## 🚀 Deployment

### Docker Deployment

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://localhost:6379  # For production queue
```

## 📚 API Documentation

The complete API documentation is available at `/api` when the server is running. Key endpoints include:

- **Authentication**: `/auth/*`
- **WhatsApp Webhook**: `/whatsapp/webhook`
- **Health Checks**: `/health/*`
- **Dashboard API**: `/dashboard/*`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review the API documentation at `/api`