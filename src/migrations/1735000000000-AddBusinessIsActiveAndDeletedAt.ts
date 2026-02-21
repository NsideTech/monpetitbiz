import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessIsActiveAndDeletedAt1735000000000 implements MigrationInterface {
    name = 'AddBusinessIsActiveAndDeletedAt1735000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add is_active column to businesses table with default true (idempotent)
        await queryRunner.query(`
            ALTER TABLE "businesses" 
            ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true
        `);

        // Add deleted_at column to businesses table (nullable for soft delete, idempotent)
        await queryRunner.query(`
            ALTER TABLE "businesses" 
            ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the added columns
        await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "is_active"`);
    }
}

