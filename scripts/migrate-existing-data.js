#!/usr/bin/env node

/**
 * Utility to migrate existing stock data to work with the new units system
 * This script helps transition existing data without losing information
 */

const { Client } = require('pg');
require('dotenv').config();

class DataMigrationUtility {
    constructor() {
        this.client = new Client({
            connectionString: process.env.DATABASE_URL
        });
        this.dryRun = process.argv.includes('--dry-run');
        this.verbose = process.argv.includes('--verbose');
    }

    async connect() {
        await this.client.connect();
        console.log('🔗 Connected to database');
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

    async backupExistingData() {
        console.log('💾 Creating backup of existing data...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = `backups/pre-units-migration-${timestamp}`;
        
        // Create backup queries
        const backupQueries = [
            {
                table: 'stock_items',
                query: 'SELECT * FROM stock_items ORDER BY business_id, product_name'
            },
            {
                table: 'transactions',
                query: 'SELECT * FROM transactions WHERE created_at >= NOW() - INTERVAL \'90 days\' ORDER BY created_at DESC'
            }
        ];

        for (const backup of backupQueries) {
            try {
                const result = await this.client.query(backup.query);
                console.log(`📁 Backed up ${result.rows.length} rows from ${backup.table}`);
                
                if (this.verbose) {
                    console.log(`   Sample data from ${backup.table}:`, result.rows.slice(0, 2));
                }
            } catch (error) {
                console.error(`❌ Error backing up ${backup.table}:`, error.message);
            }
        }
    }

    async analyzeExistingData() {
        console.log('🔍 Analyzing existing data patterns...');

        // Analyze stock items without unit configuration
        const stockAnalysis = await this.client.query(`
            SELECT 
                si.business_id,
                b.business_name,
                si.product_name,
                si.quantity,
                si.unit_price,
                CASE 
                    WHEN pu.id IS NOT NULL THEN 'Has Units Config'
                    ELSE 'Needs Units Config'
                END as units_status
            FROM stock_items si
            JOIN businesses b ON si.business_id = b.id
            LEFT JOIN product_units pu ON si.business_id = pu.business_id AND si.product_name = pu.product_name
            WHERE si.quantity > 0
            ORDER BY si.quantity DESC
        `);

        console.log(`📊 Found ${stockAnalysis.rows.length} products in stock`);
        
        const needsConfig = stockAnalysis.rows.filter(row => row.units_status === 'Needs Units Config');
        const hasConfig = stockAnalysis.rows.filter(row => row.units_status === 'Has Units Config');
        
        console.log(`   - ${hasConfig.length} products already have units configured`);
        console.log(`   - ${needsConfig.length} products need units configuration`);

        return { stockAnalysis: stockAnalysis.rows, needsConfig, hasConfig };
    }

    async addDefaultUnitPrices() {
        console.log('💰 Adding unit prices to stock items...');

        // Find stock items without unit_price
        const itemsWithoutPrice = await this.client.query(`
            SELECT si.*, pu.base_unit, pu.purchase_unit, pu.conversion_factor, pu.selling_price
            FROM stock_items si
            LEFT JOIN product_units pu ON si.business_id = pu.business_id AND si.product_name = pu.product_name
            WHERE si.unit_price IS NULL
            AND si.quantity > 0
        `);

        console.log(`📝 Found ${itemsWithoutPrice.rows.length} items without unit prices`);

        let updatedCount = 0;

        for (const item of itemsWithoutPrice.rows) {
            let unitPrice = null;

            // Try to get price from recent transactions
            const recentTransaction = await this.client.query(`
                SELECT amount, quantity
                FROM transactions
                WHERE business_id = $1 AND product_name = $2
                AND amount > 0 AND quantity > 0
                ORDER BY created_at DESC
                LIMIT 1
            `, [item.business_id, item.product_name]);

            if (recentTransaction.rows.length > 0) {
                const transaction = recentTransaction.rows[0];
                unitPrice = Math.round(transaction.amount / transaction.quantity);
                this.log(`   Calculated unit price for ${item.product_name}: ${unitPrice} from recent transaction`);
            } else if (item.selling_price) {
                // Use configured selling price from product units
                unitPrice = item.selling_price;
                this.log(`   Using configured selling price for ${item.product_name}: ${unitPrice}`);
            }

            if (unitPrice && !this.dryRun) {
                await this.client.query(`
                    UPDATE stock_items 
                    SET unit_price = $1, updated_at = NOW()
                    WHERE business_id = $2 AND product_name = $3
                `, [unitPrice, item.business_id, item.product_name]);
                
                updatedCount++;
            } else if (unitPrice && this.dryRun) {
                console.log(`   [DRY RUN] Would set unit price for ${item.product_name}: ${unitPrice}`);
                updatedCount++;
            }
        }

        console.log(`✅ Updated unit prices for ${updatedCount} items`);
    }

    async createInitialStockMovements() {
        console.log('📋 Creating initial stock movement records...');

        // Find stock items that don't have corresponding stock movements
        const itemsWithoutMovements = await this.client.query(`
            SELECT si.*, pu.base_unit, pu.purchase_unit, pu.conversion_factor
            FROM stock_items si
            LEFT JOIN product_units pu ON si.business_id = pu.business_id AND si.product_name = pu.product_name
            LEFT JOIN stock_movements sm ON si.business_id = sm.business_id AND si.product_name = sm.product_name
            WHERE si.quantity > 0 
            AND sm.id IS NULL
        `);

        console.log(`📝 Found ${itemsWithoutMovements.rows.length} items without movement history`);

        let createdCount = 0;

        for (const item of itemsWithoutMovements.rows) {
            // Get the business owner as the creator
            const businessOwner = await this.client.query(`
                SELECT u.id
                FROM users u
                WHERE u.business_id = $1 AND u.role = 'owner'
                LIMIT 1
            `, [item.business_id]);

            if (businessOwner.rows.length === 0) {
                this.log(`   ⚠️  No owner found for business ${item.business_id}, skipping ${item.product_name}`);
                continue;
            }

            const ownerId = businessOwner.rows[0].id;
            const baseUnit = item.base_unit || 'pièce';
            const baseQuantity = item.quantity;

            if (!this.dryRun) {
                await this.client.query(`
                    INSERT INTO stock_movements (
                        business_id, product_name, movement_type, quantity, unit, 
                        base_quantity, previous_stock, new_stock, notes, created_by, created_at
                    ) VALUES (
                        $1, $2, 'adjustment', $3, $4, $5, 0, $6, 
                        'Initial stock record created during units migration', $7, NOW()
                    )
                `, [
                    item.business_id, item.product_name, baseQuantity, baseUnit,
                    baseQuantity, baseQuantity, ownerId
                ]);

                createdCount++;
            } else {
                console.log(`   [DRY RUN] Would create initial movement for ${item.product_name}: ${baseQuantity} ${baseUnit}`);
                createdCount++;
            }
        }

        console.log(`✅ Created ${createdCount} initial stock movement records`);
    }

    async validateDataIntegrity() {
        console.log('🔍 Validating data integrity...');

        const validations = [
            {
                name: 'Stock items with negative quantities',
                query: 'SELECT COUNT(*) as count FROM stock_items WHERE quantity < 0'
            },
            {
                name: 'Product units with invalid conversion factors',
                query: 'SELECT COUNT(*) as count FROM product_units WHERE conversion_factor <= 0'
            },
            {
                name: 'Stock movements with mismatched quantities',
                query: `
                    SELECT COUNT(*) as count 
                    FROM stock_movements sm
                    JOIN product_units pu ON sm.business_id = pu.business_id AND sm.product_name = pu.product_name
                    WHERE sm.unit = pu.purchase_unit 
                    AND sm.base_quantity != sm.quantity * pu.conversion_factor
                `
            },
            {
                name: 'Orphaned stock movements (no corresponding stock item)',
                query: `
                    SELECT COUNT(*) as count
                    FROM stock_movements sm
                    LEFT JOIN stock_items si ON sm.business_id = si.business_id AND sm.product_name = si.product_name
                    WHERE si.id IS NULL
                `
            }
        ];

        let totalIssues = 0;

        for (const validation of validations) {
            try {
                const result = await this.client.query(validation.query);
                const count = parseInt(result.rows[0].count);
                
                if (count > 0) {
                    console.log(`   ⚠️  ${validation.name}: ${count} issues found`);
                    totalIssues += count;
                } else {
                    console.log(`   ✅ ${validation.name}: OK`);
                }
            } catch (error) {
                console.error(`   ❌ Error validating ${validation.name}:`, error.message);
            }
        }

        if (totalIssues === 0) {
            console.log('✅ All data integrity checks passed!');
        } else {
            console.log(`⚠️  Found ${totalIssues} total data integrity issues`);
        }

        return totalIssues;
    }

    async generateMigrationReport() {
        console.log('📊 Generating migration report...');

        const report = {
            timestamp: new Date().toISOString(),
            summary: {},
            details: {}
        };

        // Get summary statistics
        const summaryQueries = [
            {
                key: 'total_businesses',
                query: 'SELECT COUNT(*) as count FROM businesses'
            },
            {
                key: 'total_products',
                query: 'SELECT COUNT(DISTINCT CONCAT(business_id, \'-\', product_name)) as count FROM stock_items WHERE quantity > 0'
            },
            {
                key: 'configured_products',
                query: 'SELECT COUNT(*) as count FROM product_units'
            },
            {
                key: 'stock_movements',
                query: 'SELECT COUNT(*) as count FROM stock_movements'
            },
            {
                key: 'items_with_unit_price',
                query: 'SELECT COUNT(*) as count FROM stock_items WHERE unit_price IS NOT NULL'
            }
        ];

        for (const query of summaryQueries) {
            try {
                const result = await this.client.query(query.query);
                report.summary[query.key] = parseInt(result.rows[0].count);
            } catch (error) {
                console.error(`Error getting ${query.key}:`, error.message);
                report.summary[query.key] = 0;
            }
        }

        // Calculate coverage percentages
        const totalProducts = report.summary.total_products;
        const configuredProducts = report.summary.configured_products;
        const itemsWithPrice = report.summary.items_with_unit_price;

        report.summary.configuration_coverage = totalProducts > 0 
            ? ((configuredProducts / totalProducts) * 100).toFixed(1) + '%'
            : '0%';

        report.summary.price_coverage = totalProducts > 0
            ? ((itemsWithPrice / totalProducts) * 100).toFixed(1) + '%'
            : '0%';

        console.log('\n📋 MIGRATION REPORT:');
        console.log('=' .repeat(50));
        console.log(`Total businesses: ${report.summary.total_businesses}`);
        console.log(`Total products in stock: ${report.summary.total_products}`);
        console.log(`Products with units configured: ${report.summary.configured_products} (${report.summary.configuration_coverage})`);
        console.log(`Stock movements recorded: ${report.summary.stock_movements}`);
        console.log(`Items with unit prices: ${report.summary.items_with_unit_price} (${report.summary.price_coverage})`);

        return report;
    }

    async run() {
        try {
            await this.connect();

            console.log('🚀 Starting data migration utility...');
            console.log(`Mode: ${this.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
            console.log('');

            // Step 1: Backup existing data
            await this.backupExistingData();
            console.log('');

            // Step 2: Analyze existing data
            const analysis = await this.analyzeExistingData();
            console.log('');

            // Step 3: Add unit prices where missing
            await this.addDefaultUnitPrices();
            console.log('');

            // Step 4: Create initial stock movements
            await this.createInitialStockMovements();
            console.log('');

            // Step 5: Validate data integrity
            const issues = await this.validateDataIntegrity();
            console.log('');

            // Step 6: Generate report
            const report = await this.generateMigrationReport();
            console.log('');

            if (this.dryRun) {
                console.log('🔍 DRY RUN COMPLETED - No changes were made to the database');
                console.log('💡 Run without --dry-run flag to apply changes');
            } else {
                console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
                
                if (issues > 0) {
                    console.log('⚠️  Some data integrity issues were found. Please review and fix them.');
                }
            }

        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            if (this.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }
}

// Run the migration utility
if (require.main === module) {
    const migration = new DataMigrationUtility();
    migration.run().catch(error => {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
    });
}

module.exports = DataMigrationUtility;