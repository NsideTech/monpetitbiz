import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuantityToTransactions1772000000000 implements MigrationInterface {
  name = 'AddQuantityToTransactions1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "quantity" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "quantity"`,
    );
  }
}
