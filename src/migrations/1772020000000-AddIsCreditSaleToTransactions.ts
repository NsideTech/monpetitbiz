import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsCreditSaleToTransactions1772020000000 implements MigrationInterface {
  name = 'AddIsCreditSaleToTransactions1772020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "is_credit_sale" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "is_credit_sale"`,
    );
  }
}
