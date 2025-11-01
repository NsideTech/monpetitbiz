#!/usr/bin/env node

/**
 * Script to validate data integrity for the units management system
 * This script performs comprehensive checks to ensure data consistency
 */

const { Client } = require('pg');
require('dotenv').config();

class DataIntegrityValidator {
    constructor() {
        this.client = new Client({
            connectionString: process.env.DATABASE_URL
        });
        this.verbose = process.argv.includes('--verbose');
        this.fix = process.argv.includes('--fix');
        this.issues = [];
    }

    async connect() {
        await this.client.connect();
        console.log('🔗 Connected to database for integrity validation');
    }

    async disconnect() {
        await this.client.end();
        console.log('🔌 Disconnected from database');
    }

    log(message) {
        if (this.verbose) {
            console.log(message);
        }
    }

    addIssue(category, severity, description, count = 1, fixQuery = null) {
        this.issues.push({
            category,
            severity,
            description,
            count,
            fixQuery,
            timestamp: new Date().toISOString()
        });
    }

    async validateProductUnits() {
        console.log('🔍 Validating product_units table...');

        // Check for invalid conversion factors
        const invalidFactors = await this.client.query(`
            SELECT business_id, product_name, conversion_factor
            FROM product_units
            WHERE conversion_factor <= 0 OR conversion_factor > 10000
        `);

        if (invalidFactors.rows.length > 0) {
            this.addIssue(
                'product_units',
                'ERROR',
                'Invalid conversion factors (must be between 1 and 10000)',
                invalidFactors.rows.length,
                'UPDATE product_units SET conversion_factor = 1 WHERE conversion_factor <= 0 OR conversion_factor > 10000'
            );

            if (this.verbose) {
                console.log('   Invalid conversion factors found:');
                invalidFactors.rows.forEach(row => {
                    console.log(`     ${row.product_name}: ${row.conversion_factor}`);
                });
            }
        }

        // Check for negative prices
        const negativePrices = await this.client.query(`
            SELECT business_id, product_name, purchase_price, selling_price
            FROM product_units
            WHERE purchase_price < 0 OR selling_price < 0
        `);

        if (negativePrices.rows.length > 0) {
            this.addIssue(
                'product_units',
                'ERROR',
                'Negative prices found',
                negativePrices.rows.length,
                'UPDATE product_units SET purchase_price = NULL WHERE purchase_price < 0; UPDATE product_units SET selling_price = NULL WHERE selling_price < 0'
            );
        }

        // Check for invalid profit margins
        const invalidMargins = await this.client.query(`
            SELECT business_id, product_name, profit_margin
            FROM product_units
            WHERE profit_margin < 0 OR profit_margin > 1000
        `);

        if (invalidMargins.rows.length > 0) {
            this.addIssue(
                'product_units',
                'WARNING',
                'Unusual profit margins (outside 0-1000% range)',
                invalidMargins.rows.length
            );
        }

        // Check for duplicate configurations
        const duplicates = await this.client.query(`
            SELECT business_id, product_name, COUNT(*) as count
            FROM product_units
            GROUP BY business_id, product_name
            HAVING COUNT(*) > 1
        `);

        if (duplicates.rows.length > 0) {
            this.addIssue(
                'product_units',
                'ERROR',
                'Duplicate product unit configurations',
                duplicates.rows.length
            );
        }

        console.log(`   ✅ Product units validation completed`);
    }

