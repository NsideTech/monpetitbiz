import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockItem } from './entities/stock-item.entity';
import { ProductUnit } from './entities/product-unit.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { ProductNormalizerService } from './services/product-normalizer.service';
import { UnitConversionService } from './services/unit-conversion.service';
import { UnitManagementService } from './services/unit-management.service';
import { AlertManagementService } from './services/alert-management.service';
import { StockMovementService } from './services/stock-movement.service';
import { UnitValidationService } from './services/unit-validation.service';
import { UnitErrorMessagesService } from './services/unit-error-messages.service';

@Module({
  imports: [TypeOrmModule.forFeature([StockItem, ProductUnit, StockMovement])],
  providers: [
    StockService, 
    ProductNormalizerService, 
    UnitConversionService, 
    UnitManagementService, 
    AlertManagementService, 
    StockMovementService,
    UnitValidationService,
    UnitErrorMessagesService
  ],
  controllers: [StockController],
  exports: [
    StockService, 
    ProductNormalizerService, 
    UnitConversionService, 
    UnitManagementService, 
    AlertManagementService, 
    StockMovementService,
    UnitValidationService,
    UnitErrorMessagesService
  ],
})
export class StockModule {}