-- Reference data setup for Units Management Feature
-- This script adds common unit configurations and reference data

-- Common unit types that can be used as reference
-- Note: These are examples - actual data will be configured by merchants

-- Create a reference table for common units (optional)
CREATE TABLE IF NOT EXISTS unit_types_reference (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    unit_name VARCHAR(50) NOT NULL,
    unit_name_fr VARCHAR(50) NOT NULL,
    typical_conversion_factor INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert common unit types for reference
INSERT INTO unit_types_reference (category, unit_name, unit_name_fr, typical_conversion_factor, description) VALUES
-- Beverages
('beverages', 'bottle', 'bouteille', 1, 'Individual bottle unit'),
('beverages', 'case', 'caisse', 24, 'Standard case of 24 bottles'),
('beverages', 'crate', 'casier', 12, 'Crate of 12 bottles'),
('beverages', 'pack', 'pack', 6, 'Pack of 6 bottles'),

-- Food items
('food', 'piece', 'pièce', 1, 'Individual piece'),
('food', 'bag', 'sac', 50, 'Standard bag (e.g., rice, flour)'),
('food', 'box', 'boîte', 12, 'Standard box'),
('food', 'carton', 'carton', 24, 'Standard carton'),

-- Household items
('household', 'piece', 'pièce', 1, 'Individual item'),
('household', 'dozen', 'douzaine', 12, 'Dozen items'),
('household', 'pack', 'paquet', 10, 'Standard pack'),

-- Textiles
('textiles', 'piece', 'pièce', 1, 'Individual item'),
('textiles', 'bundle', 'ballot', 20, 'Bundle of items'),

-- Electronics
('electronics', 'piece', 'pièce', 1, 'Individual item'),
('electronics', 'box', 'boîte', 6, 'Standard box'),

-- Cosmetics
('cosmetics', 'piece', 'pièce', 1, 'Individual item'),
('cosmetics', 'set', 'ensemble', 3, 'Set of items'),
('cosmetics', 'dozen', 'douzaine', 12, 'Dozen items');

-- Create indexes for reference table
CREATE INDEX IF NOT EXISTS idx_unit_types_category ON unit_types_reference(category);
CREATE INDEX IF NOT EXISTS idx_unit_types_unit_name ON unit_types_reference(unit_name);

-- Add helpful comments
COMMENT ON TABLE unit_types_reference IS 'Reference table for common unit types to help merchants configure their products';
COMMENT ON COLUMN unit_types_reference.category IS 'Product category (beverages, food, household, etc.)';
COMMENT ON COLUMN unit_types_reference.unit_name IS 'Unit name in English';
COMMENT ON COLUMN unit_types_reference.unit_name_fr IS 'Unit name in French';
COMMENT ON COLUMN unit_types_reference.typical_conversion_factor IS 'Typical conversion factor for this unit type';
COMMENT ON COLUMN unit_types_reference.description IS 'Description of the unit type';

-- Add helpful views for common queries
CREATE OR REPLACE VIEW common_beverage_units AS
SELECT unit_name, unit_name_fr, typical_conversion_factor, description
FROM unit_types_reference 
WHERE category = 'beverages'
ORDER BY typical_conversion_factor;

CREATE OR REPLACE VIEW common_food_units AS
SELECT unit_name, unit_name_fr, typical_conversion_factor, description
FROM unit_types_reference 
WHERE category = 'food'
ORDER BY typical_conversion_factor;

-- Function to get suggested units for a category
CREATE OR REPLACE FUNCTION get_suggested_units(category_name VARCHAR(50))
RETURNS TABLE(
    unit_name VARCHAR(50),
    unit_name_fr VARCHAR(50),
    typical_conversion_factor INTEGER,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        utr.unit_name,
        utr.unit_name_fr,
        utr.typical_conversion_factor,
        utr.description
    FROM unit_types_reference utr
    WHERE utr.category = category_name
    ORDER BY utr.typical_conversion_factor;
END;
$$ LANGUAGE plpgsql;

-- Function to validate conversion factors
CREATE OR REPLACE FUNCTION validate_conversion_factor(factor INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    -- Conversion factor must be positive and reasonable (between 1 and 10000)
    RETURN factor > 0 AND factor <= 10000;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a product has units configured
CREATE OR REPLACE FUNCTION has_units_configured(business_uuid UUID, product_name_param VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    unit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unit_count
    FROM product_units
    WHERE business_id = business_uuid AND product_name = product_name_param;
    
    RETURN unit_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments to main tables
COMMENT ON TABLE product_units IS 'Configuration of units for products - allows merchants to define purchase and selling units';
COMMENT ON COLUMN product_units.base_unit IS 'The smallest unit in which the product is sold (e.g., bouteille, pièce)';
COMMENT ON COLUMN product_units.purchase_unit IS 'The unit in which the product is purchased (e.g., caisse, carton)';
COMMENT ON COLUMN product_units.conversion_factor IS 'Number of base units in one purchase unit (e.g., 24 bottles per case)';
COMMENT ON COLUMN product_units.purchase_price IS 'Price paid per purchase unit';
COMMENT ON COLUMN product_units.selling_price IS 'Recommended selling price per base unit';
COMMENT ON COLUMN product_units.profit_margin IS 'Profit margin percentage';
COMMENT ON COLUMN product_units.alert_threshold IS 'Stock alert threshold in purchase units';

COMMENT ON TABLE stock_movements IS 'Historical record of all stock movements with unit information';
COMMENT ON COLUMN stock_movements.movement_type IS 'Type of movement: purchase, sale, adjustment, or loss';
COMMENT ON COLUMN stock_movements.quantity IS 'Quantity in the unit specified';
COMMENT ON COLUMN stock_movements.unit IS 'Unit used for this specific movement';
COMMENT ON COLUMN stock_movements.base_quantity IS 'Quantity converted to base unit for consistency';
COMMENT ON COLUMN stock_movements.previous_stock IS 'Stock level before this movement (in base units)';
COMMENT ON COLUMN stock_movements.new_stock IS 'Stock level after this movement (in base units)';

-- Create a view for stock movements with unit information
CREATE OR REPLACE VIEW stock_movements_with_units AS
SELECT 
    sm.*,
    pu.base_unit,
    pu.purchase_unit,
    pu.conversion_factor,
    CASE 
        WHEN sm.unit = pu.base_unit THEN sm.quantity
        WHEN sm.unit = pu.purchase_unit THEN sm.quantity * pu.conversion_factor
        ELSE sm.base_quantity
    END as normalized_base_quantity
FROM stock_movements sm
LEFT JOIN product_units pu ON sm.business_id = pu.business_id AND sm.product_name = pu.product_name;

COMMENT ON VIEW stock_movements_with_units IS 'Stock movements with associated unit configuration for easier reporting';

-- Success message
SELECT 'Units reference data setup completed successfully!' as status;