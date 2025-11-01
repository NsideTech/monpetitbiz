import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProductUnitsAndStockMovementsTables1700000000005 implements MigrationInterface {
    name = 'CreateProductUnitsAndStockMovementsTables1700000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create product_units table
        await queryRunner.query(`
            CREATE TABLE "product_units" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "business_id" uuid NOT NULL,
                "product_name" character varying(255) NOT NULL,
                "base_unit" character varying(50) NOT NULL DEFAULT 'pièce',
                "purchase_unit" character varying(50) NOT NULL,
                "conversion_factor" integer NOT NULL,
                "purchase_price" numeric(10,2),
                "selling_price" numeric(10,2),
                "profit_margin" numeric(5,2),
                "alert_threshold" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_units" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_product_units_business_product" UNIQUE ("business_id", "product_name"),
                CONSTRAINT "CHK_product_units_conversion_factor" CHECK ("conversion_factor" > 0),
                CONSTRAINT "FK_product_units_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
            )
        `);

        // Create stock_movements table
        await queryRunner.query(`
            CREATE TABLE "stock_movements" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "business_id" uuid NOT NULL,
                "product_name" character varying(255) NOT NULL,
                "movement_type" character varying(20) NOT NULL,
                "quantity" numeric(10,2) NOT NULL,
                "unit" character varying(50) NOT NULL,
                "base_quantity" numeric(10,2) NOT NULL,
                "unit_price" numeric(10,2),
                "total_amount" numeric(10,2),
                "previous_stock" numeric(10,2) NOT NULL,
                "new_stock" numeric(10,2) NOT NULL,
                "notes" text,
                "created_by" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_stock_movements_movement_type" CHECK ("movement_type" IN ('purchase', 'sale', 'adjustment', 'loss')),
                CONSTRAINT "FK_stock_movements_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_stock_movements_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
            )
        `);

        // Create indexes for product_units
        await queryRunner.query(`
            CREATE INDEX "IDX_product_units_business" ON "product_units" ("business_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_product_units_business_product" ON "product_units" ("business_id", "product_name")
        `);

        // Create indexes for stock_movements
        await queryRunner.query(`
            CREATE INDEX "IDX_stock_movements_business" ON "stock_movements" ("business_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_stock_movements_business_product" ON "stock_movements" ("business_id", "product_name")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_stock_movements_business_date" ON "stock_movements" ("business_id", "created_at")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_stock_movements_business_type" ON "stock_movements" ("business_id", "movement_type")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove indexes for stock_movements
        await queryRunner.query(`DROP INDEX "IDX_stock_movements_business_type"`);
        await queryRunner.query(`DROP INDEX "IDX_stock_movements_business_date"`);
        await queryRunner.query(`DROP INDEX "IDX_stock_movements_business_product"`);
        await queryRunner.query(`DROP INDEX "IDX_stock_movements_business"`);

        // Remove indexes for product_units
        await queryRunner.query(`DROP INDEX "IDX_product_units_business_product"`);
        await queryRunner.query(`DROP INDEX "IDX_product_units_business"`);

        // Remove tables
        await queryRunner.query(`DROP TABLE "stock_movements"`);
        await queryRunner.query(`DROP TABLE "product_units"`);
    }
}