import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessRoleIndexToUser1700000000003 implements MigrationInterface {
    name = 'AddBusinessRoleIndexToUser1700000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create composite index on business_id and role for efficient owner/employee queries
        await queryRunner.query(`
            CREATE INDEX "IDX_users_business_role" ON "users" ("business_id", "role")
        `);

        // Create index on role for efficient role-based queries
        await queryRunner.query(`
            CREATE INDEX "IDX_users_role" ON "users" ("role")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the indexes
        await queryRunner.query(`DROP INDEX "IDX_users_role"`);
        await queryRunner.query(`DROP INDEX "IDX_users_business_role"`);
    }
}