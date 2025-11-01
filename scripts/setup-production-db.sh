#!/bin/bash

# MonPetitBiz - Production Database Setup Script
# Usage: ./scripts/setup-production-db.sh

set -e

echo "🗄️ Setting up production database for MonPetitBiz..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL environment variable is not set${NC}"
    echo "Please set your production database URL:"
    echo "export DATABASE_URL='postgresql://user:password@host:5432/database?sslmode=require'"
    exit 1
fi

echo -e "${GREEN}✅ Database URL found${NC}"

# Test database connection
echo -e "${YELLOW}🔌 Testing database connection...${NC}"
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT version();" &> /dev/null; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
    else
        echo -e "${RED}❌ Cannot connect to database${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ psql not found, skipping connection test${NC}"
fi

# Run migrations
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
npm run migration:run

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

# Verify tables exist
echo -e "${YELLOW}🔍 Verifying database schema...${NC}"
if command -v psql &> /dev/null; then
    TABLES=$(psql "$DATABASE_URL" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" | wc -l)
    echo -e "${GREEN}✅ Found $TABLES tables in database${NC}"
    
    # List main tables
    echo -e "${YELLOW}📋 Main tables:${NC}"
    psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
fi

echo -e "${GREEN}🎉 Production database setup completed!${NC}"