import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodToTransactions1772040000000 implements MigrationInterface {
  name = 'AddPaymentMethodToTransactions1772040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(20) NOT NULL DEFAULT 'cash'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "payment_method"`,
    );
  }
}
