#!/usr/bin/env node

/**
 * MonPetitBiz - Supabase SQL Generator
 * Generates a complete SQL file from TypeORM migrations for Supabase
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Generating Supabase SQL from TypeORM migrations...');

const migrationsDir = path.join(__dirname, '../src/migrations');
const outputFile = path.join(__dirname, '../supabase-schema.sql');

// Header for the SQL file
let sqlContent = `-- MonPetitBiz Database Schema for Supabase
-- Generated on ${new Date().toISOString()}
-- This file contains all migrations converted to pure SQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

`;

// Function to extract SQL from TypeORM migration files
function extractSQLFromMigration(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sqlStatements = [];
    
    // Extract SQL from queryRunner.query() calls
    const queryRegex = /await queryRunner\.query\(`([^`]+)`\);/g;
    let match;
    
    while ((match = queryRegex.exec(content)) !== null) {
        let sql = match[1];
        
        // Clean up the SQL
        sql = sql.replace(/\\n/g, '\n');
        sql = sql.replace(/\\"/g, '"');
        sql = sql.trim();
        
        if (sql && !sql.includes('SELECT') && !sql.includes('DROP')) {
            sqlStatements.push(sql);
        }
    }
    
    return sqlStatements;
}

// Read all migration files
const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.ts'))
    .sort();

console.log(`📁 Found ${migrationFiles.length} migration files`);

migrationFiles.forEach(file => {
    console.log(`📄 Processing ${file}...`);
    
    const filePath = path.join(migrationsDir, file);
    const migrationName = file.replace('.ts', '');
    
    sqlContent += `\n-- Migration: ${migrationName}\n`;
    sqlContent += `-- File: ${file}\n\n`;
    
    try {
        const sqlStatements = extractSQLFromMigration(filePath);
        
        if (sqlStatements.length > 0) {
            sqlStatements.forEach(sql => {
                sqlContent += sql + ';\n\n';
            });
        } else {
            sqlContent += '-- No SQL statements found in this migration\n\n';
        }
    } catch (error) {
        console.warn(`⚠️ Warning: Could not process ${file}: ${error.message}`);
        sqlContent += `-- Error processing this migration: ${error.message}\n\n`;
    }
});

// Add some useful post-migration queries
sqlContent += `
-- Post-migration setup
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
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
`;

// Write the SQL file
fs.writeFileSync(outputFile, sqlContent);

console.log(`✅ SQL file generated: ${outputFile}`);
console.log(`📊 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);

console.log('\n📋 Next steps:');
console.log('1. Copy the content of supabase-schema.sql');
console.log('2. Go to your Supabase dashboard → SQL Editor');
console.log('3. Paste and execute the SQL');
console.log('4. Or run: psql $DATABASE_URL -f supabase-schema.sql');

console.log('\n🎉 Supabase SQL generation completed!');