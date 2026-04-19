import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Business } from '../modules/auth/entities/business.entity';
import { User } from '../modules/auth/entities/user.entity';
import { OtpSession } from '../modules/auth/entities/otp-session.entity';
import { Transaction } from '../modules/transaction/entities/transaction.entity';
import { StockItem } from '../modules/stock/entities/stock-item.entity';
import { ProductUnit } from '../modules/stock/entities/product-unit.entity';
import { StockMovement } from '../modules/stock/entities/stock-movement.entity';
import { ChatMessage } from '../modules/chat/entities/chat-message.entity';
import { EmployeeCode } from '../modules/auth/entities/employee-code.entity';
import { Receivable } from '../modules/receivable/entities/receivable.entity';
import { ReceivablePayment } from '../modules/receivable/entities/receivable-payment.entity';
import { Loan } from '../modules/loan/entities/loan.entity';
import { LoanPayment } from '../modules/loan/entities/loan-payment.entity';

// Load environment variables
config();

// Helper function to parse DATABASE_URL
function parseDatabaseUrl(url?: string) {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      username: parsed.username || 'postgres',
      password: parsed.password || '',
      database: parsed.pathname.replace(/^\//, '') || 'postgres',
      ssl: parsed.searchParams.get('sslmode') === 'require' || parsed.searchParams.get('sslmode') === 'require',
    };
  } catch (error) {
    console.warn('Failed to parse DATABASE_URL:', error);
    return null;
  }
}

// Use DATABASE_URL directly if available (TypeORM supports it natively)
// Otherwise fall back to individual env vars
const dbUrl = process.env.DATABASE_URL;
const isSupabase = dbUrl?.includes('supabase');
const isProduction = process.env.NODE_ENV === 'production';

const configObj: any = {
  type: 'postgres',
  ...(dbUrl ? {
    url: dbUrl,
  } : {
    host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
    username: process.env.DATABASE_USERNAME || process.env.DB_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || process.env.DB_NAME || 'monpetitbiz',
  }),
  entities: [Business, User, OtpSession, EmployeeCode, Transaction, StockItem, ProductUnit, StockMovement, ChatMessage, Receivable, ReceivablePayment, Loan, LoanPayment],
  migrations: [
    __dirname + '/../database/migrations/*{.ts,.js}',
    __dirname + '/../migrations/*{.ts,.js}'
  ],
  synchronize: false, // Always false for migrations
  logging: process.env.NODE_ENV === 'development',
  ssl: isProduction || isSupabase 
    ? { rejectUnauthorized: false } 
    : false,
  // Connection pool configuration
  extra: {
    // Maximum number of clients in the pool
    max: isSupabase ? 10 : 20,
    // Minimum number of clients in the pool
    min: 2,
    // Number of milliseconds a client must remain idle before being closed
    idleTimeoutMillis: 30000,
    // Number of milliseconds to wait before timing out when connecting a new client
    connectionTimeoutMillis: 10000,
    // Number of milliseconds to wait before timing out queries
    query_timeout: 60000,
    // Statement timeout in milliseconds
    statement_timeout: 60000,
  },
  // Retry configuration
  retryAttempts: 5,
  retryDelay: 3000,
};

export const AppDataSource = new DataSource(configObj);