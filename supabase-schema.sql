-- MonPetitBiz Database Schema for Supabase
-- Generated on 2025-10-28T22:15:42.557Z
-- This file contains all migrations converted to pure SQL

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- Migration: 1700000000000-InitialSchema
-- File: 1700000000000-InitialSchema.ts

CREATE TABLE "businesses" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying(255) NOT NULL,
                "currency" character varying(3) NOT NULL DEFAULT 'XOF',
                "timezone" character varying(50) NOT NULL DEFAULT 'Africa/Dakar',
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_businesses" PRIMARY KEY ("id")
            );

CREATE TYPE "public"."users_role_enum" AS ENUM('owner', 'seller');

CREATE TABLE "users" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "phone_number" character varying(20) NOT NULL,
    "business_id" uuid,
    "role" "public"."users_role_enum" NOT NULL,
    "language" character varying(5) NOT NULL DEFAULT 'fr',
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_users_phone_number" UNIQUE ("phone_number"),
    CONSTRAINT "PK_users" PRIMARY KEY ("id")
);

CREATE TYPE "public"."transactions_type_enum" AS ENUM('sale', 'expense');

CREATE TABLE "transactions" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "business_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "type" "public"."transactions_type_enum" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" character varying(3) NOT NULL DEFAULT 'XOF',
    "product" character varying(255),
    "description" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
);

CREATE TABLE "stock_items" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "business_id" uuid NOT NULL,
                "product" character varying(255) NOT NULL,
                "quantity" integer NOT NULL DEFAULT 0,
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_stock_items_business_product" UNIQUE ("business_id", "product"),
                CONSTRAINT "PK_stock_items" PRIMARY KEY ("id")
            );

CREATE TABLE "otp_sessions" (
                "phone_number" character varying(20) NOT NULL,
                "code" character varying(6) NOT NULL,
                "expires_at" timestamptz NOT NULL,
                "attempts" integer NOT NULL DEFAULT 0,
                CONSTRAINT "PK_otp_sessions" PRIMARY KEY ("phone_number")
            );

ALTER TABLE "users" 
            ADD CONSTRAINT "FK_users_business" 
            FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "transactions" 
ADD CONSTRAINT "FK_transactions_business" 
FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "transactions" 
ADD CONSTRAINT "FK_transactions_user" 
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "stock_items" 
ADD CONSTRAINT "FK_stock_items_business" 
FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX "IDX_transactions_business_date" ON "transactions" ("business_id", "created_at" DESC);

CREATE INDEX "IDX_transactions_business_type" ON "transactions" ("business_id", "type");

CREATE INDEX "IDX_stock_items_business" ON "stock_items" ("business_id");

-- Removed redundant unique index; constraint UQ_users_phone_number already enforces uniqueness


-- Migration: 1700000000001-AddBusinessCodeAndEmployeeName
-- File: 1700000000001-AddBusinessCodeAndEmployeeName.ts

ALTER TABLE "businesses" 
ADD COLUMN "business_code" character varying(6);

ALTER TABLE "businesses" 
ADD CONSTRAINT "UQ_businesses_business_code" UNIQUE ("business_code");

ALTER TABLE "users" 
ADD COLUMN "employee_name" character varying(100);

ALTER TABLE "users" 
ADD COLUMN "invited_by" uuid;

ALTER TABLE "users" 
ADD COLUMN "joined_at" timestamptz;

ALTER TYPE "public"."users_role_enum" ADD VALUE 'manager';


-- Migration: 1700000000002-AddOwnerNameAndCountryToBusiness
-- File: 1700000000002-AddOwnerNameAndCountryToBusiness.ts

ALTER TABLE "businesses" 
ADD COLUMN "owner_name" character varying(100);

ALTER TABLE "businesses" 
ADD COLUMN "country" character varying(3);

CREATE INDEX "IDX_businesses_country" ON "businesses" ("country");


-- Migration: 1700000000003-AddBusinessRoleIndexToUser
-- File: 1700000000003-AddBusinessRoleIndexToUser.ts

CREATE INDEX "IDX_users_business_role" ON "users" ("business_id", "role");

CREATE INDEX "IDX_users_role" ON "users" ("role");


-- Migration: 1700000000004-CreateConversationStatesTable
-- File: 1700000000004-CreateConversationStatesTable.ts

