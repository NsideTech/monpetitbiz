import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatMessagesTable1700000000006 implements MigrationInterface {
  name = 'CreateChatMessagesTable1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "business_id" uuid NOT NULL,
        "message" text NOT NULL,
        "response" text NOT NULL,
        "message_id" character varying(255) NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_messages_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_chat_messages_user_timestamp" ON "chat_messages" ("user_id", "timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_chat_messages_business_timestamp" ON "chat_messages" ("business_id", "timestamp")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_chat_messages_business_timestamp"`);
    await queryRunner.query(`DROP INDEX "IDX_chat_messages_user_timestamp"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
  }
}
