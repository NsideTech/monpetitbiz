import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Business } from '../modules/auth/entities/business.entity';
import { User } from '../modules/auth/entities/user.entity';
import { OtpSession } from '../modules/auth/entities/otp-session.entity';
import { Transaction } from '../modules/transaction/entities/transaction.entity';
import { StockItem } from '../modules/stock/entities/stock-item.entity';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DATABASE_HOST', 'localhost'),
  port: configService.get('DATABASE_PORT', 5432),
  username: configService.get('DATABASE_USERNAME', 'postgres'),
  password: configService.get('DATABASE_PASSWORD', 'password'),
  database: configService.get('DATABASE_NAME', 'monpetitbiz'),
  entities: [Business, User, OtpSession, Transaction, StockItem],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: configService.get('NODE_ENV') !== 'production',
  logging: configService.get('NODE_ENV') === 'development',
  ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
});