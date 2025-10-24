import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessCodeAndEmployeeName1700000000001 implements MigrationInterface {
    name = 'AddBusinessCodeAndEmployeeName1700000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add businessCode column to businesses table
        await queryRunner.query(`
            ALTER TABLE "businesses" 
            ADD COLUMN "business_code" character varying(6) NOT NULL DEFAULT ''
        `);

        // Add unique constraint to business_code
        await queryRunner.query(`
            ALTER TABLE "businesses" 
            ADD CONSTRAINT "UQ_businesses_business_code" UNIQUE ("business_code")
        `);

        // Add employeeName column to users table
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "employee_name" character varying(100)
        `);

        // Add invited_by and joined_at columns if they don't exist (from the entity but not in initial migration)
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "invited_by" uuid
        `);

        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "joined_at" TIMESTAMP
        `);

        // Update the users_role_enum to include 'manager'
        await queryRunner.query(`
            ALTER TYPE "public"."users_role_enum" ADD VALUE 'manager'
        `);

        // Remove the default empty string from business_code after adding the constraint
        await queryRunner.query(`
            ALTER TABLE "businesses" 
            ALTER COLUMN "business_code" DROP DEFAULT
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the added columns
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "joined_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "invited_by"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "employee_name"`);

        // Remove unique constraint and business_code column
        await queryRunner.query(`ALTER TABLE "businesses" DROP CONSTRAINT "UQ_businesses_business_code"`);
        await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "business_code"`);

        // Note: PostgreSQL doesn't support removing enum values, so we can't easily revert the role enum change
        // In a production environment, you might need to recreate the enum type
    }
}