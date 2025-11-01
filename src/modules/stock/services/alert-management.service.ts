import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductUnit } from '../entities/product-unit.entity';
import { StockItem } from '../entities/stock-item.entity';
import { UnitConversionService } from './unit-conversion.service';

export interface StockAlert {
  productName: string;
  currentStock: number;
  thresholdInBaseUnits: number;
  alertLevel: 'low' | 'critical' | 'out_of_stock';
  message: string;
  suggestedRestockQuantity: number;
  suggestedRestockUnit: string;
  formattedCurrentStock: string;
  formattedThreshold: string;
}

export interface AlertConfiguration {
  productName: string;
  threshold: number;
  unit: string;
  enabled: boolean;
}

export interface RestockingSuggestion {
  productName: string;
  currentStock: number;
  suggestedQuantity: number;
  unit: string;
  targetStock: number;
  estimatedCost?: number;
  priority: 'high' | 'medium' | 'low';
  message: string;
}

@Injectable()
export class AlertManagementService {
  private readonly logger = new Logger(AlertManagementService.name);

  constructor(
    @InjectRepository(ProductUnit)
    private readonly productUnitRepository: Repository<ProductUnit>,
    @InjectRepository(StockItem)
    private readonly stockItemRepository: Repository<StockItem>,
    private readonly unitConversionService: UnitConversionService,
  ) {}

  /**
   * Set alert threshold with unit conversion
   * Requirement 6.1: WHEN le marchand configure "alerte [produit] [seuil] [unité]", 
   * THEN le Système_Stock SHALL créer une alerte basée sur cette unité
   */
  async setAlertThreshold(
    businessId: string,
    productName: string,
    threshold: number,
    unit: string,
  ): Promise<ProductUnit> {
    const productUnit = await this.productUnitRepository.findOne({
      where: { businessId, productName },
    });

    if (!productUnit) {
      throw new Error(
        `Configuration d'unités requise pour ${productName}. ` +
        `Configurez d'abord les unités.`
      );
    }

    // Validate threshold
    if (threshold <= 0) {
      throw new Error('Le seuil d\'alerte doit être positif');
    }

    // Validate unit
    if (!this.unitConversionService.validateUnit(unit, productUnit)) {
      const availableUnits = this.unitConversionService.getAvailableUnits(productUnit);
      throw new Error(
        `Unité '${unit}' inconnue pour ${productName}. ` +
        `Unités disponibles: ${availableUnits.join(', ')}`
      );
    }

    // Convert threshold to purchase units for storage
    let alertThreshold = threshold;
    if (unit.toLowerCase() === productUnit.baseUnit.toLowerCase()) {
      // Convert base units to purchase units (rounded up to ensure we don't under-alert)
      alertThreshold = Math.ceil(threshold / productUnit.conversionFactor);
    }

    // Update the product unit
    productUnit.alertThreshold = alertThreshold;
    productUnit.updatedAt = new Date();

    return this.productUnitRepository.save(productUnit);
  }

  /**
   * Check all products for stock alerts
   * Requirement 6.3: WHEN le stock d'un produit atteint le seuil d'alerte, 
   * THEN le Système_Stock SHALL envoyer une notification avec les unités d'achat et de base
   */
  async checkAllStockAlerts(businessId: string): Promise<StockAlert[]> {
    const alerts: StockAlert[] = [];

    // Get all stock items for the business
    const stockItems = await this.stockItemRepository.find({
      where: { businessId },
    });

    for (const stockItem of stockItems) {
      const alert = await this.checkProductStockAlert(businessId, stockItem.product, stockItem.quantity);
      if (alert && alert.shouldAlert) {
        alerts.push(this.createStockAlert(stockItem, alert));
      }
    }

    return alerts;
  }

  /**
   * Check stock alert for a specific product
   * Requirement 6.2: WHEN le marchand tape "alerte bière 2 caisse", 
   * THEN le Système_Stock SHALL alerter quand le stock descend sous 48 bouteilles
   */
  async checkProductStockAlert(
    businessId: string,
    productName: string,
    currentStock: number,
  ): Promise<{
    shouldAlert: boolean;
    thresholdInBaseUnits: number;
    alertLevel: 'low' | 'critical' | 'out_of_stock';
    message?: string;
    productUnit?: ProductUnit;
  } | null> {
    const productUnit = await this.productUnitRepository.findOne({
      where: { businessId, productName },
    });

    // Handle out of stock
    if (currentStock <= 0) {
      return {
        shouldAlert: true,
        thresholdInBaseUnits: 0,
        alertLevel: 'out_of_stock',
        message: `🚨 RUPTURE DE STOCK: ${productName}`,
        productUnit,
      };
    }

    // Use default threshold if no configuration exists
    if (!productUnit || !productUnit.alertThreshold) {
      const defaultThreshold = productUnit ? productUnit.conversionFactor : 10;
      const shouldAlert = currentStock <= defaultThreshold;
      
      return {
        shouldAlert,
        thresholdInBaseUnits: defaultThreshold,
        alertLevel: shouldAlert ? 'low' : 'low',
        message: shouldAlert 
          ? `⚠️ Stock faible pour ${productName}: ${currentStock} unités restantes`
          : undefined,
        productUnit,
      };
    }

    const thresholdInBaseUnits = productUnit.alertThreshold * productUnit.conversionFactor;
    const shouldAlert = currentStock <= thresholdInBaseUnits;

    if (!shouldAlert) {
      return null;
    }

    // Determine alert level
    let alertLevel: 'low' | 'critical' | 'out_of_stock' = 'low';
    const criticalThreshold = Math.floor(thresholdInBaseUnits * 0.5); // 50% of alert threshold
    
    if (currentStock <= criticalThreshold) {
      alertLevel = 'critical';
    }

    const stockDisplay = this.unitConversionService.formatStockDisplay(currentStock, productUnit);
    const thresholdDisplay = this.unitConversionService.formatStockDisplay(thresholdInBaseUnits, productUnit);
    
    const alertIcon = alertLevel === 'critical' ? '🚨' : '⚠️';
    const message = `${alertIcon} Alerte stock ${alertLevel === 'critical' ? 'CRITIQUE' : ''} pour ${productName}!\n` +
      `Stock actuel: ${stockDisplay}\n` +
      `Seuil d'alerte: ${thresholdDisplay}`;

    return {
      shouldAlert: true,
      thresholdInBaseUnits,
      alertLevel,
      message,
      productUnit,
    };
  }

