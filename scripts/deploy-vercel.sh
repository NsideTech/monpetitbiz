#!/bin/bash

# MonPetitBiz - Vercel Deployment Script
# Usage: ./scripts/deploy-vercel.sh

set -e

echo "🚀 Starting MonPetitBiz deployment to Vercel..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

# Check if we're logged in to Vercel
echo -e "${YELLOW}🔐 Checking Vercel authentication...${NC}"
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Vercel:${NC}"
    vercel login
fi

# Build the application locally to check for errors
echo -e "${YELLOW}🔨 Building application locally...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Please fix errors before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Local build successful${NC}"

# Check if this is the first deployment
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${YELLOW}🆕 First deployment detected. Setting up project...${NC}"
    
    # Deploy with setup
    vercel --confirm
    
    echo -e "${YELLOW}📝 Please configure your environment variables in Vercel dashboard:${NC}"
    echo "1. Go to https://vercel.com/dashboard"
    echo "2. Select your project"
    echo "3. Go to Settings > Environment Variables"
    echo "4. Add all variables from .env.production"
    echo ""
    echo -e "${YELLOW}Required variables:${NC}"
    echo "- DATABASE_URL"
    echo "- TWILIO_ACCOUNT_SID"
    echo "- TWILIO_AUTH_TOKEN"
    echo "- TWILIO_WHATSAPP_NUMBER"
    echo "- TWILIO_WEBHOOK_SECRET"
    echo "- JWT_SECRET"
    echo "- SUPABASE_URL"
    echo "- SUPABASE_SERVICE_ROLE_KEY"
    echo "- SUPABASE_STORAGE_BUCKET (optional, default: reports)"
    echo ""
    read -p "Press Enter after configuring environment variables..."
else
    echo -e "${YELLOW}🔄 Existing project detected. Deploying...${NC}"
fi

# Deploy to production
echo -e "${YELLOW}🚀 Deploying to production...${NC}"
vercel --prod

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    
    # Get the deployment URL
    DEPLOYMENT_URL=$(vercel ls | grep "monpetitbiz" | head -1 | awk '{print $2}')
    
    echo -e "${GREEN}🌐 Your application is live at: https://${DEPLOYMENT_URL}${NC}"
    echo ""
    echo -e "${YELLOW}📋 Post-deployment checklist:${NC}"
    echo "1. ✅ Test health endpoint: https://${DEPLOYMENT_URL}/health"
    echo "2. ✅ Configure Twilio webhook: https://${DEPLOYMENT_URL}/whatsapp/webhook"
    echo "3. ✅ Test WhatsApp integration"
    echo "4. ✅ Run database migrations if needed"
    echo "5. ✅ Monitor logs: vercel logs ${DEPLOYMENT_URL}"
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
else
    echo -e "${RED}❌ Deployment failed. Check the logs above for errors.${NC}"
    exit 1
fi