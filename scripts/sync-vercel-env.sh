#!/bin/bash

# Sync Vercel Environment Variables Script
# This script pulls environment variables from Vercel to use locally

set -e

echo "📥 Syncing Vercel environment variables..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed"
    echo ""
    echo "💡 Install it with:"
    echo "   npm install -g vercel"
    exit 1
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in to Vercel"
    echo ""
    echo "💡 Login with:"
    echo "   vercel login"
    exit 1
fi

# Ask for environment
echo "Which environment do you want to pull?"
echo "1) Production"
echo "2) Preview"
echo "3) Development"
echo "4) All environments"
read -p "Enter choice [1-4]: " env_choice

case $env_choice in
    1)
        ENVIRONMENT="production"
        ;;
    2)
        ENVIRONMENT="preview"
        ;;
    3)
        ENVIRONMENT="development"
        ;;
    4)
        ENVIRONMENT=""
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

# Pull environment variables
if [ -z "$ENVIRONMENT" ]; then
    echo "📥 Pulling all environments..."
    vercel env pull .env.local
else
    echo "📥 Pulling $ENVIRONMENT environment..."
    vercel env pull .env.local --environment=$ENVIRONMENT
fi

if [ ! -f ".env.local" ]; then
    echo "❌ Failed to pull environment variables"
    exit 1
fi

echo ""
echo "✅ Environment variables synced to .env.local"
echo ""
echo "📋 Variables pulled:"
grep -v "^#" .env.local | grep -v "^$" | cut -d'=' -f1 | sed 's/^/   - /'
echo ""
echo "💡 To use these variables:"
echo "   source .env.local"
echo ""
echo "💡 Then test the connection:"
echo "   ./scripts/check-database-connection.sh"
echo ""
echo "💡 Or start the application:"
echo "   source .env.local && npm run start:dev"
echo ""
echo "⚠️  Note: .env.local is in .gitignore and should not be committed"

