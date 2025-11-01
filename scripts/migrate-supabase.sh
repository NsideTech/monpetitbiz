#!/bin/bash

# MonPetitBiz - Supabase Migration Script
# Usage: ./scripts/migrate-supabase.sh

set -e

echo "🗄️ Migrating MonPetitBiz to Supabase..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo -e "${YELLOW}Please set your Supabase database URL:${NC}"
    echo "export DATABASE_URL='postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres'"
    echo ""
    echo -e "${BLUE}💡 You can find this URL in your Supabase dashboard:${NC}"
    echo "1. Go to https://supabase.com/dashboard"
    echo "2. Select your project"
    echo "3. Go to Settings → Database"
    echo "4. Copy the 'Connection string' under 'Connection parameters'"
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL found${NC}"

# Extract project info from URL for display
PROJECT_REF=$(echo "$DATABASE_URL" | grep -o 'db\.[^.]*\.supabase\.co' | cut -d'.' -f2)
if [ -n "$PROJECT_REF" ]; then
    echo -e "${BLUE}📡 Connecting to Supabase project: ${PROJECT_REF}${NC}"
fi

# Test database connection
echo -e "${YELLOW}🔌 Testing Supabase connection...${NC}"
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected to Supabase successfully${NC}"
        
        # Show PostgreSQL version
        PG_VERSION=$(psql "$DATABASE_URL" -t -c "SELECT version();" | head -1 | cut -d' ' -f2)
        echo -e "${BLUE}📊 PostgreSQL version: ${PG_VERSION}${NC}"
    else
        echo -e "${RED}❌ Cannot connect to Supabase${NC}"
        echo ""
        echo -e "${YELLOW}Troubleshooting:${NC}"
        echo "1. Check your DATABASE_URL is correct"
        echo "2. Verify your password is correct"
        echo "3. Ensure your IP is allowed (Supabase allows all by default)"
        echo "4. Check your internet connection"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ psql not found, skipping connection test${NC}"
    echo "Install PostgreSQL client to enable connection testing"
fi

# Check if migrations table exists
echo -e "${YELLOW}🔍 Checking migration status...${NC}"
MIGRATIONS_EXIST=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations');" 2>/dev/null || echo "f")

if [ "$MIGRATIONS_EXIST" = "t" ]; then
    MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM migrations;" 2>/dev/null || echo "0")
    echo -e "${BLUE}📋 Found ${MIGRATION_COUNT} existing migrations${NC}"
else
    echo -e "${YELLOW}📋 No migrations table found - this appears to be a fresh database${NC}"
fi

# Run migrations
echo -e "${YELLOW}🔄 Running TypeORM migrations...${NC}"
npm run migration:run

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    echo ""
    echo -e "${YELLOW}Common solutions:${NC}"
    echo "1. Check your DATABASE_URL is correct"
    echo "2. Ensure the database is accessible"
    echo "3. Verify migration files are not corrupted"
    echo "4. Check for conflicting table names"
    exit 1
fi

# Verify schema
echo -e "${YELLOW}🔍 Verifying database schema...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${BLUE}📊 Tables created in Supabase:${NC}"
    psql "$DATABASE_URL" -c "
        SELECT 
            schemaname as schema,
            tablename as table,
            tableowner as owner,
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename) as columns
        FROM pg_tables t
        WHERE schemaname = 'public' 
        ORDER BY tablename;
    "
    
    # Count total tables
    TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    echo -e "\n${GREEN}✅ Total tables created: ${TABLE_COUNT}${NC}"
    
    # Show migration status
    if [ "$MIGRATIONS_EXIST" = "t" ] || [ "$TABLE_COUNT" -gt 0 ]; then
        echo -e "\n${BLUE}📋 Migration history:${NC}"
        psql "$DATABASE_URL" -c "SELECT id, timestamp, name FROM migrations ORDER BY id DESC LIMIT 5;" 2>/dev/null || echo "No migration history available"
    fi
fi

# Test basic functionality
echo -e "${YELLOW}🧪 Testing basic database operations...${NC}"
if command -v psql &> /dev/null; then
    # Test insert/select on a simple table
    TEST_RESULT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM businesses;" 2>/dev/null || echo "error")
    
    if [ "$TEST_RESULT" != "error" ]; then
        echo -e "${GREEN}✅ Database operations working correctly${NC}"
        echo -e "${BLUE}📊 Current businesses count: ${TEST_RESULT}${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not test database operations${NC}"
    fi
fi

# Show Supabase dashboard info
echo -e "\n${GREEN}🎉 Supabase migration completed successfully!${NC}"
echo ""
echo -e "${BLUE}📱 Supabase Dashboard Access:${NC}"
if [ -n "$PROJECT_REF" ]; then
    echo "🌐 Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}"
    echo "📊 Database: https://supabase.com/dashboard/project/${PROJECT_REF}/editor"
    echo "📝 SQL Editor: https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
    echo "📈 Logs: https://supabase.com/dashboard/project/${PROJECT_REF}/logs"
else
    echo "🌐 Dashboard: https://supabase.com/dashboard"
fi

echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. ✅ Verify tables in Supabase dashboard"
echo "2. ✅ Test your application connection"
echo "3. ✅ Configure Row Level Security (RLS) if needed"
echo "4. ✅ Set up database backups (automatic with Supabase)"
echo "5. ✅ Monitor database performance in dashboard"

echo ""
echo -e "${GREEN}🚀 Your MonPetitBiz database is ready on Supabase!${NC}"