    async validateStockMovements() {
        console.log('🔍 Validating stock_movements table...');

        // Check for movements with invalid types
        const invalidTypes = await this.client.query(`
            SELECT id, movement_type
            FROM stock_movements
            WHERE movement_type NOT IN ('purchase', 'sale', 'adjustment', 'loss')
        `);

        if (invalidTypes.rows.length > 0) {
            this.addIssue(
                'stock_movements',
                'ERROR',
                'Invalid movement types',
                invalidTypes.rows.length,
                'DELETE FROM stock_movements WHERE movement_type NOT IN (\'purchase\', \'sale\', \'adjustment\', \'loss\')'
            );
        }

        // Check for inconsistent quantity conversions
        const inconsistentConversions = await this.client.query(`
            SELECT sm.id, sm.product_name, sm.quantity, sm.unit, sm.base_quantity, 
                   pu.conversion_factor, pu.base_unit, pu.purchase_unit
            FROM stock_movements sm
            JOIN product_units pu ON sm.business_id = pu.business_id AND sm.product_name = pu.product_name
            WHERE (
                (sm.unit = pu.purchase_unit AND sm.base_quantity != sm.quantity * pu.conversion_factor)
                OR
                (sm.unit = pu.base_unit AND sm.base_quantity != sm.quantity)
            )
        `);

        if (inconsistentConversions.rows.length > 0) {
            this.addIssue(
                'stock_movements',
                'ERROR',
                'Inconsistent quantity conversions between units',
                inconsistentConversions.rows.length
            );

            if (this.verbose) {
                console.log('   Inconsistent conversions found:');
                inconsistentConversions.rows.slice(0, 5).forEach(row => {
                    console.log(`     ${row.product_name}: ${row.quantity} ${row.unit} -> ${row.base_quantity} (expected: ${row.unit === row.purchase_unit ? row.quantity * row.conversion_factor : row.quantity})`);
                });
            }
        }

        // Check for movements with zero or negative quantities
        const invalidQuantities = await this.client.query(`
            SELECT COUNT(*) as count
            FROM stock_movements
            WHERE quantity <= 0 OR base_quantity <= 0
        `);

        if (invalidQuantities.rows[0].count > 0) {
            this.addIssue(
                'stock_movements',
                'ERROR',
                'Movements with zero or negative quantities',
                parseInt(invalidQuantities.rows[0].count),
                'DELETE FROM stock_movements WHERE quantity <= 0 OR base_quantity <= 0'
            );
        }

        // Check for orphaned movements (no corresponding stock item)
        const orphanedMovements = await this.client.query(`
            SELECT COUNT(*) as count
            FROM stock_movements sm
            LEFT JOIN stock_items si ON sm.business_id = si.business_id AND sm.product_name = si.product_name
            WHERE si.id IS NULL
        `);

        if (orphanedMovements.rows[0].count > 0) {
            this.addIssue(
                'stock_movements',
                'WARNING',
                'Stock movements for products not in stock_items',
                parseInt(orphanedMovements.rows[0].count)
            );
        }

        console.log(`   ✅ Stock movements validation completed`);
    }

    async validateStockItems() {
        console.log('🔍 Validating stock_items table...');

        // Check for negative stock quantities
        const negativeStock = await this.client.query(`
            SELECT business_id, product_name, quantity
            FROM stock_items
            WHERE quantity < 0
        `);

        if (negativeStock.rows.length > 0) {
            this.addIssue(
                'stock_items',
                'WARNING',
                'Products with negative stock quantities',
                negativeStock.rows.length
            );

            if (this.verbose) {
                console.log('   Negative stock found:');
                negativeStock.rows.forEach(row => {
                    console.log(`     ${row.product_name}: ${row.quantity}`);
                });
            }
        }

        // Check for items with unit_price but no corresponding product_units
        const priceWithoutUnits = await this.client.query(`
            SELECT si.business_id, si.product_name, si.unit_price
            FROM stock_items si
            LEFT JOIN product_units pu ON si.business_id = pu.business_id AND si.product_name = pu.product_name
            WHERE si.unit_price IS NOT NULL AND pu.id IS NULL
        `);

        if (priceWithoutUnits.rows.length > 0) {
            this.addIssue(
                'stock_items',
                'INFO',
                'Items with unit prices but no units configuration',
                priceWithoutUnits.rows.length
            );
        }

        // Check for unreasonably high stock quantities (potential data entry errors)
        const highStock = await this.client.query(`
            SELECT business_id, product_name, quantity
            FROM stock_items
            WHERE quantity > 100000
        `);

        if (highStock.rows.length > 0) {
            this.addIssue(
                'stock_items',
                'WARNING',
                'Items with unusually high stock quantities (>100,000)',
                highStock.rows.length
            );
        }

        console.log(`   ✅ Stock items validation completed`);
    }

