import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockItem } from './entities/stock-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockItem])],
  providers: [StockService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}