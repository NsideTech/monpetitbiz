#!/bin/bash

# MonPetitBiz - Supabase Schema Verification
# Usage: ./scripts/verify-supabase-schema.sh

set -e

echo "🔍 Verifying Supabase schema for MonPetitBiz..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL found${NC}"

# Test connection
echo -e "${YELLOW}🔌 Testing connection to Supabase...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️ psql not found. Install PostgreSQL client for full verification.${NC}"
    exit 1
fi

if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to Supabase database${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Connected to Supabase successfully${NC}"

# Expected tables for MonPetitBiz
EXPECTED_TABLES=(
    "businesses"
    "users" 
    "transactions"
    "stock_items"
    "conversation_states"
    "product_units"
    "stock_movements"
    "migrations"
)

echo -e "\n${BLUE}📋 Checking for required tables...${NC}"

MISSING_TABLES=()
FOUND_TABLES=()

for table in "${EXPECTED_TABLES[@]}"; do
    COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table' AND table_schema = 'public';" 2>/dev/null | tr -d ' ')
    
    if [ "$COUNT" -eq 1 ]; then
        echo -e "✅ ${table}"
        FOUND_TABLES+=("$table")
    else
        echo -e "❌ ${table} - Missing"
        MISSING_TABLES+=("$table")
    fi
done

# Summary
echo -e "\n${BLUE}📊 Summary:${NC}"
echo -e "${GREEN}✅ Found tables: ${#FOUND_TABLES[@]}/${#EXPECTED_TABLES[@]}${NC}"

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing tables: ${#MISSING_TABLES[@]}${NC}"
    echo -e "${YELLOW}Missing: ${MISSING_TABLES[*]}${NC}"
fi

# Detailed table information
echo -e "\n${BLUE}📋 Table details:${NC}"
psql "$DATABASE_URL" -c "
    SELECT 
        t.table_name as \"Table\",
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as \"Columns\",
        pg_size_pretty(pg_total_relation_size('public.' || t.table_name)) as \"Size\"
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
"

# Check migrations
echo -e "\n${BLUE}📋 Migration status:${NC}"
MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM migrations;" 2>/dev/null | tr -d ' ')

if [ "$MIGRATION_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found ${MIGRATION_COUNT} migrations${NC}"
    
    echo -e "\n${BLUE}📋 Recent migrations:${NC}"
    psql "$DATABASE_URL" -c "
        SELECT 
            id,
            to_timestamp(timestamp/1000) as executed_at,
            name
        FROM migrations 
        ORDER BY id DESC 
        LIMIT 5;
    "
else
    echo -e "${YELLOW}⚠️ No migrations found${NC}"
fi

# Check indexes
echo -e "\n${BLUE}📋 Database indexes:${NC}"
psql "$DATABASE_URL" -c "
    SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
    FROM pg_indexes 
    WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
    ORDER BY tablename, indexname;
"

# Check constraints
echo -e "\n${BLUE}📋 Foreign key constraints:${NC}"
psql "$DATABASE_URL" -c "
    SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
"

# Test basic operations
echo -e "\n${BLUE}🧪 Testing basic database operations...${NC}"

# Test businesses table
BUSINESS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM businesses;" 2>/dev/null | tr -d ' ')
echo -e "📊 Businesses: ${BUSINESS_COUNT}"

# Test users table
USER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
echo -e "📊 Users: ${USER_COUNT}"

# Test transactions table
TRANSACTION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM transactions;" 2>/dev/null | tr -d ' ')
echo -e "📊 Transactions: ${TRANSACTION_COUNT}"

# Test stock_items table
STOCK_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM stock_items;" 2>/dev/null | tr -d ' ')
echo -e "📊 Stock items: ${STOCK_COUNT}"

# Database size
echo -e "\n${BLUE}💾 Database size:${NC}"
psql "$DATABASE_URL" -c "
    SELECT 
        pg_size_pretty(pg_database_size(current_database())) as \"Database Size\";
"

# Final status
echo -e "\n${BLUE}🎯 Verification Results:${NC}"

if [ ${#MISSING_TABLES[@]} -eq 0 ] && [ "$MIGRATION_COUNT" -gt 0 ]; then
    echo -e "${GREEN}🎉 Schema verification PASSED!${NC}"
    echo -e "${GREEN}✅ All required tables are present${NC}"
    echo -e "${GREEN}✅ Migrations are properly recorded${NC}"
    echo -e "${GREEN}✅ Database is ready for MonPetitBiz${NC}"
    
    echo -e "\n${BLUE}📱 Supabase Dashboard:${NC}"
    PROJECT_REF=$(echo "$DATABASE_URL" | grep -o 'db\.[^.]*\.supabase\.co' | cut -d'.' -f2)
    if [ -n "$PROJECT_REF" ]; then
        echo "🌐 https://supabase.com/dashboard/project/${PROJECT_REF}"
    fi
    
    exit 0
else
    echo -e "${RED}❌ Schema verification FAILED!${NC}"
    
    if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing tables: ${MISSING_TABLES[*]}${NC}"
    fi
    
    if [ "$MIGRATION_COUNT" -eq 0 ]; then
        echo -e "${RED}❌ No migrations found${NC}"
    fi
    
    echo -e "\n${YELLOW}💡 To fix these issues:${NC}"
    echo "1. Run: ./scripts/migrate-supabase.sh"
    echo "2. Or manually execute: npm run migration:run"
    echo "3. Check your DATABASE_URL is correct"
    
    exit 1
fi