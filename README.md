# MonPetitBiz - WhatsApp Business Bot

A WhatsApp bot designed for micro-businesses in the informal sector in Africa to record business transactions, track inventory, and generate financial reports through natural language conversations.

## ✨ Recent Updates (NEW!)

### Enhanced Price & Sales Management
- **💰 Simple Price Setting**: Set product prices with `prix pain 300` - one command!
- **🚀 Auto-Calculation**: `vente 10 pain` automatically calculates total (no more math!)
- **🔤 Plural Support**: Works with both `pain` and `pains`, `eau` and `eaux` - natural language!
- **📊 Transaction Lists**: View detailed lists showing exactly what was sold and when
- **💵 Stock Value Tracking**: See the total value of your inventory at a glance

### Why These Matter
- **Faster Sales**: Type `vente 10 pain` instead of calculating and typing `vente 10 pain 3000`
- **Fewer Errors**: System calculates prices automatically - no mistakes
- **Better Insights**: See exactly what you sold today with products and quantities
- **Natural Language**: Use singular or plural - the bot understands both

## 🚀 Features

### Core Business Functions
- **📱 Natural Language Processing**: Record sales and expenses using everyday language in French and local languages
- **📊 Transaction Management**: Automatic recording of sales and expenses with validation
- **📦 Inventory Tracking**: Real-time stock management with low-stock alerts
- **💰 Price Management**: Set and manage unit prices for products with automatic calculation ✨
- **🛍️ Smart Sales**: Intelligent sales recording with automatic price calculation based on quantity ✨
- **📋 Product Catalog**: Complete product listing with stock levels and pricing information
- **📈 Financial Reports**: Generate daily, weekly, and monthly business reports
- **📋 Detailed Transaction Lists**: View transaction history with products and quantities ✨
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
- **File Storage**: Supabase Storage (for PDF reports)
- **WhatsApp**: Twilio Programmable Messaging SDK (with Meta API fallback)
- **Frontend**: Next.js (for dashboard)
- **Authentication**: JWT + OTP
- **Testing**: Jest with comprehensive test coverage
- **Documentation**: OpenAPI/Swagger

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 13+ ([Download](https://www.postgresql.org/download/))
- **npm** or **yarn** package manager
- **Twilio Account** ([Setup Guide](https://console.twilio.com/)) - Primary WhatsApp provider
- **WhatsApp Business Account** (Optional - for Meta API fallback)
- **Supabase project** (optional — for PDF uploads via Storage when not using local-only dev)

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

# Twilio Configuration (Primary WhatsApp Provider)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
TWILIO_WEBHOOK_SECRET=your_twilio_webhook_secret

# WhatsApp Configuration (Optional - Meta API Fallback)
# WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
# WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
# WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
# WHATSAPP_APP_SECRET=your_app_secret

# Supabase Storage (optional — PDF reports)
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=reports

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
3. **Product Setup**: Set up products and their unit prices
4. **Business Operations**: Users interact with the bot using natural language
5. **Smart Calculations**: Automatic price calculations based on quantity and unit prices
6. **Plural Support**: Works with both singular and plural forms (pain/pains, eau/eaux)
7. **Detailed Tracking**: View transaction lists with product and quantity details
8. **Automated Reports**: Daily reports sent automatically at 8 PM

### 🆕 New Features: Multiple Units Management

#### Multiple Units Support
The bot now supports advanced inventory management with multiple units of measure:

- **Purchase in Bulk**: Buy products in cases, bags, or cartons
- **Sell Individually**: Sell the same products by piece, bottle, or unit
- **Automatic Conversion**: System handles all unit conversions automatically
- **Smart Pricing**: Calculate prices based on purchase costs and desired margins
- **Stock Alerts**: Set alerts based on your purchase units

#### Example Workflow
```
User: produit unité bière achat caisse 24 bouteille
Bot: ✅ Configuration mise à jour: bière
     📦 Achat: caisse (24 bouteilles par caisse)
     🛒 Vente: bouteille

User: prix achat bière 12000 caisse
Bot: 💰 Prix d'achat configuré: bière
     📦 12,000 FCFA par caisse
     🛒 500 FCFA par bouteille

User: prix vente bière 40%
Bot: 💵 Prix de vente calculé: bière
     📊 Marge: 40%
     🛒 Prix recommandé: 700 FCFA par bouteille

User: stock bière 5 caisse
Bot: ✅ Stock mis à jour: bière
     📦 Ajouté: 5 caisses (120 bouteilles)
     📊 Stock total: 120 bouteilles (5 caisses)

User: vente 2100 bière 3
Bot: ✅ Vente enregistrée: 2,100 FCFA
     🍺 Vendu: 3 bouteilles
     📊 Stock restant: 117 bouteilles (4 caisses + 21 bouteilles)
```

#### Smart Price Management
The bot also supports intelligent price calculations for simple products:

- **Set Unit Prices**: `prix pain 300` sets bread price to 300 CFA per unit
- **Quantity Sales**: `vente 10 pain` automatically calculates total (10 × 300 = 3000 CFA)
- **Product Catalog**: `produits` shows all products with stock levels and prices
- **Flexible Sales**: Mix automatic and custom pricing as needed

### Supported Commands

#### Sales Recording
```
vente 1000                    # Simple sale amount
vente pain 1500              # Product with custom price
vente 10 pain                # Quantity sale (auto-calculates if unit price set) ✨
vente 10 pains               # Works with plurals too! ✨
vente 10 pain 2500           # Quantity + product + total amount
j'ai vendu du pain à 2000    # Natural language
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

#### Product & Price Management
```
produits            # List all products with stock and prices
prix pain 300       # Set unit price for bread to 300 CFA
prix lait 500       # Set unit price for milk to 500 CFA
```

#### Multiple Units Management
```
# Configure units
produit unité bière achat caisse 24 bouteille
produit unité riz achat sac 50 kg
produit unité savon achat carton 12 pièce

# Manage stock with units
stock bière 5 caisse          # Add 5 cases (120 bottles)
stock riz 10 sac             # Add 10 bags (500 kg)
stock                         # View all stock with units

# Price management with units
prix achat bière 12000 caisse # Set purchase price per case
prix vente bière 40%          # Set 40% profit margin
prix bière                    # View all price information

# Alerts with units
alerte bière 2 caisse         # Alert when below 2 cases
alerte riz 5 sac              # Alert when below 5 bags

# View configuration and history
produit unité bière           # View unit configuration
historique bière              # View movement history
```

#### Smart Sales (with automatic calculation) ✨
```
vente pain          # Sell 1 bread at unit price
vente 10 pain       # Sell 10 breads (auto-calculated: 10 × unit price) ✨
vente 10 pains      # Works with plurals too! ✨
vente pain 500      # Sell bread for custom price (500 CFA)
vente 10 pain 2500  # Sell 10 breads for total 2500 CFA

# How it works:
# 1. Set price once: "prix pain 300"
# 2. Sell quickly: "vente 10 pain" → Auto-calculates: 3,000 CFA
# 3. Stock updates automatically
```

#### Reports & Transaction Lists
```
# Balance Reports (Totals)
bilan jour              # Daily balance (totals)
bilan semaine           # Weekly balance
bilan mois              # Monthly balance
rapport PDF             # Generate PDF report

# Detailed Transaction Lists (NEW!) ✨
transactions            # List all transactions with products/quantities
transactions jour       # Today's transactions
transactions semaine    # This week's transactions
ventes jour            # Only sales for today
dépenses jour          # Only expenses for today
liste ventes           # List of all sales
```

### Message Processing Flow

1. **Webhook Reception**: Twilio sends message to `/whatsapp/twilio/webhook`
2. **Message Parsing**: Extract and validate message content
3. **Queue Processing**: Add message to processing queue
4. **NLP Analysis**: Analyze message intent and extract data
5. **Price Calculation**: Automatic price calculation for quantity-based sales
6. **Authentication**: Verify user permissions
7. **Business Logic**: Execute appropriate business operation
8. **Stock Updates**: Automatic stock decrement and price management
9. **Response**: Send confirmation back to user

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

# Note: After updating to include price management features,
# run the migration to add unit_price column to stock_items table

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format code with Prettier
```

### Testing the WhatsApp Integration

1. **Webhook Setup**: Configure your Twilio webhook URL to point to your server
2. **Ngrok for Local Development**:
   ```bash
   # Install ngrok
   npm install -g ngrok
   
   # Expose local server
   ngrok http 3000
   
   # Use the ngrok URL for Twilio webhook
   # Example: https://abc123.ngrok.io/whatsapp/twilio/webhook
   ```

3. **Test Messages**: Send test messages to your Twilio WhatsApp number

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
│   │   ├── entities/        # StockItem entity (with unit prices)
│   │   ├── services/        # Product normalizer service
│   │   └── stock.service.ts # Stock operations & price management
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

For comprehensive troubleshooting information, see the [Database Connection Troubleshooting](docs/database-connection-troubleshooting.md) and [Deployment Guide](DEPLOYMENT.md).

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
   - Check TWILIO_WEBHOOK_SECRET matches Twilio Console configuration
   - Ensure webhook endpoint returns 200 status
   - For Meta fallback: Check WHATSAPP_WEBHOOK_VERIFY_TOKEN matches Meta configuration

3. **PDF Generation Fails**
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set for uploads
   - Ensure the Storage bucket exists (`SUPABASE_STORAGE_BUCKET`, default `reports`)
   - On Vercel, Puppeteer is disabled unless you use an external PDF path; check `DISABLE_PUPPETEER` / `VERCEL`

4. **Message Processing Stuck**
   - Check queue status at `/whatsapp/health`
   - Review application logs for errors
   - Restart the application if needed

5. **Price Management Issues**
   - Ensure database migration has been run: `npm run migration:run`
   - Verify `unit_price` column exists in `stock_items` table
   - Check that products have been created with `prix [product] [amount]` command

### Logs

```bash
# View application logs
npm run start:dev

# For production, use PM2 or similar
pm2 logs monpetitbiz
```

## 🚀 Deployment

For detailed production deployment instructions, see the [Deployment Guide](DEPLOYMENT.md).

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

### Monitoring and Alerting

For comprehensive monitoring setup, see:
- [Deployment Guide](DEPLOYMENT.md) - Production deployment and configuration
- [Database Troubleshooting](docs/database-connection-troubleshooting.md) - Common connection issues

## 📚 Documentation

### API Documentation
The complete API documentation is available at `/api` when the server is running. Key endpoints include:

- **Authentication**: `/auth/*`
- **Twilio Webhook**: `/whatsapp/twilio/webhook`
- **Meta Webhook** (fallback): `/whatsapp/webhook`
- **Health Checks**: `/health/*`
- **Dashboard API**: `/dashboard/*`

### Feature Documentation

#### Price & Product Management
- **[How to View Prices](docs/how-to-view-prices.md)** - View product prices and stock values
- **[Product Codes System](docs/codes-produits.md)** - Automatic product code generation
- **[Composite Product Names](docs/noms-produits-composes.md)** - Handling multi-word product names

#### Multiple Units Management
- **[Technical Documentation](docs/units-technical-documentation.md)** - Units system architecture and API

#### WhatsApp / Twilio
- **[Twilio Guide](docs/twilio-guide.md)** - Setup, deployment, monitoring, troubleshooting

#### Admin & Deployment
- **[Admin Portal Setup](docs/admin-portal-setup.md)** - Admin dashboard deployment
- **[Admin Portal Integration](docs/admin-portal-integration.md)** - Backend integration for admin
- **[Environment Variables](docs/environment-variables.md)** - Configuration reference
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment

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