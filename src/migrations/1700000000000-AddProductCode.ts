import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddProductCode1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajouter la colonne product_code
    await queryRunner.addColumn('stock_items', new TableColumn({
      name: 'product_code',
      type: 'varchar',
      length: '50',
      isNullable: true,
    }));

    // Créer un index pour (business_id, product_code)
    await queryRunner.createIndex('stock_items', new TableIndex({
      name: 'IDX_stock_items_business_product_code',
      columnNames: ['business_id', 'product_code'],
    }));

    // Créer une contrainte d'unicité pour (business_id, product_code)
    // Note: Seuls les produits avec un code non-null seront concernés
    await queryRunner.query(`
      CREATE UNIQUE INDEX IDX_stock_items_business_product_code_unique 
      ON stock_items (business_id, product_code) 
      WHERE product_code IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer l'index d'unicité
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_stock_items_business_product_code_unique
    `);
    
    // Supprimer l'index
    await queryRunner.dropIndex('stock_items', 'IDX_stock_items_business_product_code');
    
    // Supprimer la colonne
    await queryRunner.dropColumn('stock_items', 'product_code');
  }
}

