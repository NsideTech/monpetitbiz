import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminBusinessController } from './admin-business.controller';
import { AdminBusinessService } from './admin-business.service';
import { EmployeeService } from './services/employee.service';
import { PhoneValidationService } from './services/phone-validation.service';
import { User } from './entities/user.entity';
import { Business } from './entities/business.entity';
import { OtpSession } from './entities/otp-session.entity';
import { EmployeeCode } from './entities/employee-code.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { ServiceTokenGuard } from './guards/service-token.guard';
import { StockModule } from '../stock/stock.module';
import { StockItem } from '../stock/entities/stock-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Business, OtpSession, EmployeeCode, Transaction, StockItem]),
    StockModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, AdminBusinessService, EmployeeService, PhoneValidationService, JwtAuthGuard, PermissionGuard, ServiceTokenGuard],
  controllers: [AuthController, AdminBusinessController],
  exports: [AuthService, EmployeeService, PhoneValidationService, JwtAuthGuard, PermissionGuard, ServiceTokenGuard],
})
export class AuthModule {}