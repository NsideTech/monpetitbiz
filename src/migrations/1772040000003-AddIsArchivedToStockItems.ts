import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsArchivedToStockItems1772040000003 implements MigrationInterface {
  name = 'AddIsArchivedToStockItems1772040000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_items" DROP COLUMN IF EXISTS "is_archived"`,
    );
  }
}
