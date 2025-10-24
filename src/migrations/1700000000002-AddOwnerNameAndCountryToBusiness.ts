import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOwnerNameAndCountryToBusiness1700000000002 implements MigrationInterface {
    name = 'AddOwnerNameAndCountryToBusiness1700000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add owner_name column to businesses table
        await queryRunner.query(`
            ALTER TABLE "businesses" 
            ADD COLUMN "owner_name" character varying(100)
        `);

        // Add country column to businesses table
        await queryRunner.query(`
            ALTER TABLE "businesses" 
            ADD COLUMN "country" character varying(3)
        `);

        // Create index on country for better query performance
        await queryRunner.query(`
            CREATE INDEX "IDX_businesses_country" ON "businesses" ("country")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the index
        await queryRunner.query(`DROP INDEX "IDX_businesses_country"`);
        
        // Remove the added columns
        await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "country"`);
        await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "owner_name"`);
    }
}