#!/usr/bin/env node

/**
 * Script to identify popular products that should be configured with units
 * This helps merchants prioritize which products to configure first
 */

const { Client } = require('pg');
require('dotenv').config();

async function identifyPopularProducts() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('🔍 Analyzing product popularity for units configuration...\n');

        // Get products with high transaction volume
        const popularByTransactions = await client.query(`
            SELECT 
                t.business_id,
                b.business_name,
                t.product_name,
                COUNT(*) as transaction_count,
                SUM(t.quantity) as total_quantity_sold,
                AVG(t.quantity) as avg_quantity_per_transaction,
                MAX(t.created_at) as last_transaction_date,
                CASE 
                    WHEN pu.id IS NOT NULL THEN 'Configured'
                    ELSE 'Not Configured'
                END as units_status
            FROM transactions t
            JOIN businesses b ON t.business_id = b.id
            LEFT JOIN product_units pu ON t.business_id = pu.business_id AND t.product_name = pu.product_name
            WHERE t.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY t.business_id, b.business_name, t.product_name, pu.id
            HAVING COUNT(*) >= 5  -- At least 5 transactions in last 30 days
            ORDER BY transaction_count DESC, total_quantity_sold DESC
            LIMIT 50
        `);

        console.log('📊 TOP PRODUCTS BY TRANSACTION VOLUME (Last 30 days):');
        console.log('=' .repeat(80));
        console.log('Business'.padEnd(20) + 'Product'.padEnd(20) + 'Transactions'.padEnd(12) + 'Total Qty'.padEnd(10) + 'Avg Qty'.padEnd(8) + 'Units Status');
        console.log('-'.repeat(80));

        for (const row of popularByTransactions.rows) {
            const business = row.business_name.substring(0, 18).padEnd(20);
            const product = row.product_name.substring(0, 18).padEnd(20);
            const transactions = row.transaction_count.toString().padEnd(12);
            const totalQty = row.total_quantity_sold.toString().padEnd(10);
            const avgQty = parseFloat(row.avg_quantity_per_transaction).toFixed(1).padEnd(8);
            const status = row.units_status;
            
            console.log(`${business}${product}${transactions}${totalQty}${avgQty}${status}`);
        }

        // Get products with high stock levels (indicating bulk purchases)
        const highStockProducts = await client.query(`
            SELECT 
                si.business_id,
                b.business_name,
                si.product_name,
                si.quantity as current_stock,
                CASE 
                    WHEN pu.id IS NOT NULL THEN 'Configured'
                    ELSE 'Not Configured'
                END as units_status,
                pu.base_unit,
                pu.purchase_unit,
                pu.conversion_factor
            FROM stock_items si
            JOIN businesses b ON si.business_id = b.id
            LEFT JOIN product_units pu ON si.business_id = pu.business_id AND si.product_name = pu.product_name
            WHERE si.quantity >= 50  -- High stock levels suggest bulk purchasing
            ORDER BY si.quantity DESC
            LIMIT 30
        `);

        console.log('\n\n📦 PRODUCTS WITH HIGH STOCK LEVELS (Likely bulk purchases):');
        console.log('=' .repeat(80));
        console.log('Business'.padEnd(20) + 'Product'.padEnd(20) + 'Stock'.padEnd(10) + 'Units Status'.padEnd(15) + 'Configuration');
        console.log('-'.repeat(80));

        for (const row of highStockProducts.rows) {
            const business = row.business_name.substring(0, 18).padEnd(20);
            const product = row.product_name.substring(0, 18).padEnd(20);
            const stock = row.current_stock.toString().padEnd(10);
            const status = row.units_status.padEnd(15);
            const config = row.units_status === 'Configured' 
                ? `${row.purchase_unit}→${row.base_unit} (${row.conversion_factor}:1)`
                : 'None';
            
            console.log(`${business}${product}${stock}${status}${config}`);
        }

        // Suggest products that should be configured based on patterns
        const suggestions = await client.query(`
            WITH product_stats AS (
                SELECT 
                    t.business_id,
                    b.business_name,
                    t.product_name,
                    COUNT(*) as transaction_count,
                    SUM(t.quantity) as total_quantity,
                    AVG(t.quantity) as avg_quantity,
                    COALESCE(si.quantity, 0) as current_stock
                FROM transactions t
                JOIN businesses b ON t.business_id = b.id
                LEFT JOIN stock_items si ON t.business_id = si.business_id AND t.product_name = si.product_name
                WHERE t.created_at >= NOW() - INTERVAL '60 days'
                GROUP BY t.business_id, b.business_name, t.product_name, si.quantity
            )
            SELECT 
                ps.*,
                CASE 
                    WHEN pu.id IS NOT NULL THEN 'Already Configured'
                    ELSE 'Recommended for Configuration'
                END as recommendation,
                CASE 
                    WHEN ps.product_name ILIKE '%bière%' OR ps.product_name ILIKE '%beer%' THEN 'caisse/bouteille (24:1)'
                    WHEN ps.product_name ILIKE '%eau%' OR ps.product_name ILIKE '%water%' THEN 'carton/bouteille (12:1)'
                    WHEN ps.product_name ILIKE '%riz%' OR ps.product_name ILIKE '%rice%' THEN 'sac/kg (50:1)'
                    WHEN ps.product_name ILIKE '%savon%' OR ps.product_name ILIKE '%soap%' THEN 'carton/pièce (12:1)'
                    WHEN ps.product_name ILIKE '%huile%' OR ps.product_name ILIKE '%oil%' THEN 'carton/bouteille (12:1)'
                    ELSE 'carton/pièce (12:1)'
                END as suggested_config
            FROM product_stats ps
            LEFT JOIN product_units pu ON ps.business_id = pu.business_id AND ps.product_name = pu.product_name
            WHERE ps.transaction_count >= 3 
            AND (ps.current_stock >= 20 OR ps.total_quantity >= 50)
            AND pu.id IS NULL  -- Not yet configured
            ORDER BY ps.transaction_count DESC, ps.total_quantity DESC
            LIMIT 20
        `);

        console.log('\n\n💡 CONFIGURATION RECOMMENDATIONS:');
        console.log('=' .repeat(90));
        console.log('Business'.padEnd(20) + 'Product'.padEnd(20) + 'Trans.'.padEnd(8) + 'Stock'.padEnd(8) + 'Suggested Configuration');
        console.log('-'.repeat(90));

        for (const row of suggestions.rows) {
            const business = row.business_name.substring(0, 18).padEnd(20);
            const product = row.product_name.substring(0, 18).padEnd(20);
            const transactions = row.transaction_count.toString().padEnd(8);
            const stock = row.current_stock.toString().padEnd(8);
            const config = row.suggested_config;
            
            console.log(`${business}${product}${transactions}${stock}${config}`);
        }

        // Generate configuration commands
        console.log('\n\n📝 SUGGESTED WHATSAPP COMMANDS:');
        console.log('=' .repeat(60));
        
        for (const row of suggestions.rows.slice(0, 10)) {
            const [purchaseUnit, baseUnit, factor] = row.suggested_config.match(/(\w+)\/(\w+) \((\d+):1\)/).slice(1);
            console.log(`produit unité ${row.product_name} achat ${purchaseUnit} ${factor} ${baseUnit}`);
        }

        // Summary statistics
        const summary = await client.query(`
            SELECT 
                COUNT(DISTINCT si.business_id) as businesses_with_stock,
                COUNT(DISTINCT CONCAT(si.business_id, '-', si.product_name)) as total_products,
                COUNT(DISTINCT pu.id) as configured_products,
                COUNT(DISTINCT CONCAT(si.business_id, '-', si.product_name)) - COUNT(DISTINCT pu.id) as unconfigured_products
            FROM stock_items si
            LEFT JOIN product_units pu ON si.business_id = pu.business_id AND si.product_name = pu.product_name
            WHERE si.quantity > 0
        `);

        console.log('\n\n📈 SUMMARY STATISTICS:');
        console.log('=' .repeat(40));
        const stats = summary.rows[0];
        console.log(`Businesses with stock: ${stats.businesses_with_stock}`);
        console.log(`Total products in stock: ${stats.total_products}`);
        console.log(`Products with units configured: ${stats.configured_products}`);
        console.log(`Products needing configuration: ${stats.unconfigured_products}`);
        console.log(`Configuration coverage: ${((stats.configured_products / stats.total_products) * 100).toFixed(1)}%`);

    } catch (error) {
        console.error('❌ Error analyzing products:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run the analysis
if (require.main === module) {
    identifyPopularProducts()
        .then(() => {
            console.log('\n✅ Analysis completed successfully!');
            console.log('\n💡 Next steps:');
            console.log('1. Configure units for recommended products using WhatsApp commands');
            console.log('2. Set purchase prices: "prix achat [produit] [prix] [unité]"');
            console.log('3. Configure alerts: "alerte [produit] [seuil] [unité]"');
            console.log('4. Monitor usage and adjust configurations as needed');
        })
        .catch(error => {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = { identifyPopularProducts };