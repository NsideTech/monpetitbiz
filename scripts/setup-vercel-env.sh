#!/bin/bash

# MonPetitBiz - Vercel Environment Variables Setup
# Usage: ./scripts/setup-vercel-env.sh

set -e

echo "🔐 Setting up Vercel environment variables..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found. Please install it first:${NC}"
    echo "npm install -g vercel"
    exit 1
fi

# Check if we're logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Vercel:${NC}"
    vercel login
fi

echo -e "${YELLOW}📝 This script will help you set up environment variables for Vercel.${NC}"
echo -e "${YELLOW}You can also set these manually in the Vercel dashboard.${NC}"
echo ""

# Function to add environment variable
add_env_var() {
    local var_name=$1
    local var_description=$2
    local is_secret=${3:-true}
    
    echo -e "${YELLOW}Setting up ${var_name}...${NC}"
    echo "Description: ${var_description}"
    
    if [ "$is_secret" = true ]; then
        echo "This is a secret variable (will be hidden)"
    fi
    
    read -p "Enter value for ${var_name} (or press Enter to skip): " var_value
    
    if [ -n "$var_value" ]; then
        vercel env add "$var_name" production <<< "$var_value"
        echo -e "${GREEN}✅ ${var_name} added successfully${NC}"
    else
        echo -e "${YELLOW}⏭️ Skipped ${var_name}${NC}"
    fi
    echo ""
}

echo -e "${YELLOW}🗄️ Database Configuration${NC}"
add_env_var "DATABASE_URL" "PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/db?sslmode=require)" true

echo -e "${YELLOW}📱 Twilio WhatsApp Configuration${NC}"
add_env_var "TWILIO_ACCOUNT_SID" "Your Twilio Account SID" true
add_env_var "TWILIO_AUTH_TOKEN" "Your Twilio Auth Token" true
add_env_var "TWILIO_WHATSAPP_NUMBER" "Your Twilio WhatsApp number (e.g., whatsapp:+14155238886)" false
add_env_var "TWILIO_WEBHOOK_SECRET" "Webhook secret for signature verification" true

echo -e "${YELLOW}🔐 JWT Configuration${NC}"
add_env_var "JWT_SECRET" "JWT secret key (minimum 32 characters)" true

echo -e "${YELLOW}☁️ AWS S3 Configuration${NC}"
add_env_var "AWS_ACCESS_KEY_ID" "AWS Access Key ID for S3" true
add_env_var "AWS_SECRET_ACCESS_KEY" "AWS Secret Access Key for S3" true
add_env_var "AWS_S3_BUCKET" "S3 bucket name for storing reports" false

echo -e "${YELLOW}🌐 Application Configuration${NC}"
add_env_var "APP_URL" "Your application URL (e.g., https://your-app.vercel.app)" false

echo -e "${GREEN}🎉 Environment variables setup completed!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Deploy your application: vercel --prod"
echo "2. Test the health endpoint: https://your-app.vercel.app/health"
echo "3. Configure Twilio webhook URL: https://your-app.vercel.app/whatsapp/webhook"
echo "4. Test WhatsApp integration"
echo ""
echo -e "${YELLOW}💡 To view all environment variables:${NC}"
echo "vercel env ls"