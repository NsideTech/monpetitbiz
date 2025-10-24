# MonPetitBiz Setup Guide

## 🚀 Quick Setup (Recommended)

The fastest way to get MonPetitBiz running:

```bash
# 1. Clone and install
git clone <repository-url>
cd monpetitbiz
npm install

# 2. Quick start (handles everything)
npm run quick-start

# 3. Optional: Dedicated Twilio setup help
npm run setup-twilio
```

## 🔧 Manual Setup

If you prefer to set up manually:

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 13+
- npm or yarn

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Database Setup
```bash
npm run setup-db
```

### 5. Start Application
```bash
npm run start:dev
```

## 🧪 Testing

### Test the API
```bash
npm run test-api
```

### Run Unit Tests
```bash
npm test
```

### Check Health
```bash
curl http://localhost:3000/health
```

## 📚 Available Endpoints

- **API Documentation**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health
- **WhatsApp Webhook**: http://localhost:3000/whatsapp/webhook
- **Test Endpoint**: http://localhost:3000/whatsapp/test (dev only)

## 🔍 Troubleshooting

### Common Issues

1. **"UndefinedModuleException" Error**
   - ✅ **FIXED**: This was caused by circular dependencies between WhatsappModule and ReportModule
   - The fix uses `forwardRef()` to resolve the circular dependency

2. **Database Connection Error**
   ```bash
   npm run setup-db
   ```

3. **Port Already in Use**
   ```bash
   # Change PORT in .env file
   PORT=3001
   ```

4. **WhatsApp Configuration Missing**
   - Update WhatsApp credentials in .env
   - Get tokens from Meta Developer Console

### Environment Variables

Required for basic functionality:
```env
# Database
DATABASE_NAME=monpetitbiz
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password

# Authentication
JWT_SECRET=your-secret-key-min-32-characters

# Twilio WhatsApp (Primary)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

Optional for enhanced functionality:
```env
# Twilio Optional
TWILIO_WEBHOOK_SECRET=your_webhook_secret
TWILIO_ENVIRONMENT=production
TWILIO_RETRY_ATTEMPTS=3
TWILIO_TIMEOUT=30000

# Legacy WhatsApp (Meta API - for backward compatibility)
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token

# AWS (for PDF reports)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```

## 📱 Twilio WhatsApp Setup

### Quick Twilio Setup
```bash
# Get help with Twilio configuration
npm run setup-twilio
```

### Manual Twilio Setup

1. **Create Twilio Account**
   - Visit [Twilio Console](https://console.twilio.com/)
   - Sign up for free account ($15 credit included)

2. **Get Credentials**
   - Account SID: Dashboard → Account Info
   - Auth Token: Dashboard → Account Info (click "Show")

3. **Choose Setup Type**

   **🧪 Sandbox (Testing)**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   TWILIO_ENVIRONMENT=sandbox
   ```
   
   **🏢 Production (Live Business)**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
   TWILIO_ENVIRONMENT=production
   TWILIO_WEBHOOK_SECRET=your_webhook_secret
   ```

4. **Configure Webhooks**
   
   **Local Development:**
   ```bash
   # Terminal 1: Start app
   npm run start:dev
   
   # Terminal 2: Expose with ngrok
   ngrok http 3000
   ```
   
   Then in Twilio Console → WhatsApp → Sandbox:
   - Webhook URL: `https://abc123.ngrok.io/whatsapp/twilio/webhook`
   
   **Production:**
   - Webhook URL: `https://yourdomain.com/whatsapp/twilio/webhook`

5. **Test Connection**
   - Sandbox: Send `join <sandbox-name>` to +1 415 523 8886
   - Test command: `vente 1000`

### Webhook Endpoints

The application provides multiple webhook endpoints:

- **Twilio (Primary)**: `/whatsapp/twilio/webhook`
- **Meta API (Legacy)**: `/whatsapp/webhook`
- **Health Check**: `/health`

## 📱 WhatsApp Commands

Once running, the bot supports these commands:

### Sales
- `vente 1000` - Record sale of 1000 CFA
- `vente pain 1500` - Record bread sale
- `j'ai vendu du pain à 2000` - Natural language

### Expenses
- `dépense 500` - Record expense
- `dépense 500 marchandise` - Expense with description

### Stock
- `stock pain 50` - Update stock
- `stock pain` - Check stock
- `stock` - Check all stock

### Reports
- `bilan jour` - Daily report
- `bilan semaine` - Weekly report
- `rapport PDF` - Generate PDF

## 🏥 Health Monitoring

The application provides comprehensive health monitoring:

- **`/health`** - Complete system status
- **`/health/ready`** - Kubernetes readiness probe
- **`/health/live`** - Kubernetes liveness probe
- **`/health/metrics`** - System metrics

## 🚀 Production Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

### Environment
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## 📞 Support

- Check the troubleshooting section above
- Review logs: `npm run start:dev`
- Test API: `npm run test-api`
- API Documentation: http://localhost:3000/api

## 🎉 Success!

If you see this message, everything is working:
```
Application is running on: http://localhost:3000
API Documentation available at: http://localhost:3000/api
```

Visit the API documentation to explore all available endpoints!