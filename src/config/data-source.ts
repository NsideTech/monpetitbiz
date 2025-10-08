import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Business } from '../modules/auth/entities/business.entity';
import { User } from '../modules/auth/entities/user.entity';
import { OtpSession } from '../modules/auth/entities/otp-session.entity';
import { Transaction } from '../modules/transaction/entities/transaction.entity';
import { StockItem } from '../modules/stock/entities/stock-item.entity';

// Load environment variables
config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'whatsapp_bot',
  entities: [Business, User, OtpSession, Transaction, StockItem],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false, // Always false for migrations
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});