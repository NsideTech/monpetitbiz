import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDailyGoals1772040000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id),
        target_amount DECIMAL(12,2) NOT NULL,
        day_of_week INTEGER NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_daily_goals_business"
        ON daily_goals(business_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_daily_goals_active"
        ON daily_goals(business_id, is_active, day_of_week)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS daily_goals`);
  }
}
