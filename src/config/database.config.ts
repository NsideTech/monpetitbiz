import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Business } from '../modules/auth/entities/business.entity';
import { User } from '../modules/auth/entities/user.entity';
import { OtpSession } from '../modules/auth/entities/otp-session.entity';
import { Transaction } from '../modules/transaction/entities/transaction.entity';
import { StockItem } from '../modules/stock/entities/stock-item.entity';
import { ProductUnit } from '../modules/stock/entities/product-unit.entity';
import { StockMovement } from '../modules/stock/entities/stock-movement.entity';
import { ChatMessage } from '../modules/chat/entities/chat-message.entity';

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
    entities: [Business, User, OtpSession, Transaction, StockItem, ProductUnit, StockMovement, ChatMessage],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false, // Always use migrations for schema changes
    logging: configService.get('NODE_ENV') === 'development',
    // SSL required for Supabase and production
    ssl: (isProduction || isSupabase) 
      ? { rejectUnauthorized: false } 
      : false,
    // Connection pool configuration
    // Optimized for serverless (Vercel/Lambda) vs persistent containers (Render/Railway)
    extra: (() => {
      const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
      return {
        // Serverless: 1 connection per function instance
        // Persistent containers: Larger pool for better performance
        max: isServerless ? 1 : (isProduction ? 20 : 20),
        // Serverless: No idle connections
        // Persistent containers: Keep connections alive
        min: isServerless ? 0 : (isProduction ? 2 : 2),
        // Serverless: Close idle connections quickly
        // Persistent containers: Keep connections longer
        idleTimeoutMillis: isServerless ? 10000 : (isProduction ? 30000 : 30000),
        // Connection timeout
        connectionTimeoutMillis: isServerless ? 5000 : (isProduction ? 10000 : 10000),
        // Query timeout
        query_timeout: isServerless ? 30000 : (isProduction ? 60000 : 60000),
        // Statement timeout in milliseconds
        statement_timeout: isServerless ? 30000 : (isProduction ? 60000 : 60000),
      };
    })(),
    // Retry configuration
    retryAttempts: 5,
    retryDelay: 3000,
  };

  return baseConfig;
};