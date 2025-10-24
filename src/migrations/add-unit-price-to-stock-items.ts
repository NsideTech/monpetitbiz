import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUnitPriceToStockItems1703000000000 implements MigrationInterface {
  name = 'AddUnitPriceToStockItems1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('stock_items', new TableColumn({
      name: 'unit_price',
      type: 'decimal',
      precision: 10,
      scale: 2,
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('stock_items', 'unit_price');
  }
}