    async validateBusinessIntegrity() {
        console.log('🔍 Validating business data integrity...');

        // Check for product_units referencing non-existent businesses
        const invalidBusinessRefs = await this.client.query(`
            SELECT pu.business_id, COUNT(*) as count
            FROM product_units pu
            LEFT JOIN businesses b ON pu.business_id = b.id
            WHERE b.id IS NULL
            GROUP BY pu.business_id
        `);

        if (invalidBusinessRefs.rows.length > 0) {
            this.addIssue(
                'referential_integrity',
                'ERROR',
                'Product units referencing non-existent businesses',
                invalidBusinessRefs.rows.length,
                'DELETE FROM product_units WHERE business_id NOT IN (SELECT id FROM businesses)'
            );
        }

        // Check for stock_movements referencing non-existent users
        const invalidUserRefs = await this.client.query(`
            SELECT sm.created_by, COUNT(*) as count
            FROM stock_movements sm
            LEFT JOIN users u ON sm.created_by = u.id
            WHERE u.id IS NULL
            GROUP BY sm.created_by
        `);

        if (invalidUserRefs.rows.length > 0) {
            this.addIssue(
                'referential_integrity',
                'ERROR',
                'Stock movements referencing non-existent users',
                invalidUserRefs.rows.length
            );
        }

        console.log(`   ✅ Business integrity validation completed`);
    }

    async validateCalculatedFields() {
        console.log('🔍 Validating calculated fields and consistency...');

        // Check if stock balances match movement history
        const stockBalanceCheck = await this.client.query(`
            WITH movement_balances AS (
                SELECT 
                    business_id,
                    product_name,
                    SUM(CASE 
                        WHEN movement_type IN ('purchase', 'adjustment') THEN base_quantity
                        WHEN movement_type IN ('sale', 'loss') THEN -base_quantity
                        ELSE 0
                    END) as calculated_stock
                FROM stock_movements
                GROUP BY business_id, product_name
            )
            SELECT 
                si.business_id,
                si.product_name,
                si.quantity as current_stock,
                COALESCE(mb.calculated_stock, 0) as calculated_stock,
                ABS(si.quantity - COALESCE(mb.calculated_stock, 0)) as difference
            FROM stock_items si
            LEFT JOIN movement_balances mb ON si.business_id = mb.business_id AND si.product_name = mb.product_name
            WHERE ABS(si.quantity - COALESCE(mb.calculated_stock, 0)) > 0.01
        `);

        if (stockBalanceCheck.rows.length > 0) {
            this.addIssue(
                'calculated_fields',
                'WARNING',
                'Stock balances do not match movement history',
                stockBalanceCheck.rows.length
            );

            if (this.verbose) {
                console.log('   Stock balance mismatches found:');
                stockBalanceCheck.rows.slice(0, 5).forEach(row => {
                    console.log(`     ${row.product_name}: Current=${row.current_stock}, Calculated=${row.calculated_stock}, Diff=${row.difference}`);
                });
            }
        }

        // Check for price consistency
        const priceConsistency = await this.client.query(`
            SELECT 
                pu.business_id,
                pu.product_name,
                pu.purchase_price,
                pu.selling_price,
                pu.profit_margin,
                CASE 
                    WHEN pu.purchase_price > 0 AND pu.selling_price > 0 THEN
                        ROUND(((pu.selling_price - (pu.purchase_price / pu.conversion_factor)) / (pu.purchase_price / pu.conversion_factor)) * 100, 2)
                    ELSE NULL
                END as calculated_margin
            FROM product_units pu
            WHERE pu.purchase_price IS NOT NULL 
            AND pu.selling_price IS NOT NULL 
            AND pu.profit_margin IS NOT NULL
            AND ABS(pu.profit_margin - 
                ROUND(((pu.selling_price - (pu.purchase_price / pu.conversion_factor)) / (pu.purchase_price / pu.conversion_factor)) * 100, 2)
            ) > 1
        `);

        if (priceConsistency.rows.length > 0) {
            this.addIssue(
                'calculated_fields',
                'WARNING',
                'Profit margins do not match calculated values',
                priceConsistency.rows.length
            );
        }

        console.log(`   ✅ Calculated fields validation completed`);
    }

