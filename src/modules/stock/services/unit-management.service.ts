import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductUnit } from '../entities/product-unit.entity';
import { UnitConversionService } from './unit-conversion.service';
import { UnitValidationService } from './unit-validation.service';
import { UnitErrorMessagesService, UnitErrorType } from './unit-error-messages.service';

export interface ProductUnitConfiguration {
  productName: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
}

export interface PriceConfiguration {
  purchasePrice?: number;
  sellingPrice?: number;
  profitMargin?: number;
}

export interface AlertConfiguration {
  threshold: number;
  unit: string;
}

export interface ProductPriceInfo {
  productName: string;
  purchasePrice?: number;
  unitCostInBaseUnit?: number;
  sellingPrice?: number;
  profitMargin?: number;
  recommendedSellingPrice?: number;
}

@Injectable()
export class UnitManagementService {
  constructor(
    @InjectRepository(ProductUnit)
    private readonly productUnitRepository: Repository<ProductUnit>,
    private readonly unitConversionService: UnitConversionService,
    private readonly unitValidationService: UnitValidationService,
    private readonly unitErrorMessagesService: UnitErrorMessagesService,
  ) {}

  /**
   * Configure product units for a business
   * Requirement 1.1: WHEN le marchand tape "produit unité [nom_produit] achat [unité_achat] [facteur] [unité_base]", 
   * THEN le Système_Stock SHALL enregistrer la configuration d'unités pour ce produit
   */
  async configureProductUnits(
    businessId: string,
    config: ProductUnitConfiguration,
  ): Promise<ProductUnit> {
    // Validate input using the validation service
    const validation = this.unitValidationService.validateCompleteConfiguration(config);
    if (!validation.isValid) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.VALIDATION_ERROR,
        { suggestions: validation.errors }
      );
      throw new BadRequestException(errorMessage);
    }

    // Check if configuration already exists
    const existingConfig = await this.getProductUnits(businessId, config.productName);

    if (existingConfig) {
      // Update existing configuration
      return this.updateProductUnits(existingConfig.id, {
        baseUnit: config.baseUnit,
        purchaseUnit: config.purchaseUnit,
        conversionFactor: config.conversionFactor,
      });
    }

    // Create new configuration
    const productUnit = this.productUnitRepository.create({
      businessId,
      productName: config.productName,
      baseUnit: config.baseUnit,
      purchaseUnit: config.purchaseUnit,
      conversionFactor: config.conversionFactor,
    });

    return this.productUnitRepository.save(productUnit);
  }

  /**
   * Get product units configuration for a specific product
   * Requirement 1.4: WHEN le marchand tape "produit unité [nom_produit]", 
   * THEN le Système_Stock SHALL afficher la configuration actuelle des unités pour ce produit
   */
  async getProductUnits(businessId: string, productName: string): Promise<ProductUnit | null> {
    return this.productUnitRepository.findOne({
      where: {
        businessId,
        productName,
      },
    });
  }

  /**
   * Get all product units configurations for a business
   */
  async getAllProductUnits(businessId: string): Promise<ProductUnit[]> {
    return this.productUnitRepository.find({
      where: { businessId },
      order: { productName: 'ASC' },
    });
  }

  /**
   * Update existing product units configuration
   * Requirement 1.3: WHEN une configuration d'unités existe déjà pour un produit, 
   * THEN le Système_Stock SHALL permettre de la modifier avec la même commande
   */
  async updateProductUnits(
    unitId: string,
    updates: Partial<ProductUnit>,
  ): Promise<ProductUnit> {
    const existingUnit = await this.productUnitRepository.findOne({
      where: { id: unitId },
    });

    if (!existingUnit) {
      throw new NotFoundException('Configuration d\'unités non trouvée');
    }

    // Validate updates using the validation service
    if (updates.conversionFactor !== undefined) {
      const validation = this.unitValidationService.validateConversionFactor(updates.conversionFactor);
      if (!validation.isValid) {
        const errorMessage = this.unitErrorMessagesService.getErrorMessage(
          UnitErrorType.INVALID_CONVERSION_FACTOR,
          { 
            conversionFactor: updates.conversionFactor,
            suggestions: validation.suggestedValue ? [`Essayez avec ${validation.suggestedValue}`] : []
          }
        );
        throw new BadRequestException(errorMessage);
      }
    }

    // Validate price updates
    if (updates.purchasePrice !== undefined) {
      const validation = this.unitValidationService.validatePriceFormat(updates.purchasePrice, 'd\'achat');
      if (!validation.isValid) {
        const errorMessage = this.unitErrorMessagesService.getErrorMessage(
          UnitErrorType.INVALID_PRICE_FORMAT,
          { price: updates.purchasePrice }
        );
        throw new BadRequestException(errorMessage);
      }
      updates.purchasePrice = validation.formattedPrice;
    }

    if (updates.sellingPrice !== undefined) {
      const validation = this.unitValidationService.validatePriceFormat(updates.sellingPrice, 'de vente');
      if (!validation.isValid) {
        const errorMessage = this.unitErrorMessagesService.getErrorMessage(
          UnitErrorType.INVALID_PRICE_FORMAT,
          { price: updates.sellingPrice }
        );
        throw new BadRequestException(errorMessage);
      }
      updates.sellingPrice = validation.formattedPrice;
    }

    if (updates.profitMargin !== undefined) {
      const validation = this.unitValidationService.validateProfitMargin(updates.profitMargin);
      if (!validation.isValid) {
        const errorMessage = this.unitErrorMessagesService.getErrorMessage(
          UnitErrorType.INVALID_MARGIN,
          { suggestions: validation.errors }
        );
        throw new BadRequestException(errorMessage);
      }
    }

    // Apply updates
    Object.assign(existingUnit, updates);
    existingUnit.updatedAt = new Date();

    return this.productUnitRepository.save(existingUnit);
  }

  /**
   * Set purchase price for a product
   * Requirement 5.1: WHEN le marchand tape "prix achat [produit] [prix] [unité_achat]", 
   * THEN le Système_Stock SHALL enregistrer le prix d'achat et calculer le prix unitaire de base
   */
  async setPurchasePrice(
    businessId: string,
    productName: string,
    price: number,
    unit: string,
  ): Promise<ProductUnit> {
    const productUnit = await this.getProductUnits(businessId, productName);
    
    if (!productUnit) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNIT_NOT_CONFIGURED,
        { productName }
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate price using validation service
    const priceValidation = this.unitValidationService.validatePriceFormat(price, 'd\'achat');
    if (!priceValidation.isValid) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.INVALID_PRICE_FORMAT,
        { price }
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate unit
    if (!this.unitConversionService.validateUnit(unit, productUnit)) {
      const availableUnits = this.unitConversionService.getAvailableUnits(productUnit);
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNKNOWN_UNIT,
        { 
          productName,
          unit,
          availableUnits
        }
      );
      throw new BadRequestException(errorMessage);
    }

    // Convert price to purchase unit if needed
    let purchasePrice = priceValidation.formattedPrice || price;
    if (unit.toLowerCase() === productUnit.baseUnit.toLowerCase()) {
      // Price given in base unit, convert to purchase unit price
      purchasePrice = price * productUnit.conversionFactor;
    }

    return this.updateProductUnits(productUnit.id, { purchasePrice });
  }

  /**
   * Calculate and set selling price based on profit margin
   * Requirement 5.3: WHEN le marchand tape "prix vente [produit] [marge]%", 
   * THEN le Système_Stock SHALL calculer et afficher le prix de vente recommandé par unité de base
   */
  async calculateSellingPrice(
    businessId: string,
    productName: string,
    profitMargin: number,
  ): Promise<number> {
    const productUnit = await this.getProductUnits(businessId, productName);
    
    if (!productUnit) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNIT_NOT_CONFIGURED,
        { productName }
      );
      throw new BadRequestException(errorMessage);
    }

    if (!productUnit.purchasePrice) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.MISSING_CONFIGURATION,
        { 
          productName,
          suggestions: [`Configurez d'abord avec: prix achat ${productName} [prix] [unité]`]
        }
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate margin using validation service
    const marginValidation = this.unitValidationService.validateProfitMargin(profitMargin);
    if (!marginValidation.isValid) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.INVALID_MARGIN,
        { suggestions: marginValidation.errors }
      );
      throw new BadRequestException(errorMessage);
    }

    // Calculate unit cost in base unit
    const unitCostInBaseUnit = productUnit.purchasePrice / productUnit.conversionFactor;
    
    // Calculate selling price with margin
    const sellingPrice = unitCostInBaseUnit * (1 + profitMargin / 100);

    // Update the product unit with the new prices
    await this.updateProductUnits(productUnit.id, {
      sellingPrice: Math.round(sellingPrice),
      profitMargin,
    });

    return Math.round(sellingPrice);
  }

  /**
   * Set selling price directly
   */
  async setSellingPrice(
    businessId: string,
    productName: string,
    sellingPrice: number,
  ): Promise<ProductUnit> {
    const productUnit = await this.getProductUnits(businessId, productName);
    
    if (!productUnit) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNIT_NOT_CONFIGURED,
        { productName }
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate selling price using validation service
    const priceValidation = this.unitValidationService.validatePriceFormat(sellingPrice, 'de vente');
    if (!priceValidation.isValid) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.INVALID_PRICE_FORMAT,
        { price: sellingPrice }
      );
      throw new BadRequestException(errorMessage);
    }

    // Calculate profit margin if purchase price is available
    let profitMargin: number | undefined;
    if (productUnit.purchasePrice) {
      const unitCostInBaseUnit = productUnit.purchasePrice / productUnit.conversionFactor;
      profitMargin = ((sellingPrice - unitCostInBaseUnit) / unitCostInBaseUnit) * 100;
    }

    const finalSellingPrice = priceValidation.formattedPrice || sellingPrice;

    return this.updateProductUnits(productUnit.id, {
      sellingPrice: finalSellingPrice,
      profitMargin: profitMargin ? Math.round(profitMargin * 100) / 100 : undefined,
    });
  }

  /**
   * Get comprehensive price information for a product
   * Requirement 5.5: WHEN le marchand tape "prix [produit]", 
   * THEN le Système_Stock SHALL afficher les prix d'achat, unitaire de base, et de vente avec la marge
   */
  async getProductPriceInfo(businessId: string, productName: string): Promise<ProductPriceInfo> {
    const productUnit = await this.getProductUnits(businessId, productName);
    
    if (!productUnit) {
      return {
        productName,
        purchasePrice: undefined,
        unitCostInBaseUnit: undefined,
        sellingPrice: undefined,
        profitMargin: undefined,
        recommendedSellingPrice: undefined,
      };
    }

    const unitCostInBaseUnit = productUnit.purchasePrice 
      ? productUnit.purchasePrice / productUnit.conversionFactor 
      : undefined;

    // Calculate recommended selling price with default 40% margin if no selling price is set
    let recommendedSellingPrice: number | undefined;
    if (unitCostInBaseUnit && !productUnit.sellingPrice) {
      recommendedSellingPrice = Math.round(unitCostInBaseUnit * 1.4); // 40% margin
    }

    return {
      productName,
      purchasePrice: productUnit.purchasePrice,
      unitCostInBaseUnit: unitCostInBaseUnit ? Math.round(unitCostInBaseUnit) : undefined,
      sellingPrice: productUnit.sellingPrice,
      profitMargin: productUnit.profitMargin,
      recommendedSellingPrice,
    };
  }

  /**
   * Set alert threshold for a product
   * Requirement 6.1: WHEN le marchand configure "alerte [produit] [seuil] [unité]", 
   * THEN le Système_Stock SHALL créer une alerte basée sur cette unité
   */
  async setAlertThreshold(
    businessId: string,
    productName: string,
    threshold: number,
    unit: string,
  ): Promise<ProductUnit> {
    const productUnit = await this.getProductUnits(businessId, productName);
    
    if (!productUnit) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNIT_NOT_CONFIGURED,
        { productName }
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate threshold
    const quantityValidation = this.unitValidationService.validateStockQuantity(
      threshold, 
      unit, 
      productUnit, 
      0, // No current stock check needed for alert threshold
      'add'
    );
    if (!quantityValidation.isValid) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.INVALID_QUANTITY,
        { suggestions: quantityValidation.errors }
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate unit
    if (!this.unitConversionService.validateUnit(unit, productUnit)) {
      const availableUnits = this.unitConversionService.getAvailableUnits(productUnit);
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNKNOWN_UNIT,
        { 
          productName,
          unit,
          availableUnits
        }
      );
      throw new BadRequestException(errorMessage);
    }

    // Convert threshold to purchase units if given in base unit
    let alertThreshold = threshold;
    if (unit.toLowerCase() === productUnit.baseUnit.toLowerCase()) {
      // Convert base units to purchase units (rounded up)
      alertThreshold = Math.ceil(threshold / productUnit.conversionFactor);
    }

    return this.updateProductUnits(productUnit.id, { alertThreshold });
  }

  /**
   * Check if stock level triggers an alert
   * Requirement 6.2: WHEN le marchand tape "alerte bière 2 caisse", 
   * THEN le Système_Stock SHALL alerter quand le stock descend sous 48 bouteilles
   */
  async checkStockAlert(businessId: string, productName: string, currentStock: number): Promise<{
    shouldAlert: boolean;
    thresholdInBaseUnits: number;
    message?: string;
  }> {
    const productUnit = await this.getProductUnits(businessId, productName);
    
    if (!productUnit || !productUnit.alertThreshold) {
      // Use default threshold of 1 purchase unit if no configuration
      const defaultThreshold = productUnit ? productUnit.conversionFactor : 1;
      return {
        shouldAlert: currentStock <= defaultThreshold,
        thresholdInBaseUnits: defaultThreshold,
        message: currentStock <= defaultThreshold 
          ? `⚠️ Stock faible pour ${productName}: ${currentStock} unités restantes`
          : undefined,
      };
    }

    const thresholdInBaseUnits = productUnit.alertThreshold * productUnit.conversionFactor;
    const shouldAlert = currentStock <= thresholdInBaseUnits;

    let message: string | undefined;
    if (shouldAlert) {
      const stockDisplay = this.unitConversionService.formatStockDisplay(currentStock, productUnit);
      const thresholdDisplay = this.unitConversionService.formatStockDisplay(thresholdInBaseUnits, productUnit);
      
      message = `⚠️ Alerte stock pour ${productName}!\n` +
        `Stock actuel: ${stockDisplay}\n` +
        `Seuil d'alerte: ${thresholdDisplay}`;
    }

    return {
      shouldAlert,
      thresholdInBaseUnits,
      message,
    };
  }

  /**
   * Generate restocking suggestion
   * Requirement 6.4: WHEN une alerte est déclenchée, 
   * THEN le Système_Stock SHALL suggérer une quantité de réapprovisionnement en unités d'achat
   */
  async generateRestockingSuggestion(
    businessId: string,
    productName: string,
    currentStock: number,
  ): Promise<{
    suggestedQuantity: number;
    unit: string;
    message: string;
  }> {
    const productUnit = await this.getProductUnits(businessId, productName);
    
    if (!productUnit) {
      return {
        suggestedQuantity: 10,
        unit: 'unités',
        message: `Suggestion: Réapprovisionner ${productName} avec 10 unités`,
      };
    }

    // Suggest restocking to 3x the alert threshold, or minimum 2 purchase units
    const alertThreshold = productUnit.alertThreshold || 1;
    const targetStock = Math.max(alertThreshold * 3, 2);
    
    // Calculate how many purchase units are needed
    const currentPurchaseUnits = Math.floor(currentStock / productUnit.conversionFactor);
    const neededPurchaseUnits = Math.max(targetStock - currentPurchaseUnits, 1);

    const message = `💡 Suggestion de réapprovisionnement pour ${productName}:\n` +
      `Commandez ${neededPurchaseUnits} ${productUnit.purchaseUnit}${neededPurchaseUnits > 1 ? 's' : ''} ` +
      `(${neededPurchaseUnits * productUnit.conversionFactor} ${productUnit.baseUnit}${neededPurchaseUnits * productUnit.conversionFactor > 1 ? 's' : ''})`;

    return {
      suggestedQuantity: neededPurchaseUnits,
      unit: productUnit.purchaseUnit,
      message,
    };
  }

  /**
   * Delete product unit configuration
   */
  async deleteProductUnits(businessId: string, productName: string): Promise<void> {
    const productUnit = await this.getProductUnits(businessId, productName);
    
    if (!productUnit) {
      throw new NotFoundException('Configuration d\'unités non trouvée');
    }

    await this.productUnitRepository.remove(productUnit);
  }



  /**
   * Format configuration display for user
   */
  formatConfigurationDisplay(productUnit: ProductUnit): string {
    const priceInfo = productUnit.purchasePrice 
      ? `\n💰 Prix d'achat: ${productUnit.purchasePrice} FCFA/${productUnit.purchaseUnit}`
      : '';
    
    const unitCost = productUnit.purchasePrice 
      ? `\n💰 Coût unitaire: ${Math.round(productUnit.purchasePrice / productUnit.conversionFactor)} FCFA/${productUnit.baseUnit}`
      : '';
    
    const sellingInfo = productUnit.sellingPrice 
      ? `\n💰 Prix de vente: ${productUnit.sellingPrice} FCFA/${productUnit.baseUnit}`
      : '';
    
    const marginInfo = productUnit.profitMargin 
      ? `\n📈 Marge: ${productUnit.profitMargin}%`
      : '';
    
    const alertInfo = productUnit.alertThreshold 
      ? `\n🔔 Seuil d'alerte: ${productUnit.alertThreshold} ${productUnit.purchaseUnit}${productUnit.alertThreshold > 1 ? 's' : ''} (${productUnit.alertThreshold * productUnit.conversionFactor} ${productUnit.baseUnit}${productUnit.alertThreshold * productUnit.conversionFactor > 1 ? 's' : ''})`
      : '';

    return `📦 Configuration pour ${productUnit.productName}:\n` +
      `🔄 Conversion: 1 ${productUnit.purchaseUnit} = ${productUnit.conversionFactor} ${productUnit.baseUnit}${productUnit.conversionFactor > 1 ? 's' : ''}` +
      priceInfo + unitCost + sellingInfo + marginInfo + alertInfo;
  }
}