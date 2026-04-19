import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan } from './entities/loan.entity';
import { LoanPayment } from './entities/loan-payment.entity';
import { LoanService } from './loan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, LoanPayment]),
  ],
  providers: [LoanService],
  exports: [LoanService],
})
export class LoanModule {}
