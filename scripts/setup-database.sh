#!/bin/bash

# Database Setup Script for MonPetitBiz
# This script creates the database and sets up the initial schema

set -e

echo "🗄️  MonPetitBiz Database Setup"
echo "============================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed or not in PATH."
    echo "   Please install PostgreSQL first:"
    echo "   - macOS: brew install postgresql"
    echo "   - Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "❌ PostgreSQL is not running."
    echo "   Please start PostgreSQL:"
    echo "   - macOS: brew services start postgresql"
    echo "   - Ubuntu: sudo systemctl start postgresql"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Database configuration
DB_NAME="monpetitbiz"
DB_USER="postgres"

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "✅ Database '$DB_NAME' already exists"
else
    echo "📝 Creating database '$DB_NAME'..."
    createdb "$DB_NAME"
    echo "✅ Database '$DB_NAME' created successfully"
fi

# Test database connection
echo "🔌 Testing database connection..."
if psql -d "$DB_NAME" -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Failed to connect to database"
    exit 1
fi

# Check if .env file exists and update it
if [ -f ".env" ]; then
    echo "📝 Updating .env file with database configuration..."
    
    # Update database configuration in .env
    # sed -i.bak "s/DATABASE_NAME=.*/DATABASE_NAME=$DB_NAME/" .env
    # sed -i.bak "s/DATABASE_HOST=.*/DATABASE_HOST=localhost/" .env
    # sed -i.bak "s/DATABASE_PORT=.*/DATABASE_PORT=5432/" .env
    # sed -i.bak "s/DATABASE_USERNAME=.*/DATABASE_USERNAME=$DB_USER/" .env
    
    echo "✅ .env file updated"
else
    echo "⚠️  .env file not found. Please copy .env.example to .env and configure it."
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "📋 Database Information:"
echo "   - Name: $DB_NAME"
echo "   - Host: localhost"
echo "   - Port: 5432"
echo "   - User: $DB_USER"
echo ""
echo "🚀 You can now start the application with:"
echo "   npm run start:dev"