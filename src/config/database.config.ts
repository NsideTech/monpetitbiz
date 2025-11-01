import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Business } from '../modules/auth/entities/business.entity';
import { User } from '../modules/auth/entities/user.entity';
import { OtpSession } from '../modules/auth/entities/otp-session.entity';
import { Transaction } from '../modules/transaction/entities/transaction.entity';
import { StockItem } from '../modules/stock/entities/stock-item.entity';
import { ProductUnit } from '../modules/stock/entities/product-unit.entity';
import { StockMovement } from '../modules/stock/entities/stock-movement.entity';

// Helper function to parse DATABASE_URL
function parseDatabaseUrl(url?: string): {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
} | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, '') || 'postgres';
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      username: parsed.username || 'postgres',
      password: parsed.password || '',
      database: typeof database === 'string' ? database : String(database),
      ssl: parsed.searchParams.get('sslmode') === 'require',
    };
  } catch (error) {
    console.warn('Failed to parse DATABASE_URL:', error);
    return null;
  }
}

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const dbUrl = configService.get<string>('DATABASE_URL');
  const isSupabase = dbUrl?.includes('supabase');
  const isProduction = configService.get('NODE_ENV') === 'production';

  // Use DATABASE_URL directly if provided (TypeORM supports it natively)
  // Otherwise fall back to individual env vars
  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    ...(dbUrl ? {
      url: dbUrl,
    } : {
      host: configService.get<string>('DATABASE_HOST') || 'localhost',
      port: configService.get<number>('DATABASE_PORT') || 5432,
      username: configService.get<string>('DATABASE_USERNAME') || 'postgres',
      password: configService.get<string>('DATABASE_PASSWORD') || 'password',
      database: configService.get<string>('DATABASE_NAME') || 'monpetitbiz',
    }),
    entities: [Business, User, OtpSession, Transaction, StockItem, ProductUnit, StockMovement],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false, // Always use migrations for schema changes
    logging: configService.get('NODE_ENV') === 'development',
    // SSL required for Supabase and production
    ssl: (isProduction || isSupabase) 
      ? { rejectUnauthorized: false } 
      : false,
    // Connection pool configuration
    // Optimized for serverless (Vercel/Lambda)
    extra: {
      // Serverless: 1 connection per function instance
      max: isProduction ? 1 : (isSupabase ? 10 : 20),
      // Serverless: No idle connections
      min: isProduction ? 0 : 2,
      // Close idle connections quickly in serverless
      idleTimeoutMillis: isProduction ? 10000 : 30000,
      // Faster connection timeout for serverless
      connectionTimeoutMillis: isProduction ? 5000 : 10000,
      // Faster query timeout for serverless
      query_timeout: isProduction ? 30000 : 60000,
      // Statement timeout in milliseconds
      statement_timeout: isProduction ? 30000 : 60000,
    },
    // Retry configuration
    retryAttempts: 5,
    retryDelay: 3000,
  };

  return baseConfig;
};