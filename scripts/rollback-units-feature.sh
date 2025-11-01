#!/bin/bash

# Rollback script for Units Management Feature
# This script safely removes all units-related database changes

set -e

echo "🔄 Starting Units Feature Rollback..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

# Load environment variables
if [ -f ".env" ]; then
    source .env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Function to execute SQL with error handling
execute_sql() {
    local sql="$1"
    local description="$2"
    
    echo "📝 $description..."
    
    if command -v psql >/dev/null 2>&1; then
        echo "$sql" | psql "$DATABASE_URL" || {
            echo "❌ Failed to execute: $description"
            return 1
        }
    else
        echo "⚠️  psql not found. Please execute manually:"
        echo "$sql"
        echo ""
        read -p "Press Enter after executing the above SQL manually..."
    fi
}

# Backup existing data before rollback
echo "💾 Creating backup of units data..."

BACKUP_DIR="backups/units-rollback-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup product_units data
execute_sql "COPY (SELECT * FROM product_units) TO STDOUT WITH CSV HEADER;" "Backing up product_units" > "$BACKUP_DIR/product_units_backup.csv" 2>/dev/null || echo "⚠️  Could not backup product_units (table may not exist)"

# Backup stock_movements data
execute_sql "COPY (SELECT * FROM stock_movements) TO STDOUT WITH CSV HEADER;" "Backing up stock_movements" > "$BACKUP_DIR/stock_movements_backup.csv" 2>/dev/null || echo "⚠️  Could not backup stock_movements (table may not exist)"

echo "📁 Backup saved to: $BACKUP_DIR"

# Start rollback process
echo "🗑️  Starting database rollback..."

# Remove indexes for stock_movements (if they exist)
execute_sql "DROP INDEX IF EXISTS IDX_stock_movements_business_type;" "Removing stock_movements type index"
execute_sql "DROP INDEX IF EXISTS IDX_stock_movements_business_date;" "Removing stock_movements date index"
execute_sql "DROP INDEX IF EXISTS IDX_stock_movements_business_product;" "Removing stock_movements product index"
execute_sql "DROP INDEX IF EXISTS IDX_stock_movements_business;" "Removing stock_movements business index"

# Remove indexes for product_units (if they exist)
execute_sql "DROP INDEX IF EXISTS IDX_product_units_business_product;" "Removing product_units business-product index"
execute_sql "DROP INDEX IF EXISTS IDX_product_units_business;" "Removing product_units business index"

# Remove foreign key constraints (if they exist)
execute_sql "ALTER TABLE IF EXISTS stock_movements DROP CONSTRAINT IF EXISTS FK_stock_movements_created_by;" "Removing stock_movements created_by FK"
execute_sql "ALTER TABLE IF EXISTS stock_movements DROP CONSTRAINT IF EXISTS FK_stock_movements_business;" "Removing stock_movements business FK"
execute_sql "ALTER TABLE IF EXISTS product_units DROP CONSTRAINT IF EXISTS FK_product_units_business;" "Removing product_units business FK"

# Remove check constraints (if they exist)
execute_sql "ALTER TABLE IF EXISTS stock_movements DROP CONSTRAINT IF EXISTS CHK_stock_movements_movement_type;" "Removing stock_movements movement_type check"
execute_sql "ALTER TABLE IF EXISTS product_units DROP CONSTRAINT IF EXISTS CHK_product_units_conversion_factor;" "Removing product_units conversion_factor check"

# Remove unique constraints (if they exist)
execute_sql "ALTER TABLE IF EXISTS product_units DROP CONSTRAINT IF EXISTS UQ_product_units_business_product;" "Removing product_units unique constraint"

# Drop tables (if they exist)
execute_sql "DROP TABLE IF EXISTS stock_movements;" "Removing stock_movements table"
execute_sql "DROP TABLE IF EXISTS product_units;" "Removing product_units table"

# Remove unit_price column from stock_items (if it exists)
execute_sql "ALTER TABLE stock_items DROP COLUMN IF EXISTS unit_price;" "Removing unit_price column from stock_items"

echo "✅ Database rollback completed successfully"

# Rollback TypeORM migrations
echo "🔄 Rolling back TypeORM migrations..."

# Check if TypeORM CLI is available
if npm list typeorm >/dev/null 2>&1; then
    echo "📝 Rolling back AddUnitPriceToStockItems migration..."
    npm run typeorm:migration:revert || echo "⚠️  Migration revert failed or already reverted"
    
    echo "📝 Rolling back CreateProductUnitsAndStockMovementsTables migration..."
    npm run typeorm:migration:revert || echo "⚠️  Migration revert failed or already reverted"
else
    echo "⚠️  TypeORM CLI not available. Migrations were rolled back manually via SQL."
fi

# Clean up migration files (optional - commented out for safety)
# echo "🧹 Cleaning up migration files..."
# rm -f src/migrations/1700000000005-CreateProductUnitsAndStockMovementsTables.ts
# rm -f src/migrations/add-unit-price-to-stock-items.ts
# rm -f src/migrations/validate-units-migration.ts

echo ""
echo "🎉 Units Feature Rollback Complete!"
echo ""
echo "📋 Summary:"
echo "  ✅ Database tables and constraints removed"
echo "  ✅ Indexes dropped"
echo "  ✅ Data backed up to: $BACKUP_DIR"
echo "  ✅ TypeORM migrations reverted"
echo ""
echo "⚠️  Note: Code files were not removed. You may want to:"
echo "  - Remove units-related service files"
echo "  - Remove units-related entity files"
echo "  - Remove units-related test files"
echo "  - Update WhatsApp command handlers"
echo ""
echo "🔄 To restore the feature later, you can:"
echo "  1. Re-run the migrations: npm run typeorm:migration:run"
echo "  2. Restore data from backup if needed"
echo ""

read -p "Press Enter to continue..."