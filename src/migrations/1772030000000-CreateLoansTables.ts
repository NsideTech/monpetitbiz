import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoansTables1772030000000 implements MigrationInterface {
  name = 'CreateLoansTables1772030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "loans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "lender_name" character varying(255) NOT NULL,
        "lender_phone" character varying(50),
        "loan_type" character varying(20) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "amount_paid" numeric(12,2) NOT NULL DEFAULT 0,
        "currency" character varying(3) NOT NULL DEFAULT 'XOF',
        "description" text,
        "due_date" date NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'open',
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loans" PRIMARY KEY ("id"),
        CONSTRAINT "FK_loans_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_loans_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loans_business" ON "loans" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loans_business_status" ON "loans" ("business_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loans_business_created" ON "loans" ("business_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "loan_payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loan_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "payment_date" date NOT NULL,
        "notes" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loan_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_loan_payments_loan" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_loan_payments_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_payments_loan" ON "loan_payments" ("loan_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loan_payments_loan_created" ON "loan_payments" ("loan_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_loan_payments_loan_created"`);
    await queryRunner.query(`DROP INDEX "IDX_loan_payments_loan"`);
    await queryRunner.query(`DROP TABLE "loan_payments"`);
    await queryRunner.query(`DROP INDEX "IDX_loans_business_created"`);
    await queryRunner.query(`DROP INDEX "IDX_loans_business_status"`);
    await queryRunner.query(`DROP INDEX "IDX_loans_business"`);
    await queryRunner.query(`DROP TABLE "loans"`);
  }
}