    async fixIssues() {
        if (!this.fix) {
            return;
        }

        console.log('🔧 Attempting to fix issues...');

        const fixableIssues = this.issues.filter(issue => issue.fixQuery && issue.severity === 'ERROR');
        
        for (const issue of fixableIssues) {
            try {
                console.log(`   Fixing: ${issue.description}`);
                await this.client.query(issue.fixQuery);
                console.log(`   ✅ Fixed ${issue.count} issues in ${issue.category}`);
            } catch (error) {
                console.error(`   ❌ Failed to fix ${issue.description}:`, error.message);
            }
        }
    }

    generateReport() {
        console.log('\n📊 DATA INTEGRITY REPORT');
        console.log('=' .repeat(60));

        const severityCounts = {
            ERROR: 0,
            WARNING: 0,
            INFO: 0
        };

        const categoryGroups = {};

        this.issues.forEach(issue => {
            severityCounts[issue.severity]++;
            
            if (!categoryGroups[issue.category]) {
                categoryGroups[issue.category] = [];
            }
            categoryGroups[issue.category].push(issue);
        });

        console.log(`Total issues found: ${this.issues.length}`);
        console.log(`  - Errors: ${severityCounts.ERROR}`);
        console.log(`  - Warnings: ${severityCounts.WARNING}`);
        console.log(`  - Info: ${severityCounts.INFO}`);
        console.log('');

        if (this.issues.length === 0) {
            console.log('🎉 No data integrity issues found! Your data is clean.');
            return;
        }

        Object.keys(categoryGroups).forEach(category => {
            console.log(`📋 ${category.toUpperCase()}:`);
            categoryGroups[category].forEach(issue => {
                const icon = issue.severity === 'ERROR' ? '❌' : issue.severity === 'WARNING' ? '⚠️' : 'ℹ️';
                console.log(`   ${icon} ${issue.description} (${issue.count} items)`);
            });
            console.log('');
        });

        if (severityCounts.ERROR > 0) {
            console.log('🚨 CRITICAL: Errors found that may affect system functionality');
            console.log('   Run with --fix flag to attempt automatic fixes');
        }

        if (severityCounts.WARNING > 0) {
            console.log('⚠️  WARNINGS: Issues that should be reviewed but may not break functionality');
        }
    }

    async run() {
        try {
            await this.connect();

            console.log('🔍 Starting comprehensive data integrity validation...');
            console.log(`Mode: ${this.fix ? 'FIX (will attempt to fix errors)' : 'CHECK ONLY'}`);
            console.log('');

            // Run all validations
            await this.validateProductUnits();
            await this.validateStockMovements();
            await this.validateStockItems();
            await this.validateBusinessIntegrity();
            await this.validateCalculatedFields();

            // Fix issues if requested
            if (this.fix) {
                await this.fixIssues();
            }

            // Generate report
            this.generateReport();

            console.log('\n✅ Data integrity validation completed');

        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            if (this.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }
}

// Run the validator
if (require.main === module) {
    const validator = new DataIntegrityValidator();
    validator.run().catch(error => {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
    });
}

module.exports = DataIntegrityValidator;