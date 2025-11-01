import { Injectable, Logger } from '@nestjs/common';
import { UnitManagementService } from '../../stock/services/unit-management.service';
import { UnitConversionService } from '../../stock/services/unit-conversion.service';
import { StockService } from '../../stock/stock.service';
import { StockMovementService } from '../../stock/services/stock-movement.service';
import { MovementType } from '../../stock/entities/stock-movement.entity';

export interface UnitCommandResult {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable()
export class UnitCommandHandler {
  private readonly logger = new Logger(UnitCommandHandler.name);

  constructor(
    private readonly unitManagementService: UnitManagementService,
    private readonly unitConversionService: UnitConversionService,
    private readonly stockService: StockService,
    private readonly stockMovementService: StockMovementService,
  ) { }

  /**
   * Handle "produit unité [nom_produit] achat [unité_achat] [facteur] [unité_base]" command
   * Requirement 1.1: WHEN le marchand tape "produit unité [nom_produit] achat [unité_achat] [facteur] [unité_base]", 
   * THEN le Système_Stock SHALL enregistrer la configuration d'unités pour ce produit
   */
  async handleConfigureUnits(
    businessId: string,
    userId: string,
    matches: RegExpMatchArray
  ): Promise<UnitCommandResult> {
    try {
      // Extract parameters from regex match
      // Expected format: produit unité [produit] achat [unité_achat] [facteur] [unité_base]
      const productName = matches[1]?.trim();
      const purchaseUnit = matches[2]?.trim();
      const conversionFactor = parseInt(matches[3]);
      const baseUnit = matches[4]?.trim();

      if (!productName || !purchaseUnit || !baseUnit || isNaN(conversionFactor)) {
        return {
          success: false,
          message: `❌ Format invalide. Utilisez:\n` +
            `produit unité [produit] achat [unité_achat] [facteur] [unité_base]\n\n` +
            `Exemple: produit unité bière achat caisse 24 bouteille`
        };
      }

      // Configure the product units
      const productUnit = await this.unitManagementService.configureProductUnits(businessId, {
        productName,
        baseUnit,
        purchaseUnit,
        conversionFactor
      });

      const message = `✅ Configuration d'unités enregistrée pour ${productName}:\n` +
        `🔄 1 ${purchaseUnit} = ${conversionFactor} ${baseUnit}${conversionFactor > 1 ? 's' : ''}\n\n` +
        `💡 Vous pouvez maintenant:\n` +
        `• Ajouter du stock: "stock ${productName} 5 ${purchaseUnit}"\n` +
        `• Définir prix d'achat: "prix achat ${productName} 12000 ${purchaseUnit}"\n` +
        `• Configurer alerte: "alerte ${productName} 2 ${purchaseUnit}"`;

      return {
        success: true,
        message,
        data: { productUnit }
      };

    } catch (error) {
      this.logger.error('Error configuring product units:', error);

      let errorMessage = '❌ Erreur lors de la configuration des unités.';
      if (error.message.includes('doit être un nombre entier positif')) {
        errorMessage = `❌ ${error.message}\n\nExemple: produit unité bière achat caisse 24 bouteille`;
      } else if (error.message.includes('différentes')) {
        errorMessage = `❌ ${error.message}\n\nExemple: produit unité bière achat caisse 24 bouteille`;
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Handle "stock [produit] [quantité] [unité]" command with unit support
   * Requirement 2.1: WHEN le marchand tape "stock [produit] [quantité] [unité_achat]", 
   * THEN le Système_Stock SHALL convertir automatiquement en unités de base et mettre à jour le stock
   */
  async handleStockWithUnit(
    businessId: string,
    userId: string,
    matches: RegExpMatchArray
  ): Promise<UnitCommandResult> {
    try {
      // Extract parameters from regex match
      // Expected format: stock [produit] [quantité] [unité]
      const productName = matches[1]?.trim();
      const quantity = parseFloat(matches[2]);
      const unit = matches[3]?.trim();

      if (!productName || isNaN(quantity) || !unit) {
        return {
          success: false,
          message: `❌ Format invalide. Utilisez:\n` +
            `stock [produit] [quantité] [unité]\n\n` +
            `Exemple: stock bière 5 caisse`
        };
      }

      if (quantity < 0) {
        return {
          success: false,
          message: '❌ La quantité ne peut pas être négative.'
        };
      }

      // Get product unit configuration
      const productUnit = await this.unitManagementService.getProductUnits(businessId, productName);

      if (!productUnit) {
        return {
          success: false,
          message: `❌ Configuration d'unités requise pour ${productName}.\n\n` +
            `Configurez d'abord avec:\n` +
            `produit unité ${productName} achat [unité] [facteur] [unité_base]\n\n` +
            `Exemple: produit unité ${productName} achat caisse 24 bouteille`
        };
      }

      // Validate unit
      if (!this.unitConversionService.validateUnit(unit, productUnit)) {
        const availableUnits = this.unitConversionService.getAvailableUnits(productUnit);
        return {
          success: false,
          message: `❌ Unité '${unit}' inconnue pour ${productName}.\n` +
            `Unités disponibles: ${availableUnits.join(', ')}\n\n` +
            `Exemple: stock ${productName} ${quantity} ${availableUnits[0]}`
        };
      }

      // Convert to base units
      const baseQuantity = this.unitConversionService.convertToBaseUnit(quantity, unit, productUnit);

      // Update stock
      const stockItem = await this.stockService.updateStock(businessId, productName, baseQuantity);

      // Record stock movement
      await this.stockMovementService.recordMovement({
        businessId,
        productName,
        movementType: MovementType.ADJUSTMENT,
        quantity,
        unit,
        baseQuantity,
        notes: `Mise à jour stock via WhatsApp: ${quantity} ${unit}`,
        createdBy: userId
      });

      // Format confirmation message
      const stockDisplay = this.unitConversionService.formatStockDisplay(baseQuantity, productUnit);

      let message = `✅ Stock mis à jour pour ${productName}:\n`;
      message += `📦 Ajouté: ${quantity} ${unit}`;
      if (unit.toLowerCase() !== productUnit.baseUnit.toLowerCase()) {
        message += ` (${baseQuantity} ${productUnit.baseUnit}${baseQuantity > 1 ? 's' : ''})`;
      }
      message += `\n📊 Stock total: ${stockDisplay}`;

      // Check for stock alerts
      const alertCheck = await this.unitManagementService.checkStockAlert(businessId, productName, baseQuantity);
      if (alertCheck.shouldAlert && alertCheck.message) {
        message += `\n\n${alertCheck.message}`;
      }

      return {
        success: true,
        message,
        data: { stockItem, baseQuantity, originalQuantity: quantity, originalUnit: unit }
      };

    } catch (error) {
      this.logger.error('Error handling stock with unit:', error);

      let errorMessage = '❌ Erreur lors de la mise à jour du stock.';
      if (error.message.includes('Configuration d\'unités requise')) {
        errorMessage = error.message;
      } else if (error.message.includes('inconnue')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Handle "prix achat [produit] [prix] [unité]" command
   * Requirement 5.1: WHEN le marchand tape "prix achat [produit] [prix] [unité_achat]", 
   * THEN le Système_Stock SHALL enregistrer le prix d'achat et calculer le prix unitaire de base
   */
  async handlePurchasePrice(
    businessId: string,
    matches: RegExpMatchArray
  ): Promise<UnitCommandResult> {
    try {
      // Extract parameters from regex match
      // Expected format: prix achat [produit] [prix] [unité]
      const productName = matches[1]?.trim();
      const price = parseFloat(matches[2]);
      const unit = matches[3]?.trim();

      if (!productName || isNaN(price) || !unit) {
        return {
          success: false,
          message: `❌ Format invalide. Utilisez:\n` +
            `prix achat [produit] [prix] [unité]\n\n` +
            `Exemple: prix achat bière 12000 caisse`
        };
      }

      if (price <= 0) {
        return {
          success: false,
          message: '❌ Le prix d\'achat doit être positif.'
        };
      }

      // Set purchase price
      const productUnit = await this.unitManagementService.setPurchasePrice(
        businessId,
        productName,
        price,
        unit
      );

      // Calculate unit cost in base unit
      const unitCostInBaseUnit = Math.round(price / productUnit.conversionFactor);

      let message = `✅ Prix d'achat enregistré pour ${productName}:\n`;
      message += `💰 Prix d'achat: ${this.formatCurrency(price)}/${unit}\n`;
      message += `💰 Coût unitaire: ${this.formatCurrency(unitCostInBaseUnit)}/${productUnit.baseUnit}\n\n`;
      message += `💡 Définissez maintenant votre marge:\n`;
      message += `prix vente ${productName} 40%`;

      return {
        success: true,
        message,
        data: { productUnit, unitCostInBaseUnit }
      };

    } catch (error) {
      this.logger.error('Error setting purchase price:', error);

      let errorMessage = '❌ Erreur lors de l\'enregistrement du prix d\'achat.';
      if (error.message.includes('Configuration d\'unités requise')) {
        errorMessage = error.message;
      } else if (error.message.includes('inconnue')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Handle "prix vente [produit] [marge]%" command
   * Requirement 5.3: WHEN le marchand tape "prix vente [produit] [marge]%", 
   * THEN le Système_Stock SHALL calculer et afficher le prix de vente recommandé par unité de base
   */
  async handleSellingMargin(
    businessId: string,
    matches: RegExpMatchArray
  ): Promise<UnitCommandResult> {
    try {
      // Extract parameters from regex match
      // Expected format: prix vente [produit] [marge]%
      const productName = matches[1]?.trim();
      const margin = parseFloat(matches[2]);

      if (!productName || isNaN(margin)) {
        return {
          success: false,
          message: `❌ Format invalide. Utilisez:\n` +
            `prix vente [produit] [marge]%\n\n` +
            `Exemple: prix vente bière 40%`
        };
      }

      if (margin < 0 || margin > 1000) {
        return {
          success: false,
          message: '❌ La marge doit être entre 0% et 1000%.'
        };
      }

      // Calculate selling price
      const sellingPrice = await this.unitManagementService.calculateSellingPrice(
        businessId,
        productName,
        margin
      );

      // Get updated product info
      const priceInfo = await this.unitManagementService.getProductPriceInfo(businessId, productName);

      let message = `✅ Prix de vente calculé pour ${productName}:\n`;
      message += `📈 Marge: ${margin}%\n`;
      message += `💰 Prix de vente: ${this.formatCurrency(sellingPrice)}/${priceInfo.unitCostInBaseUnit ? 'unité' : 'pièce'}\n`;

      if (priceInfo.purchasePrice && priceInfo.unitCostInBaseUnit) {
        message += `💰 Coût unitaire: ${this.formatCurrency(priceInfo.unitCostInBaseUnit)}\n`;
        const profit = sellingPrice - priceInfo.unitCostInBaseUnit;
        message += `💵 Bénéfice par unité: ${this.formatCurrency(profit)}\n`;
      }

      message += `\n💡 Utilisez maintenant:\n`;
      message += `vente ${productName} [quantité] pour vendre`;

      return {
        success: true,
        message,
        data: { sellingPrice, margin, priceInfo }
      };

    } catch (error) {
      this.logger.error('Error calculating selling margin:', error);

      let errorMessage = '❌ Erreur lors du calcul du prix de vente.';
      if (error.message.includes('Configuration d\'unités requise')) {
        errorMessage = error.message;
      } else if (error.message.includes('Prix d\'achat requis')) {
        errorMessage = `❌ ${error.message}`;
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Handle "produit unité [nom_produit]" command to view configuration
   * Requirement 1.4: WHEN le marchand tape "produit unité [nom_produit]", 
   * THEN le Système_Stock SHALL afficher la configuration actuelle des unités pour ce produit
   */
  async handleViewUnits(
    businessId: string,
    productName: string
  ): Promise<UnitCommandResult> {
    try {
      if (!productName || productName.trim().length === 0) {
        return {
          success: false,
          message: `❌ Nom du produit requis. Utilisez:\n` +
            `produit unité [nom_produit]\n\n` +
            `Exemple: produit unité bière`
        };
      }

      const productUnit = await this.unitManagementService.getProductUnits(businessId, productName);

      if (!productUnit) {
        return {
          success: false,
          message: `❌ Aucune configuration d'unités trouvée pour ${productName}.\n\n` +
            `Configurez d'abord avec:\n` +
            `produit unité ${productName} achat [unité] [facteur] [unité_base]\n\n` +
            `Exemple: produit unité ${productName} achat caisse 24 bouteille`
        };
      }

      // Format configuration display
      const configDisplay = this.unitManagementService.formatConfigurationDisplay(productUnit);

      return {
        success: true,
        message: configDisplay,
        data: { productUnit }
      };

    } catch (error) {
      this.logger.error('Error viewing product units:', error);
      return {
        success: false,
        message: '❌ Erreur lors de la consultation de la configuration.'
      };
    }
  }

  /**
   * Handle "historique [produit]" command to view movement history
   * Requirement 7.1: WHEN le marchand tape "historique [produit]", 
   * THEN le Système_Stock SHALL afficher tous les mouvements avec les unités originales et converties
   */
  async handleMovementHistory(
    businessId: string,
    productName: string,
    limit: number = 10
  ): Promise<UnitCommandResult> {
    try {
      if (!productName || productName.trim().length === 0) {
        return {
          success: false,
          message: `❌ Nom du produit requis. Utilisez:\n` +
            `historique [nom_produit]\n\n` +
            `Exemple: historique bière`
        };
      }

      // Get movement history
      const movements = await this.stockMovementService.getMovementHistory({
        businessId,
        productName,
        limit
      });

      if (movements.length === 0) {
        return {
          success: true,
          message: `📋 Aucun mouvement trouvé pour ${productName}.\n\n` +
            `Les mouvements apparaîtront ici après:\n` +
            `• Ajout de stock\n` +
            `• Ventes\n` +
            `• Ajustements`
        };
      }

      // Get product unit configuration for display formatting
      const productUnit = await this.unitManagementService.getProductUnits(businessId, productName);

      let message = `📋 HISTORIQUE - ${productName.toUpperCase()}\n`;
      message += `(${movements.length} derniers mouvements)\n\n`;

      for (const movement of movements) {
        const date = movement.createdAt.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

        let movementType = '';
        switch (movement.movementType) {
          case 'purchase':
            movementType = '📦 Achat';
            break;
          case 'sale':
            movementType = '💰 Vente';
            break;
          case 'adjustment':
            movementType = '🔧 Ajustement';
            break;
          case 'loss':
            movementType = '❌ Perte';
            break;
          default:
            movementType = '📝 Mouvement';
        }

        message += `${date} - ${movementType}\n`;

        // Show original quantity and unit
        message += `   Quantité: ${movement.quantity} ${movement.unit}`;

        // Show base unit equivalent if different
        if (movement.unit.toLowerCase() !== (productUnit?.baseUnit?.toLowerCase() || 'pièce')) {
          message += ` (${movement.baseQuantity} ${productUnit?.baseUnit || 'pièce'}${movement.baseQuantity > 1 ? 's' : ''})`;
        }

        message += '\n';

        // Show price information if available
        if (movement.unitPrice && movement.totalAmount) {
          message += `   Prix: ${this.formatCurrency(movement.unitPrice)}/${movement.unit}`;
          message += ` - Total: ${this.formatCurrency(movement.totalAmount)}\n`;
        }

        // Show stock after movement
        if (productUnit) {
          const stockDisplay = this.unitConversionService.formatStockDisplay(movement.newStock, productUnit);
          message += `   Stock après: ${stockDisplay}\n`;
        } else {
          message += `   Stock après: ${movement.newStock} unités\n`;
        }

        message += '\n';
      }

      message += `💡 Tapez "historique ${productName}" pour actualiser`;

      return {
        success: true,
        message,
        data: { movements, productUnit }
      };

    } catch (error) {
      this.logger.error('Error getting movement history:', error);
      return {
        success: false,
        message: '❌ Erreur lors de la consultation de l\'historique.'
      };
    }
  }

  /**
   * Handle "alerte [produit] [seuil] [unité]" command to configure alerts
   * Requirement 6.1: WHEN le marchand configure "alerte [produit] [seuil] [unité]", 
   * THEN le Système_Stock SHALL créer une alerte basée sur cette unité
   */
  async handleAlertConfig(
    businessId: string,
    matches: RegExpMatchArray
  ): Promise<UnitCommandResult> {
    try {
      // Extract parameters from regex match
      // Expected format: alerte [produit] [seuil] [unité]
      const productName = matches[1]?.trim();
      const threshold = parseFloat(matches[2]);
      const unit = matches[3]?.trim();

      if (!productName || isNaN(threshold) || !unit) {
        return {
          success: false,
          message: `❌ Format invalide. Utilisez:\n` +
            `alerte [produit] [seuil] [unité]\n\n` +
            `Exemple: alerte bière 2 caisse`
        };
      }

      if (threshold <= 0) {
        return {
          success: false,
          message: '❌ Le seuil d\'alerte doit être positif.'
        };
      }

      // Set alert threshold
      const productUnit = await this.unitManagementService.setAlertThreshold(
        businessId,
        productName,
        threshold,
        unit
      );

      // Calculate threshold in base units for display
      const thresholdInBaseUnits = productUnit.alertThreshold! * productUnit.conversionFactor;

      let message = `✅ Alerte configurée pour ${productName}:\n`;
      message += `🔔 Seuil: ${threshold} ${unit}`;
      if (unit.toLowerCase() !== productUnit.baseUnit.toLowerCase()) {
        message += ` (${thresholdInBaseUnits} ${productUnit.baseUnit}${thresholdInBaseUnits > 1 ? 's' : ''})`;
      }
      message += '\n\n';

      // Check current stock against new threshold
      const currentStock = await this.stockService.getStockLevel(businessId, productName);
      const alertCheck = await this.unitManagementService.checkStockAlert(businessId, productName, currentStock);

      if (alertCheck.shouldAlert) {
        message += `⚠️ ALERTE IMMÉDIATE!\n`;
        const stockDisplay = this.unitConversionService.formatStockDisplay(currentStock, productUnit);
        message += `Stock actuel: ${stockDisplay}\n\n`;

        // Add restocking suggestion
        const suggestion = await this.unitManagementService.generateRestockingSuggestion(
          businessId,
          productName,
          currentStock
        );
        message += suggestion.message;
      } else {
        const stockDisplay = this.unitConversionService.formatStockDisplay(currentStock, productUnit);
        message += `📊 Stock actuel: ${stockDisplay}\n`;
        message += `✅ Stock au-dessus du seuil d'alerte`;
      }

      return {
        success: true,
        message,
        data: { productUnit, currentStock, alertTriggered: alertCheck.shouldAlert }
      };

    } catch (error) {
      this.logger.error('Error configuring alert:', error);

      let errorMessage = '❌ Erreur lors de la configuration de l\'alerte.';
      if (error.message.includes('Configuration d\'unités requise')) {
        errorMessage = error.message;
      } else if (error.message.includes('inconnue')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Handle "prix [produit]" command to view price information
   * Requirement 5.5: WHEN le marchand tape "prix [produit]", 
   * THEN le Système_Stock SHALL afficher les prix d'achat, unitaire de base, et de vente avec la marge
   */
  async handleViewPrices(
    businessId: string,
    productName: string
  ): Promise<UnitCommandResult> {
    try {
      if (!productName || productName.trim().length === 0) {
        return {
          success: false,
          message: `❌ Nom du produit requis. Utilisez:\n` +
            `prix [nom_produit]\n\n` +
            `Exemple: prix bière`
        };
      }

      const priceInfo = await this.unitManagementService.getProductPriceInfo(businessId, productName);
      const productUnit = await this.unitManagementService.getProductUnits(businessId, productName);

      if (!productUnit) {
        return {
          success: false,
          message: `❌ Configuration d'unités requise pour ${productName}.\n\n` +
            `Configurez d'abord avec:\n` +
            `produit unité ${productName} achat [unité] [facteur] [unité_base]`
        };
      }

      let message = `💰 PRIX - ${productName.toUpperCase()}\n\n`;

      // Purchase price information
      if (priceInfo.purchasePrice) {
        message += `📦 Prix d'achat: ${this.formatCurrency(priceInfo.purchasePrice)}/${productUnit.purchaseUnit}\n`;

        if (priceInfo.unitCostInBaseUnit) {
          message += `💰 Coût unitaire: ${this.formatCurrency(priceInfo.unitCostInBaseUnit)}/${productUnit.baseUnit}\n`;
        }
      } else {
        message += `📦 Prix d'achat: Non défini\n`;
        message += `💡 Définissez avec: prix achat ${productName} [prix] ${productUnit.purchaseUnit}\n`;
      }

      message += '\n';

      // Selling price information
      if (priceInfo.sellingPrice) {
        message += `💵 Prix de vente: ${this.formatCurrency(priceInfo.sellingPrice)}/${productUnit.baseUnit}\n`;

        if (priceInfo.profitMargin !== undefined) {
          message += `📈 Marge bénéficiaire: ${priceInfo.profitMargin.toFixed(1)}%\n`;
        }

        if (priceInfo.unitCostInBaseUnit) {
          const profit = priceInfo.sellingPrice - priceInfo.unitCostInBaseUnit;
          message += `💵 Bénéfice par ${productUnit.baseUnit}: ${this.formatCurrency(profit)}\n`;
        }
      } else {
        message += `💵 Prix de vente: Non défini\n`;

        if (priceInfo.recommendedSellingPrice) {
          message += `💡 Prix recommandé (40% marge): ${this.formatCurrency(priceInfo.recommendedSellingPrice)}/${productUnit.baseUnit}\n`;
          message += `💡 Définissez avec: prix vente ${productName} 40%\n`;
        } else {
          message += `💡 Définissez d'abord le prix d'achat\n`;
        }
      }

      message += '\n🔄 Conversion: 1 ' + productUnit.purchaseUnit + ' = ' + productUnit.conversionFactor + ' ' + productUnit.baseUnit + (productUnit.conversionFactor > 1 ? 's' : '');

      return {
        success: true,
        message,
        data: { priceInfo, productUnit }
      };

    } catch (error) {
      this.logger.error('Error viewing prices:', error);
      return {
        success: false,
        message: '❌ Erreur lors de la consultation des prix.'
      };
    }
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number, currency: string = 'XOF'): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}