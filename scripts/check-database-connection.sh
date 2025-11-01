#!/bin/bash

# Database Connection Check Script for MonPetitBiz
# This script checks database connectivity and configuration

set -e

echo "🔍 MonPetitBiz Database Connection Check"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
echo -e "${BLUE}📋 Checking DATABASE_URL...${NC}"
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo -e "${YELLOW}💡 To set DATABASE_URL:${NC}"
    echo "   export DATABASE_URL='postgresql://user:password@host:port/database'"
    echo ""
    echo -e "${YELLOW}💡 For Supabase:${NC}"
    echo "   1. Go to https://supabase.com/dashboard"
    echo "   2. Select your project"
    echo "   3. Go to Settings → Database"
    echo "   4. Copy the Connection String"
    echo "   5. Run: export DATABASE_URL='postgresql://...'"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ DATABASE_URL is set${NC}"
    # Mask password for display
    DISPLAY_URL=$(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')
    echo "   URL: $DISPLAY_URL"
fi

# Extract hostname from DATABASE_URL
HOSTNAME=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

if [ -z "$HOSTNAME" ]; then
    echo -e "${RED}❌ Could not extract hostname from DATABASE_URL${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🌐 Checking DNS resolution for: $HOSTNAME${NC}"

# Try DNS lookup
if nslookup "$HOSTNAME" >/dev/null 2>&1 || host "$HOSTNAME" >/dev/null 2>&1 || dig +short "$HOSTNAME" >/dev/null 2>&1; then
    IP=$(dig +short "$HOSTNAME" | head -1 || nslookup "$HOSTNAME" 2>/dev/null | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "N/A")
    echo -e "${GREEN}✅ DNS resolution successful${NC}"
    echo "   IP: $IP"
else
    echo -e "${RED}❌ DNS resolution failed for $HOSTNAME${NC}"
    echo ""
    echo -e "${YELLOW}💡 Possible causes:${NC}"
    echo "   • The Supabase project doesn't exist or was deleted"
    echo "   • The project reference in the URL is incorrect"
    echo "   • The project is paused/suspended"
    echo "   • Network/DNS issues"
    echo ""
    echo -e "${YELLOW}💡 Solutions:${NC}"
    echo "   1. Verify your Supabase project exists:"
    echo "      https://supabase.com/dashboard"
    echo ""
    echo "   2. Check your project status (not paused)"
    echo ""
    echo "   3. Get the correct connection string:"
    echo "      Settings → Database → Connection string"
    echo ""
    echo "   4. Or use a local PostgreSQL database:"
    echo "      ./scripts/setup-database.sh"
    echo ""
    exit 1
fi

echo ""
echo -e "${BLUE}🔌 Testing TCP connection to $HOSTNAME:$PORT${NC}"

# Test TCP connection
if timeout 5 bash -c "echo > /dev/tcp/$HOSTNAME/$PORT" 2>/dev/null || nc -z -w 5 "$HOSTNAME" "$PORT" 2>/dev/null; then
    echo -e "${GREEN}✅ TCP connection successful on port $PORT${NC}"
else
    echo -e "${YELLOW}⚠️  TCP connection failed on port $PORT${NC}"
    
    # If Supabase and using direct port, suggest pooler port
    if echo "$HOSTNAME" | grep -q "supabase.co"; then
        echo ""
        echo -e "${BLUE}🔍 Trying Supabase connection pooler port (6543)...${NC}"
        if timeout 5 bash -c "echo > /dev/tcp/$HOSTNAME/6543" 2>/dev/null || nc -z -w 5 "$HOSTNAME" 6543 2>/dev/null; then
            echo -e "${GREEN}✅ TCP connection successful on port 6543 (pooler)${NC}"
            echo ""
            echo -e "${YELLOW}💡 Using connection pooler port. Update your DATABASE_URL:${NC}"
            POOLER_URL=$(echo "$DATABASE_URL" | sed "s/:$PORT\//:6543\//" | sed "s/$/&connection_limit=1&pgbouncer=true/")
            echo "   export DATABASE_URL=\"$POOLER_URL\""
            echo ""
        else
            echo -e "${RED}❌ Connection pooler port also failed${NC}"
        fi
    fi
    
    echo ""
    echo -e "${YELLOW}💡 Possible causes:${NC}"
    echo "   • Supabase project is paused/suspended"
    echo "   • Firewall blocking the connection"
    echo "   • Your IP is not whitelisted (check Supabase dashboard)"
    echo "   • Network restrictions"
    echo ""
    echo -e "${YELLOW}💡 Solutions:${NC}"
    echo "   1. Check Supabase project status: https://supabase.com/dashboard"
    echo "      - Go to your project"
    echo "      - Settings → General → Check if project is Active (not paused)"
    echo ""
    echo "   2. Check connection restrictions:"
    echo "      - Settings → Database → Connection pooling"
    echo "      - Ensure 'Allow connections from anywhere' or add your IP"
    echo ""
    echo "   3. Try connection pooler URL (port 6543):"
    if echo "$HOSTNAME" | grep -q "supabase.co"; then
        POOLER_URL=$(echo "$DATABASE_URL" | sed "s/:$PORT\//:6543\//" | sed "s/$/&connection_limit=1&pgbouncer=true/")
        echo "      export DATABASE_URL=\"$POOLER_URL\""
    fi
    echo ""
    echo "   4. Use local PostgreSQL for development:"
    echo "      ./scripts/setup-database.sh"
    echo ""
    
    # Continue to test PostgreSQL anyway, sometimes it works despite TCP test failure
    echo -e "${YELLOW}⚠️  Continuing with PostgreSQL test anyway...${NC}"
fi

echo ""
echo -e "${BLUE}🗄️  Testing PostgreSQL connection...${NC}"

# Test PostgreSQL connection
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT version();" >/dev/null 2>&1; then
        PG_VERSION=$(psql "$DATABASE_URL" -t -c "SELECT version();" 2>/dev/null | head -1 | cut -d' ' -f2 || echo "N/A")
        echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"
        echo "   Version: $PG_VERSION"
    else
        echo -e "${RED}❌ PostgreSQL connection failed${NC}"
        echo ""
        echo -e "${YELLOW}💡 Possible causes:${NC}"
        echo "   • Incorrect username or password"
        echo "   • Database doesn't exist"
        echo "   • SSL/TLS configuration issue"
        echo "   • IP not whitelisted (for Supabase)"
        echo ""
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  psql not found, skipping PostgreSQL connection test${NC}"
    echo "   Install PostgreSQL client: brew install postgresql"
fi

echo ""
echo -e "${GREEN}🎉 All connection checks passed!${NC}"
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo "   1. Run migrations: npm run migration:run"
echo "   2. Seed database (optional): npm run seed"
echo "   3. Start application: npm run start:dev"


