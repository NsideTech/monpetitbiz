#!/bin/bash

# Twilio Setup Script for MonPetitBiz
# This script helps configure Twilio WhatsApp integration

set -e

echo "📱 MonPetitBiz Twilio Setup"
echo "=========================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run the quick-start script first."
    echo "   ./scripts/quick-start.sh"
    exit 1
fi

echo "🔍 Checking current Twilio configuration..."

# Function to check if a variable is set in .env
check_env_var() {
    local var_name=$1
    local var_value=$(grep "^$var_name=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    
    if [ -z "$var_value" ] || [[ "$var_value" == *"your_"* ]] || [[ "$var_value" == *"development_"* ]] || [[ "$var_value" == *"test_"* ]]; then
        return 1
    else
        return 0
    fi
}

# Check required Twilio variables
MISSING_VARS=()

if ! check_env_var "TWILIO_ACCOUNT_SID"; then
    MISSING_VARS+=("TWILIO_ACCOUNT_SID")
fi

if ! check_env_var "TWILIO_AUTH_TOKEN"; then
    MISSING_VARS+=("TWILIO_AUTH_TOKEN")
fi

if ! check_env_var "TWILIO_WHATSAPP_NUMBER"; then
    MISSING_VARS+=("TWILIO_WHATSAPP_NUMBER")
fi

if ! check_env_var "TWILIO_WEBHOOK_SECRET"; then
    MISSING_VARS+=("TWILIO_WEBHOOK_SECRET")
fi

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo "✅ Twilio configuration appears to be complete"
    
    # Test configuration by starting the app briefly
    echo "🧪 Testing Twilio configuration..."
    if timeout 10s npm run start:dev >/dev/null 2>&1; then
        echo "✅ Configuration test passed"
    else
        echo "⚠️  Configuration test failed - check the logs when starting the app"
    fi
else
    echo "❌ Missing or incomplete Twilio configuration:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
fi

echo ""
echo "📋 Twilio Setup Instructions"
echo "============================"
echo ""
echo "1. 🌐 Sign up for Twilio:"
echo "   Visit: https://console.twilio.com/"
echo "   Create a free account (includes $15 credit)"
echo ""
echo "2. 📋 Get your credentials:"
echo "   - Account SID: Found on your Console Dashboard"
echo "   - Auth Token: Found on your Console Dashboard (click 'Show' to reveal)"
echo ""
echo "3. 📱 WhatsApp Setup Options:"
echo ""
echo "   🧪 SANDBOX (for testing):"
echo "   - No approval needed, instant setup"
echo "   - Use number: whatsapp:+14155238886"
echo "   - Users must send 'join <sandbox-name>' to start chatting"
echo "   - Example: TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886"
echo ""
echo "   🏢 PRODUCTION (for live business):"
echo "   - Requires WhatsApp Business approval"
echo "   - Purchase a phone number from Twilio"
echo "   - Submit business verification to WhatsApp"
echo "   - Example: TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890"
echo ""
echo "4. 🔧 Update your .env file:"

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    for var in "${MISSING_VARS[@]}"; do
        case $var in
            "TWILIO_ACCOUNT_SID")
                echo "   $var=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                ;;
            "TWILIO_AUTH_TOKEN")
                echo "   $var=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                ;;
            "TWILIO_WHATSAPP_NUMBER")
                echo "   $var=whatsapp:+14155238886  # For sandbox"
                echo "   # OR"
                echo "   $var=whatsapp:+1234567890   # For production"
                ;;
            "TWILIO_WEBHOOK_SECRET")
                echo "   $var=your_webhook_secret_from_twilio_console"
                ;;
        esac
    done
fi

echo ""
echo "5. 🔐 Webhook Secret (Security):"
echo "   Get your webhook secret from Twilio Console:"
echo "   a) Go to: https://console.twilio.com"
echo "   b) Navigate to: Messaging > Settings > WhatsApp sandbox settings"
echo "   c) Look for 'Webhook Secret' or generate a new Auth Token"
echo "   d) Copy this value to TWILIO_WEBHOOK_SECRET in your .env file"
echo ""
echo "6. 🔗 Webhook Configuration:"
echo "   After starting your app, you'll need to configure webhooks in Twilio:"
echo ""
echo "   For local development:"
echo "   a) Install ngrok: https://ngrok.com/"
echo "   b) Start your app: npm run start:dev"
echo "   c) In another terminal: ngrok http 3000"
echo "   d) Copy the HTTPS URL (e.g., https://abc123.ngrok.io)"
echo "   e) In Twilio Console > WhatsApp > Sandbox Settings:"
echo "      Webhook URL: https://abc123.ngrok.io/whatsapp/twilio/webhook"
echo ""
echo "   For production:"
echo "   - Use your domain: https://yourdomain.com/whatsapp/twilio/webhook"
echo ""
echo "7. 🧪 Testing:"
echo "   - Sandbox: Send 'join <your-sandbox-name>' to +1 415 523 8886"
echo "   - Then send: 'vente 1000' to test a sale recording"
echo ""

# Offer to open .env file for editing
if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    read -p "Would you like to edit the .env file now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Try to open with common editors
        if command -v code &> /dev/null; then
            code .env
        elif command -v nano &> /dev/null; then
            nano .env
        elif command -v vim &> /dev/null; then
            vim .env
        else
            echo "Please edit .env file manually"
        fi
    fi
fi

echo ""
echo "📚 Additional Resources:"
echo "   - Twilio WhatsApp API Docs: https://www.twilio.com/docs/whatsapp"
echo "   - Configuration Guide: docs/configuration-guide.md"
echo "   - Troubleshooting: Check application logs when starting"
echo ""
echo "🚀 Next Steps:"
echo "   1. Update your .env file with Twilio credentials"
echo "   2. Run: npm run start:dev"
echo "   3. Check logs for configuration validation"
echo "   4. Set up webhook URL in Twilio Console"
echo "   5. Test with WhatsApp messages"