import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnboardingFieldsToBusiness1772040000002 implements MigrationInterface {
  name = 'AddOnboardingFieldsToBusiness1772040000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "city" VARCHAR(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "activity_type" VARCHAR(50) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "preferred_channel" VARCHAR(20) NOT NULL DEFAULT 'whatsapp'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "preferred_channel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "activity_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "city"`,
    );
  }
}
