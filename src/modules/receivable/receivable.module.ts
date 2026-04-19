import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receivable } from './entities/receivable.entity';
import { ReceivablePayment } from './entities/receivable-payment.entity';
import { ReceivableService } from './receivable.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receivable, ReceivablePayment]),
  ],
  providers: [ReceivableService],
  exports: [ReceivableService],
})
export class ReceivableModule {}