  /**
   * Generate comprehensive restocking suggestions
   * Requirement 6.4: WHEN une alerte est déclenchée, 
   * THEN le Système_Stock SHALL suggérer une quantité de réapprovisionnement en unités d'achat
   * Requirement 6.5: IF aucun seuil d'alerte n'est configuré, 
   * THEN le Système_Stock SHALL utiliser un seuil par défaut de 1 unité d'achat
   */
  async generateRestockingSuggestions(businessId: string): Promise<RestockingSuggestion[]> {
    const suggestions: RestockingSuggestion[] = [];
    const alerts = await this.checkAllStockAlerts(businessId);

    for (const alert of alerts) {
      const suggestion = await this.generateProductRestockingSuggestion(
        businessId,
        alert.productName,
        alert.currentStock,
        alert.alertLevel,
      );
      
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Sort by priority (high first)
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate restocking suggestion for a specific product
   */
  async generateProductRestockingSuggestion(
    businessId: string,
    productName: string,
    currentStock: number,
    alertLevel: 'low' | 'critical' | 'out_of_stock',
  ): Promise<RestockingSuggestion | null> {
    const productUnit = await this.productUnitRepository.findOne({
      where: { businessId, productName },
    });

    // Default suggestion for products without unit configuration
    if (!productUnit) {
      const priority = alertLevel === 'out_of_stock' ? 'high' : alertLevel === 'critical' ? 'medium' : 'low';
      return {
        productName,
        currentStock,
        suggestedQuantity: Math.max(50 - currentStock, 10),
        unit: 'unités',
        targetStock: 50,
        priority,
        message: `💡 Suggestion: Réapprovisionner ${productName} avec ${Math.max(50 - currentStock, 10)} unités`,
      };
    }

    // Calculate target stock based on alert level and threshold
    const alertThreshold = productUnit.alertThreshold || 1;
    let targetMultiplier = 3; // Default: 3x alert threshold

    switch (alertLevel) {
      case 'out_of_stock':
        targetMultiplier = 5; // More aggressive restocking
        break;
      case 'critical':
        targetMultiplier = 4;
        break;
      case 'low':
        targetMultiplier = 3;
        break;
    }

    const targetStockInPurchaseUnits = Math.max(alertThreshold * targetMultiplier, 2);
    const targetStockInBaseUnits = targetStockInPurchaseUnits * productUnit.conversionFactor;
    
    // Calculate needed quantity
    const currentPurchaseUnits = Math.floor(currentStock / productUnit.conversionFactor);
    const neededPurchaseUnits = Math.max(targetStockInPurchaseUnits - currentPurchaseUnits, 1);

    // Determine priority
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (alertLevel === 'out_of_stock') {
      priority = 'high';
    } else if (alertLevel === 'critical') {
      priority = 'medium';
    }

    // Calculate estimated cost if purchase price is available
    let estimatedCost: number | undefined;
    if (productUnit.purchasePrice) {
      estimatedCost = neededPurchaseUnits * productUnit.purchasePrice;
    }

    const priorityIcon = priority === 'high' ? '🚨' : priority === 'medium' ? '⚠️' : '💡';
    const costInfo = estimatedCost ? ` (≈${estimatedCost} FCFA)` : '';
    
    const message = `${priorityIcon} Suggestion de réapprovisionnement ${priority.toUpperCase()} pour ${productName}:\n` +
      `Commandez ${neededPurchaseUnits} ${productUnit.purchaseUnit}${neededPurchaseUnits > 1 ? 's' : ''} ` +
      `(${neededPurchaseUnits * productUnit.conversionFactor} ${productUnit.baseUnit}${neededPurchaseUnits * productUnit.conversionFactor > 1 ? 's' : ''})${costInfo}`;

    return {
      productName,
      currentStock,
      suggestedQuantity: neededPurchaseUnits,
      unit: productUnit.purchaseUnit,
      targetStock: targetStockInBaseUnits,
      estimatedCost,
      priority,
      message,
    };
  }

  /**
   * Get alert configuration for a product
   */
  async getAlertConfiguration(businessId: string, productName: string): Promise<AlertConfiguration | null> {
    const productUnit = await this.productUnitRepository.findOne({
      where: { businessId, productName },
    });

    if (!productUnit) {
      return null;
    }

    return {
      productName,
      threshold: productUnit.alertThreshold || 1,
      unit: productUnit.purchaseUnit,
      enabled: productUnit.alertThreshold !== null && productUnit.alertThreshold !== undefined,
    };
  }

  /**
   * Get all alert configurations for a business
   */
  async getAllAlertConfigurations(businessId: string): Promise<AlertConfiguration[]> {
    const productUnits = await this.productUnitRepository.find({
      where: { businessId },
      order: { productName: 'ASC' },
    });

    return productUnits.map(unit => ({
      productName: unit.productName,
      threshold: unit.alertThreshold || 1,
      unit: unit.purchaseUnit,
      enabled: unit.alertThreshold !== null && unit.alertThreshold !== undefined,
    }));
  }

  /**
   * Disable alert for a product
   */
  async disableAlert(businessId: string, productName: string): Promise<void> {
    const productUnit = await this.productUnitRepository.findOne({
      where: { businessId, productName },
    });

    if (productUnit) {
      productUnit.alertThreshold = null;
      productUnit.updatedAt = new Date();
      await this.productUnitRepository.save(productUnit);
    }
  }

  /**
   * Format alert summary for display
   */
  formatAlertSummary(alerts: StockAlert[]): string {
    if (alerts.length === 0) {
      return '✅ Aucune alerte de stock active';
    }

    const outOfStock = alerts.filter(a => a.alertLevel === 'out_of_stock');
    const critical = alerts.filter(a => a.alertLevel === 'critical');
    const low = alerts.filter(a => a.alertLevel === 'low');

    let summary = `📊 Résumé des alertes de stock (${alerts.length} produit${alerts.length > 1 ? 's' : ''}):\n`;
    
    if (outOfStock.length > 0) {
      summary += `🚨 Rupture de stock: ${outOfStock.length}\n`;
    }
    
    if (critical.length > 0) {
      summary += `⚠️ Stock critique: ${critical.length}\n`;
    }
    
    if (low.length > 0) {
      summary += `💡 Stock faible: ${low.length}\n`;
    }

    return summary;
  }

  /**
   * Format restocking suggestions summary
   */
  formatRestockingSummary(suggestions: RestockingSuggestion[]): string {
    if (suggestions.length === 0) {
      return '✅ Aucune suggestion de réapprovisionnement';
    }

    const totalCost = suggestions
      .filter(s => s.estimatedCost)
      .reduce((sum, s) => sum + (s.estimatedCost || 0), 0);

    let summary = `💡 Suggestions de réapprovisionnement (${suggestions.length} produit${suggestions.length > 1 ? 's' : ''}):\n`;
    
    const high = suggestions.filter(s => s.priority === 'high');
    const medium = suggestions.filter(s => s.priority === 'medium');
    const low = suggestions.filter(s => s.priority === 'low');

    if (high.length > 0) {
      summary += `🚨 Priorité HAUTE: ${high.length}\n`;
    }
    
    if (medium.length > 0) {
      summary += `⚠️ Priorité MOYENNE: ${medium.length}\n`;
    }
    
    if (low.length > 0) {
      summary += `💡 Priorité BASSE: ${low.length}\n`;
    }

    if (totalCost > 0) {
      summary += `💰 Coût estimé total: ${totalCost} FCFA`;
    }

    return summary;
  }

  /**
   * Create a StockAlert object from stock item and alert check result
   */
  private createStockAlert(stockItem: StockItem, alertResult: any): StockAlert {
    const productUnit = alertResult.productUnit;
    
    let suggestedRestockQuantity = 10;
    let suggestedRestockUnit = 'unités';
    
    if (productUnit) {
      const alertThreshold = productUnit.alertThreshold || 1;
      suggestedRestockQuantity = Math.max(alertThreshold * 2, 1);
      suggestedRestockUnit = productUnit.purchaseUnit;
    }

    return {
      productName: stockItem.product,
      currentStock: stockItem.quantity,
      thresholdInBaseUnits: alertResult.thresholdInBaseUnits,
      alertLevel: alertResult.alertLevel,
      message: alertResult.message || `Alerte pour ${stockItem.product}`,
      suggestedRestockQuantity,
      suggestedRestockUnit,
      formattedCurrentStock: productUnit 
        ? this.unitConversionService.formatStockDisplay(stockItem.quantity, productUnit)
        : `${stockItem.quantity} unités`,
      formattedThreshold: productUnit 
        ? this.unitConversionService.formatStockDisplay(alertResult.thresholdInBaseUnits, productUnit)
        : `${alertResult.thresholdInBaseUnits} unités`,
    };
  }
}