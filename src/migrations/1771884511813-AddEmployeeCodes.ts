import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeeCodes1771884511813 implements MigrationInterface {
    name = 'AddEmployeeCodes1771884511813'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "employee_codes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "business_id" uuid NOT NULL,
                "code" character varying(6) NOT NULL,
                "created_by" uuid NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "used_by" character varying(20),
                "used_at" TIMESTAMP WITH TIME ZONE,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_employee_codes_code" UNIQUE ("code"),
                CONSTRAINT "PK_employee_codes" PRIMARY KEY ("id"),
                CONSTRAINT "FK_employee_codes_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_employee_codes_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_employee_codes_business_active" ON "employee_codes" ("business_id", "is_active")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_employee_codes_business_active"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "employee_codes"`);
    }
}
