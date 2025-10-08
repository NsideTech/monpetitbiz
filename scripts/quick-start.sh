#!/bin/bash

# MonPetitBiz Quick Start Script
# This script helps you get the application running quickly

set -e

echo "🚀 MonPetitBiz Quick Start"
echo "=========================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed or not in PATH."
    echo "   Please install PostgreSQL 13+ and make sure it's running."
    echo "   macOS: brew install postgresql"
    echo "   Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your configuration:"
    echo "   - Database credentials"
    echo "   - WhatsApp API tokens"
    echo "   - JWT secret"
    echo ""
    echo "Opening .env file for editing..."
    
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
    
    echo ""
    echo "Press Enter when you've finished configuring .env..."
    read -r
fi

# Setup database
echo "🗄️  Setting up database..."
if ./scripts/setup-database.sh; then
    echo "✅ Database setup completed"
else
    echo "❌ Database setup failed. Please check your PostgreSQL installation."
    exit 1
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Run database migrations
echo "🗄️  Running database migrations..."
if npm run migration:run; then
    echo "✅ Database migrations completed"
else
    echo "⚠️  Database migrations failed. This might be normal for first run."
fi

# Start the application
echo ""
echo "🎉 Setup complete! Starting the application..."
echo ""
echo "📚 Available endpoints:"
echo "   - API: http://localhost:3000"
echo "   - Health: http://localhost:3000/health"
echo "   - Documentation: http://localhost:3000/api"
echo ""
echo "🧪 To test the API:"
echo "   node test-api.js"
echo ""
echo "Starting server..."

npm run start:dev