import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReceivablesTables1772010000000 implements MigrationInterface {
  name = 'CreateReceivablesTables1772010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "receivables" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "debtor_name" character varying(255) NOT NULL,
        "debtor_phone" character varying(50),
        "amount" numeric(12,2) NOT NULL,
        "amount_paid" numeric(12,2) NOT NULL DEFAULT 0,
        "currency" character varying(3) NOT NULL DEFAULT 'XOF',
        "description" text,
        "due_date" date,
        "status" character varying(20) NOT NULL DEFAULT 'open',
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_receivables" PRIMARY KEY ("id"),
        CONSTRAINT "FK_receivables_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_receivables_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_receivables_business" ON "receivables" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receivables_business_status" ON "receivables" ("business_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receivables_business_created" ON "receivables" ("business_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "receivable_payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "receivable_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "payment_date" date NOT NULL,
        "notes" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_receivable_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_receivable_payments_receivable" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_receivable_payments_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_receivable_payments_receivable" ON "receivable_payments" ("receivable_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_receivable_payments_receivable_created" ON "receivable_payments" ("receivable_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_receivable_payments_receivable_created"`);
    await queryRunner.query(`DROP INDEX "IDX_receivable_payments_receivable"`);
    await queryRunner.query(`DROP TABLE "receivable_payments"`);
    await queryRunner.query(`DROP INDEX "IDX_receivables_business_created"`);
    await queryRunner.query(`DROP INDEX "IDX_receivables_business_status"`);
    await queryRunner.query(`DROP INDEX "IDX_receivables_business"`);
    await queryRunner.query(`DROP TABLE "receivables"`);
  }
}
