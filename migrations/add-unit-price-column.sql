-- Migration: Add unit_price column to stock_items table
-- Date: 2025-11-01
-- Purpose: Enable simple price setting feature for products

-- Check if column already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'stock_items' 
        AND column_name = 'unit_price'
    ) THEN
        -- Add the unit_price column
        ALTER TABLE "stock_items" 
        ADD COLUMN "unit_price" numeric(10,2);
        
        RAISE NOTICE 'Column unit_price added successfully to stock_items table';
    ELSE
        RAISE NOTICE 'Column unit_price already exists in stock_items table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'stock_items' 
AND column_name = 'unit_price';

-- Show sample data (will show NULL for existing records)
SELECT 
    id,
    product,
    quantity,
    unit_price,
    updated_at
FROM stock_items
LIMIT 5;

