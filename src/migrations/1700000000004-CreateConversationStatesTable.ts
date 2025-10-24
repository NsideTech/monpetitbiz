import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateConversationStatesTable1700000000004 implements MigrationInterface {
    name = 'CreateConversationStatesTable1700000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create conversation_states table
        await queryRunner.query(`
            CREATE TABLE "conversation_states" (
                "phone_number" character varying(20) NOT NULL,
                "step" character varying(100) NOT NULL,
                "data" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "expires_at" TIMESTAMP NOT NULL,
                "timeout_warnings_sent" integer NOT NULL DEFAULT 0,
                "last_activity_at" TIMESTAMP,
                CONSTRAINT "PK_conversation_states_phone_number" PRIMARY KEY ("phone_number")
            )
        `);

        // Create index on expires_at for efficient cleanup
        await queryRunner.query(`
            CREATE INDEX "IDX_conversation_states_expires_at" ON "conversation_states" ("expires_at")
        `);

        // Create index on step for efficient queries
        await queryRunner.query(`
            CREATE INDEX "IDX_conversation_states_step" ON "conversation_states" ("step")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove indexes
        await queryRunner.query(`DROP INDEX "IDX_conversation_states_step"`);
        await queryRunner.query(`DROP INDEX "IDX_conversation_states_expires_at"`);
        
        // Remove table
        await queryRunner.query(`DROP TABLE "conversation_states"`);
    }
}