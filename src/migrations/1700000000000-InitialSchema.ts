import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
    name = 'InitialSchema1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create businesses table
        await queryRunner.query(`
            CREATE TABLE "businesses" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying(255) NOT NULL,
                "currency" character varying(3) NOT NULL DEFAULT 'XOF',
                "timezone" character varying(50) NOT NULL DEFAULT 'Africa/Dakar',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_businesses" PRIMARY KEY ("id")
            )
        `);

        // Create users table
        await queryRunner.query(`
            CREATE TYPE "public"."users_role_enum" AS ENUM('owner', 'seller')
        `);
        
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "phone_number" character varying(20) NOT NULL,
                "business_id" uuid,
                "role" "public"."users_role_enum" NOT NULL,
                "language" character varying(5) NOT NULL DEFAULT 'fr',
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_phone_number" UNIQUE ("phone_number"),
                CONSTRAINT "PK_users" PRIMARY KEY ("id")
            )
        `);

        // Create transactions table
        await queryRunner.query(`
            CREATE TYPE "public"."transactions_type_enum" AS ENUM('sale', 'expense')
        `);
        
        await queryRunner.query(`
            CREATE TABLE "transactions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "business_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "type" "public"."transactions_type_enum" NOT NULL,
                "amount" numeric(12,2) NOT NULL,
                "currency" character varying(3) NOT NULL DEFAULT 'XOF',
                "product" character varying(255),
                "description" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
            )
        `);

        // Create stock_items table
        await queryRunner.query(`
            CREATE TABLE "stock_items" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "business_id" uuid NOT NULL,
                "product" character varying(255) NOT NULL,
                "quantity" integer NOT NULL DEFAULT 0,
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_stock_items_business_product" UNIQUE ("business_id", "product"),
                CONSTRAINT "PK_stock_items" PRIMARY KEY ("id")
            )
        `);

        // Create otp_sessions table
        await queryRunner.query(`
            CREATE TABLE "otp_sessions" (
                "phone_number" character varying(20) NOT NULL,
                "code" character varying(6) NOT NULL,
                "expires_at" TIMESTAMP NOT NULL,
                "attempts" integer NOT NULL DEFAULT 0,
                CONSTRAINT "PK_otp_sessions" PRIMARY KEY ("phone_number")
            )
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD CONSTRAINT "FK_users_business" 
            FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "transactions" 
            ADD CONSTRAINT "FK_transactions_business" 
            FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "transactions" 
            ADD CONSTRAINT "FK_transactions_user" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_items" 
            ADD CONSTRAINT "FK_stock_items_business" 
            FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        // Create performance indexes
        await queryRunner.query(`
            CREATE INDEX "IDX_transactions_business_date" ON "transactions" ("business_id", "created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_transactions_business_type" ON "transactions" ("business_id", "type")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_stock_items_business" ON "stock_items" ("business_id")
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_users_phone_number" ON "users" ("phone_number")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_users_phone_number"`);
        await queryRunner.query(`DROP INDEX "IDX_stock_items_business"`);
        await queryRunner.query(`DROP INDEX "IDX_transactions_business_type"`);
        await queryRunner.query(`DROP INDEX "IDX_transactions_business_date"`);

        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "stock_items" DROP CONSTRAINT "FK_stock_items_business"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_user"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_business"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_business"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "otp_sessions"`);
        await queryRunner.query(`DROP TABLE "stock_items"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "businesses"`);
    }
}