CREATE TABLE "conversation_states" (
                "phone_number" character varying(20) NOT NULL,
                "step" character varying(100) NOT NULL,
                "data" jsonb NOT NULL DEFAULT '{}',
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "expires_at" timestamptz NOT NULL,
                "timeout_warnings_sent" integer NOT NULL DEFAULT 0,
                "last_activity_at" timestamptz,
                CONSTRAINT "PK_conversation_states_phone_number" PRIMARY KEY ("phone_number")
            );

CREATE INDEX "IDX_conversation_states_expires_at" ON "conversation_states" ("expires_at");

CREATE INDEX "IDX_conversation_states_step" ON "conversation_states" ("step");


-- Migration: 1700000000005-CreateProductUnitsAndStockMovementsTables
-- File: 1700000000005-CreateProductUnitsAndStockMovementsTables.ts

CREATE TABLE "product_units" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "business_id" uuid NOT NULL,
                "product_name" character varying(255) NOT NULL,
                "base_unit" character varying(50) NOT NULL DEFAULT 'pièce',
                "purchase_unit" character varying(50) NOT NULL,
                "conversion_factor" integer NOT NULL,
                "purchase_price" numeric(10,2),
                "selling_price" numeric(10,2),
                "profit_margin" numeric(5,2),
                "alert_threshold" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_units" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_product_units_business_product" UNIQUE ("business_id", "product_name"),
                CONSTRAINT "CHK_product_units_conversion_factor" CHECK ("conversion_factor" > 0),
                CONSTRAINT "FK_product_units_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
            );

CREATE TABLE "stock_movements" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "business_id" uuid NOT NULL,
                "product_name" character varying(255) NOT NULL,
                "movement_type" character varying(20) NOT NULL,
                "quantity" numeric(10,2) NOT NULL,
                "unit" character varying(50) NOT NULL,
                "base_quantity" numeric(10,2) NOT NULL,
                "unit_price" numeric(10,2),
                "total_amount" numeric(10,2),
                "previous_stock" numeric(10,2) NOT NULL,
                "new_stock" numeric(10,2) NOT NULL,
                "notes" text,
                "created_by" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_stock_movements_movement_type" CHECK ("movement_type" IN ('purchase', 'sale', 'adjustment', 'loss')),
                CONSTRAINT "FK_stock_movements_business" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_stock_movements_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
            );

CREATE INDEX "IDX_product_units_business" ON "product_units" ("business_id");

CREATE INDEX "IDX_product_units_business_product" ON "product_units" ("business_id", "product_name");

CREATE INDEX "IDX_stock_movements_business" ON "stock_movements" ("business_id");

CREATE INDEX "IDX_stock_movements_business_product" ON "stock_movements" ("business_id", "product_name");

CREATE INDEX "IDX_stock_movements_business_date" ON "stock_movements" ("business_id", "created_at");

CREATE INDEX "IDX_stock_movements_business_type" ON "stock_movements" ("business_id", "movement_type");


-- Migration: add-unit-price-to-stock-items
-- File: add-unit-price-to-stock-items.ts

ALTER TABLE "stock_items" 
ADD COLUMN "unit_price" numeric(10,2);


-- Migration: validate-units-migration
-- File: validate-units-migration.ts

-- No SQL statements found in this migration


-- Ensure migrations table exists
CREATE TABLE IF NOT EXISTS migrations (
  id integer PRIMARY KEY,
  timestamp bigint NOT NULL,
  name text NOT NULL
);
-- Create indexes for better performance
DROP INDEX IF EXISTS idx_users_phone;
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business_id ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_items_business_id ON stock_items(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_id ON stock_movements(business_id);

-- Insert initial migration record
INSERT INTO migrations (id, timestamp, name) VALUES 
(1, 1700000000000, 'InitialSchema1700000000000'),
(2, 1700000000001, 'AddBusinessCodeAndEmployeeName1700000000001'),
(3, 1700000000002, 'AddOwnerNameAndCountryToBusiness1700000000002'),
(4, 1700000000003, 'AddBusinessRoleIndexToUser1700000000003'),
(5, 1700000000004, 'CreateConversationStatesTable1700000000004'),
(6, 1700000000005, 'CreateProductUnitsAndStockMovementsTables1700000000005'),
(7, 1703000000000, 'AddUnitPriceToStockItems1703000000000')
ON CONFLICT (id) DO NOTHING;

-- Verify schema
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Show migration status
SELECT * FROM migrations ORDER BY id;
