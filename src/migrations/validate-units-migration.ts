import { MigrationInterface, QueryRunner } from "typeorm";

export class ValidateUnitsMigration1700000000006 implements MigrationInterface {
    name = 'ValidateUnitsMigration1700000000006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Validate that all required tables exist
        const tables = await queryRunner.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('product_units', 'stock_movements', 'stock_items', 'businesses', 'users')
        `);
        
        const tableNames = tables.map((t: any) => t.table_name);
        const requiredTables = ['product_units', 'stock_movements', 'stock_items', 'businesses', 'users'];
        
        for (const table of requiredTables) {
            if (!tableNames.includes(table)) {
                throw new Error(`Required table '${table}' is missing`);
            }
        }

        // Validate product_units table structure
        const productUnitsColumns = await queryRunner.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'product_units' 
            AND table_schema = 'public'
        `);

        const requiredProductUnitsColumns = [
            'id', 'business_id', 'product_name', 'base_unit', 'purchase_unit', 
            'conversion_factor', 'purchase_price', 'selling_price', 'profit_margin', 
            'alert_threshold', 'created_at', 'updated_at'
        ];

        const existingColumns = productUnitsColumns.map((c: any) => c.column_name);
        for (const column of requiredProductUnitsColumns) {
            if (!existingColumns.includes(column)) {
                throw new Error(`Required column '${column}' is missing from product_units table`);
            }
        }

        // Validate stock_movements table structure
        const stockMovementsColumns = await queryRunner.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'stock_movements' 
            AND table_schema = 'public'
        `);

        const requiredStockMovementsColumns = [
            'id', 'business_id', 'product_name', 'movement_type', 'quantity', 
            'unit', 'base_quantity', 'unit_price', 'total_amount', 'previous_stock', 
            'new_stock', 'notes', 'created_by', 'created_at'
        ];

        const existingStockColumns = stockMovementsColumns.map((c: any) => c.column_name);
        for (const column of requiredStockMovementsColumns) {
            if (!existingStockColumns.includes(column)) {
                throw new Error(`Required column '${column}' is missing from stock_movements table`);
            }
        }

        // Validate constraints exist
        const constraints = await queryRunner.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints 
            WHERE table_name IN ('product_units', 'stock_movements')
            AND table_schema = 'public'
        `);

        const constraintNames = constraints.map((c: any) => c.constraint_name);
        const requiredConstraints = [
            'UQ_product_units_business_product',
            'CHK_product_units_conversion_factor',
            'CHK_stock_movements_movement_type',
            'FK_product_units_business',
            'FK_stock_movements_business',
            'FK_stock_movements_created_by'
        ];

        for (const constraint of requiredConstraints) {
            if (!constraintNames.includes(constraint)) {
                throw new Error(`Required constraint '${constraint}' is missing`);
            }
        }

        // Validate indexes exist
        const indexes = await queryRunner.query(`
            SELECT indexname
            FROM pg_indexes 
            WHERE tablename IN ('product_units', 'stock_movements')
            AND schemaname = 'public'
        `);

        const indexNames = indexes.map((i: any) => i.indexname);
        const requiredIndexes = [
            'IDX_product_units_business',
            'IDX_product_units_business_product',
            'IDX_stock_movements_business',
            'IDX_stock_movements_business_product',
            'IDX_stock_movements_business_date',
            'IDX_stock_movements_business_type'
        ];

        for (const index of requiredIndexes) {
            if (!indexNames.includes(index)) {
                throw new Error(`Required index '${index}' is missing`);
            }
        }

        // Validate stock_items has unit_price column
        const stockItemsColumns = await queryRunner.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'stock_items' 
            AND table_schema = 'public'
            AND column_name = 'unit_price'
        `);

        if (stockItemsColumns.length === 0) {
            throw new Error(`Required column 'unit_price' is missing from stock_items table`);
        }

        console.log('✅ All units migration validations passed successfully');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This is a validation migration, no rollback needed
        console.log('Validation migration rollback - no action required');
    }
}