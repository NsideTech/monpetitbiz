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
DATABASE_NAME=monpetitbiz
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
JWT_SECRET=your-secret-key
```

Optional for full functionality:
```env
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```

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