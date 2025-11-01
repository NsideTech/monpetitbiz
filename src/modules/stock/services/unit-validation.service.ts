import { Injectable, BadRequestException } from '@nestjs/common';
import { ProductUnit } from '../entities/product-unit.entity';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ConversionFactorValidation extends ValidationResult {
  suggestedValue?: number;
}

export interface PriceValidation extends ValidationResult {
  formattedPrice?: number;
}

export interface ConfigurationConsistencyValidation extends ValidationResult {
  conflicts: string[];
  suggestions: string[];
}

/**
 * Service for validating unit configurations, prices, and data consistency
 * Implements requirements 8.1, 8.2, 8.3, 8.4, 8.5 for validation and error handling
 */
@Injectable()
export class UnitValidationService {
  
  /**
   * Validate conversion factor
   * Requirement 8.1: WHEN le marchand saisit un facteur de conversion, 
   * THEN le Système_Stock SHALL valider que c'est un nombre entier positif
   */
  validateConversionFactor(factor: any): ConversionFactorValidation {
    const errors: string[] = [];
    let suggestedValue: number | undefined;

    // Check if factor is provided
    if (factor === null || factor === undefined) {
      errors.push('Le facteur de conversion est requis');
      return { isValid: false, errors };
    }

    // Convert to number if it's a string
    const numericFactor = typeof factor === 'string' ? parseFloat(factor) : factor;

    // Check if it's a valid number
    if (isNaN(numericFactor)) {
      errors.push('Le facteur de conversion doit être un nombre');
      errors.push('Exemple: 24 pour une caisse de 24 bouteilles');
      return { isValid: false, errors };
    }

    // Check if it's positive
    if (numericFactor <= 0) {
      errors.push('Le facteur de conversion doit être positif');
      suggestedValue = Math.abs(numericFactor) || 1;
      return { isValid: false, errors, suggestedValue };
    }

    // Check if it's an integer
    if (!Number.isInteger(numericFactor)) {
      errors.push('Le facteur de conversion doit être un nombre entier');
      suggestedValue = Math.round(numericFactor);
      return { isValid: false, errors, suggestedValue };
    }

    // Check reasonable limits
    if (numericFactor > 10000) {
      errors.push('Le facteur de conversion ne peut pas dépasser 10,000');
      errors.push('Vérifiez que vous utilisez les bonnes unités');
      suggestedValue = 10000;
      return { isValid: false, errors, suggestedValue };
    }

    if (numericFactor === 1) {
      return {
        isValid: true,
        errors: [],
        warnings: ['Un facteur de 1 signifie que les unités d\'achat et de base sont identiques']
      };
    }

    return { isValid: true, errors: [] };
  }  /**
   
* Validate price format
   * Requirement 8.2: Validation des formats de prix
   */
  validatePriceFormat(price: any, context?: string): PriceValidation {
    const errors: string[] = [];
    const contextStr = context ? ` ${context}` : '';

    // Check if price is provided
    if (price === null || price === undefined) {
      errors.push(`Le prix${contextStr} est requis`);
      return { isValid: false, errors };
    }

    // Convert to number if it's a string
    const numericPrice = typeof price === 'string' ? parseFloat(price.replace(/\s/g, '')) : price;

    // Check if it's a valid number
    if (isNaN(numericPrice)) {
      errors.push(`Le prix${contextStr} doit être un nombre`);
      errors.push('Format accepté: 12000 (en FCFA)');
      return { isValid: false, errors };
    }

    // Check if it's positive
    if (numericPrice <= 0) {
      errors.push(`Le prix${contextStr} doit être positif`);
      return { isValid: false, errors };
    }

    // Check reasonable limits for FCFA
    if (numericPrice > 100000000) { // 100 million FCFA
      errors.push(`Le prix${contextStr} semble trop élevé (maximum: 100,000,000 FCFA)`);
      errors.push('Vérifiez que vous avez saisi le bon montant');
      return { isValid: false, errors };
    }

    if (numericPrice < 1) {
      errors.push(`Le prix${contextStr} doit être d'au moins 1 FCFA`);
      return { isValid: false, errors };
    }

    // Warn about decimal prices (unusual for FCFA)
    const warnings: string[] = [];
    if (!Number.isInteger(numericPrice)) {
      warnings.push('Les prix en FCFA sont généralement des nombres entiers');
    }

    return { 
      isValid: true, 
      errors: [], 
      warnings,
      formattedPrice: Math.round(numericPrice)
    };
  }

  /**
   * Validate profit margin
   * Requirement 8.2: Validation des formats de prix et marges
   */
  validateProfitMargin(margin: any): ValidationResult {
    const errors: string[] = [];

    if (margin === null || margin === undefined) {
      errors.push('La marge bénéficiaire est requise');
      return { isValid: false, errors };
    }

    const numericMargin = typeof margin === 'string' ? parseFloat(margin) : margin;

    if (isNaN(numericMargin)) {
      errors.push('La marge doit être un nombre');
      errors.push('Exemple: 40 pour 40%');
      return { isValid: false, errors };
    }

    if (numericMargin < 0) {
      errors.push('La marge ne peut pas être négative');
      return { isValid: false, errors };
    }

    if (numericMargin > 1000) {
      errors.push('La marge ne peut pas dépasser 1000%');
      errors.push('Vérifiez que vous avez saisi le bon pourcentage');
      return { isValid: false, errors };
    }

    const warnings: string[] = [];
    if (numericMargin > 200) {
      warnings.push('Marge très élevée (>200%). Vérifiez vos calculs.');
    } else if (numericMargin < 5) {
      warnings.push('Marge très faible (<5%). Vérifiez la rentabilité.');
    }

    return { isValid: true, errors: [], warnings };
  }  /**
 
  * Validate unit names
   * Requirement 8.2: Validation des formats d'entrée
   */
  validateUnitName(unitName: any, context?: string): ValidationResult {
    const errors: string[] = [];
    const contextStr = context ? ` ${context}` : '';

    if (!unitName || (typeof unitName === 'string' && unitName.trim().length === 0)) {
      errors.push(`Le nom de l'unité${contextStr} est requis`);
      return { isValid: false, errors };
    }

    const unitStr = String(unitName).trim();

    if (unitStr.length > 50) {
      errors.push(`Le nom de l'unité${contextStr} ne peut pas dépasser 50 caractères`);
      return { isValid: false, errors };
    }

    // Check for invalid characters
    if (!/^[a-zA-ZÀ-ÿ0-9\s\-_]+$/.test(unitStr)) {
      errors.push(`Le nom de l'unité${contextStr} contient des caractères invalides`);
      errors.push('Utilisez seulement des lettres, chiffres, espaces, tirets et underscores');
      return { isValid: false, errors };
    }

    // Check for common unit names and suggest standardization
    const warnings: string[] = [];
    const standardUnits = this.getStandardUnitSuggestions(unitStr);
    if (standardUnits.length > 0) {
      warnings.push(`Unités standards suggérées: ${standardUnits.join(', ')}`);
    }

    return { isValid: true, errors: [], warnings };
  }

  /**
   * Validate product name
   * Requirement 8.2: Validation des formats d'entrée
   */
  validateProductName(productName: any): ValidationResult {
    const errors: string[] = [];

    if (!productName || (typeof productName === 'string' && productName.trim().length === 0)) {
      errors.push('Le nom du produit est requis');
      return { isValid: false, errors };
    }

    const nameStr = String(productName).trim();

    if (nameStr.length > 255) {
      errors.push('Le nom du produit ne peut pas dépasser 255 caractères');
      return { isValid: false, errors };
    }

    if (nameStr.length < 2) {
      errors.push('Le nom du produit doit contenir au moins 2 caractères');
      return { isValid: false, errors };
    }

    // Check for invalid characters
    if (!/^[a-zA-ZÀ-ÿ0-9\s\-_\.]+$/.test(nameStr)) {
      errors.push('Le nom du produit contient des caractères invalides');
      errors.push('Utilisez seulement des lettres, chiffres, espaces, tirets, underscores et points');
      return { isValid: false, errors };
    }

    return { isValid: true, errors: [] };
  }  
/**
   * Validate configuration consistency
   * Requirement 8.3: Validation de cohérence des configurations
   */
  validateConfigurationConsistency(
    productUnit: ProductUnit,
    currentStock?: number
  ): ConfigurationConsistencyValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const conflicts: string[] = [];
    const suggestions: string[] = [];

    // Check unit consistency
    if (productUnit.baseUnit.toLowerCase() === productUnit.purchaseUnit.toLowerCase()) {
      conflicts.push('L\'unité de base et l\'unité d\'achat sont identiques');
      suggestions.push('Utilisez des unités différentes (ex: bouteille/caisse, pièce/carton)');
    }

    // Check conversion factor consistency
    if (productUnit.conversionFactor === 1 && 
        productUnit.baseUnit.toLowerCase() !== productUnit.purchaseUnit.toLowerCase()) {
      warnings.push('Facteur de conversion de 1 avec des unités différentes');
      suggestions.push('Vérifiez que les unités sont correctement configurées');
    }

    // Check price consistency
    if (productUnit.purchasePrice && productUnit.sellingPrice) {
      const unitCostInBaseUnit = productUnit.purchasePrice / productUnit.conversionFactor;
      
      if (productUnit.sellingPrice <= unitCostInBaseUnit) {
        conflicts.push('Le prix de vente est inférieur ou égal au coût unitaire');
        suggestions.push(`Coût unitaire: ${Math.round(unitCostInBaseUnit)} FCFA, Prix de vente: ${productUnit.sellingPrice} FCFA`);
      }

      // Check if margin is realistic
      const actualMargin = ((productUnit.sellingPrice - unitCostInBaseUnit) / unitCostInBaseUnit) * 100;
      if (productUnit.profitMargin && Math.abs(actualMargin - productUnit.profitMargin) > 1) {
        warnings.push(`Marge calculée (${Math.round(actualMargin)}%) différente de la marge enregistrée (${productUnit.profitMargin}%)`);
        suggestions.push('Recalculez les prix pour assurer la cohérence');
      }
    }

    // Check alert threshold consistency
    if (productUnit.alertThreshold && currentStock !== undefined) {
      const thresholdInBaseUnits = productUnit.alertThreshold * productUnit.conversionFactor;
      
      if (currentStock <= thresholdInBaseUnits) {
        warnings.push('Le stock actuel est en dessous du seuil d\'alerte');
        suggestions.push('Considérez un réapprovisionnement');
      }

      if (productUnit.alertThreshold > 100) {
        warnings.push('Seuil d\'alerte très élevé (>100 unités d\'achat)');
        suggestions.push('Vérifiez que le seuil correspond à vos besoins');
      }
    }

    // Check for missing essential configuration
    if (!productUnit.purchasePrice) {
      warnings.push('Prix d\'achat non configuré');
      suggestions.push(`Configurez avec: prix achat ${productUnit.productName} [prix] ${productUnit.purchaseUnit}`);
    }

    if (!productUnit.sellingPrice) {
      warnings.push('Prix de vente non configuré');
      suggestions.push(`Configurez avec: prix vente ${productUnit.productName} [marge]%`);
    }

    if (!productUnit.alertThreshold) {
      warnings.push('Seuil d\'alerte non configuré');
      suggestions.push(`Configurez avec: alerte ${productUnit.productName} [seuil] ${productUnit.purchaseUnit}`);
    }

    const isValid = errors.length === 0 && conflicts.length === 0;

    return {
      isValid,
      errors,
      warnings,
      conflicts,
      suggestions
    };
  }  
/**
   * Validate complete product unit configuration
   * Requirement 8.1, 8.2, 8.3: Comprehensive validation
   */
  validateCompleteConfiguration(config: {
    productName: string;
    baseUnit: string;
    purchaseUnit: string;
    conversionFactor: number;
    purchasePrice?: number;
    sellingPrice?: number;
    profitMargin?: number;
    alertThreshold?: number;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each component
    const productNameValidation = this.validateProductName(config.productName);
    if (!productNameValidation.isValid) {
      errors.push(...productNameValidation.errors);
    }

    const baseUnitValidation = this.validateUnitName(config.baseUnit, 'de base');
    if (!baseUnitValidation.isValid) {
      errors.push(...baseUnitValidation.errors);
    }
    if (baseUnitValidation.warnings) {
      warnings.push(...baseUnitValidation.warnings);
    }

    const purchaseUnitValidation = this.validateUnitName(config.purchaseUnit, 'd\'achat');
    if (!purchaseUnitValidation.isValid) {
      errors.push(...purchaseUnitValidation.errors);
    }
    if (purchaseUnitValidation.warnings) {
      warnings.push(...purchaseUnitValidation.warnings);
    }

    const conversionFactorValidation = this.validateConversionFactor(config.conversionFactor);
    if (!conversionFactorValidation.isValid) {
      errors.push(...conversionFactorValidation.errors);
    }
    if (conversionFactorValidation.warnings) {
      warnings.push(...conversionFactorValidation.warnings);
    }

    // Validate optional price fields
    if (config.purchasePrice !== undefined) {
      const purchasePriceValidation = this.validatePriceFormat(config.purchasePrice, 'd\'achat');
      if (!purchasePriceValidation.isValid) {
        errors.push(...purchasePriceValidation.errors);
      }
      if (purchasePriceValidation.warnings) {
        warnings.push(...purchasePriceValidation.warnings);
      }
    }

    if (config.sellingPrice !== undefined) {
      const sellingPriceValidation = this.validatePriceFormat(config.sellingPrice, 'de vente');
      if (!sellingPriceValidation.isValid) {
        errors.push(...sellingPriceValidation.errors);
      }
      if (sellingPriceValidation.warnings) {
        warnings.push(...sellingPriceValidation.warnings);
      }
    }

    if (config.profitMargin !== undefined) {
      const marginValidation = this.validateProfitMargin(config.profitMargin);
      if (!marginValidation.isValid) {
        errors.push(...marginValidation.errors);
      }
      if (marginValidation.warnings) {
        warnings.push(...marginValidation.warnings);
      }
    }

    // Cross-field validations
    if (config.baseUnit && config.purchaseUnit && 
        config.baseUnit.toLowerCase() === config.purchaseUnit.toLowerCase()) {
      errors.push('L\'unité de base et l\'unité d\'achat doivent être différentes');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }  /**
   
* Validate stock quantity for operations
   * Requirement 8.3: Validation de cohérence des opérations
   */
  validateStockQuantity(
    quantity: number,
    unit: string,
    productUnit: ProductUnit,
    availableStock: number,
    operation: 'add' | 'subtract' = 'add'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic quantity validation
    if (quantity <= 0) {
      errors.push('La quantité doit être positive');
      return { isValid: false, errors };
    }

    // Validate unit
    const availableUnits = [productUnit.baseUnit, productUnit.purchaseUnit];
    if (!availableUnits.map(u => u.toLowerCase()).includes(unit.toLowerCase())) {
      errors.push(`Unité '${unit}' inconnue pour ${productUnit.productName}`);
      errors.push(`Unités disponibles: ${availableUnits.join(', ')}`);
      return { isValid: false, errors };
    }

    // For subtraction operations, check if enough stock is available
    if (operation === 'subtract') {
      // Convert quantity to base units for comparison
      let quantityInBaseUnits = quantity;
      if (unit.toLowerCase() === productUnit.purchaseUnit.toLowerCase()) {
        quantityInBaseUnits = quantity * productUnit.conversionFactor;
      }

      if (quantityInBaseUnits > availableStock) {
        const maxInRequestedUnit = unit.toLowerCase() === productUnit.purchaseUnit.toLowerCase()
          ? Math.floor(availableStock / productUnit.conversionFactor)
          : availableStock;

        errors.push(`Stock insuffisant pour ${productUnit.productName}`);
        errors.push(`Demandé: ${quantity} ${unit}, Disponible: ${maxInRequestedUnit} ${unit}`);
        errors.push(`Stock total: ${availableStock} ${productUnit.baseUnit}${availableStock > 1 ? 's' : ''}`);
        return { isValid: false, errors };
      }

      // Warn if this operation will trigger low stock alert
      const remainingStock = availableStock - quantityInBaseUnits;
      if (productUnit.alertThreshold) {
        const alertThresholdInBaseUnits = productUnit.alertThreshold * productUnit.conversionFactor;
        if (remainingStock <= alertThresholdInBaseUnits) {
          warnings.push('Cette opération déclenchera une alerte de stock faible');
        }
      }
    }

    // Warn about large quantities
    if (operation === 'add' && quantity > 1000) {
      warnings.push('Quantité très importante. Vérifiez la saisie.');
    }

    return {
      isValid: true,
      errors,
      warnings
    };
  }

  /**
   * Get standard unit suggestions based on input
   * Helps users choose consistent unit names
   */
  private getStandardUnitSuggestions(unitName: string): string[] {
    const lowerUnit = unitName.toLowerCase();
    const suggestions: string[] = [];

    const standardUnits = {
      // Base units
      'piece': ['pièce'],
      'pieces': ['pièce'],
      'unite': ['pièce'],
      'unites': ['pièce'],
      'bouteille': ['bouteille'],
      'bouteilles': ['bouteille'],
      'litre': ['litre'],
      'litres': ['litre'],
      'kg': ['kilogramme'],
      'kilo': ['kilogramme'],
      'gramme': ['gramme'],
      'grammes': ['gramme'],
      
      // Purchase units
      'caisse': ['caisse'],
      'caisses': ['caisse'],
      'carton': ['carton'],
      'cartons': ['carton'],
      'sac': ['sac'],
      'sacs': ['sac'],
      'paquet': ['paquet'],
      'paquets': ['paquet'],
      'boite': ['boîte'],
      'boites': ['boîte'],
      'boîte': ['boîte'],
      'boîtes': ['boîte']
    };

    // Direct match
    if (standardUnits[lowerUnit]) {
      return standardUnits[lowerUnit];
    }

    // Partial match
    for (const [key, values] of Object.entries(standardUnits)) {
      if (key.includes(lowerUnit) || lowerUnit.includes(key)) {
        suggestions.push(...values);
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Generate validation summary message
   * Requirement 8.4: Messages d'aide contextuelle
   */
  generateValidationSummary(validation: ValidationResult, context?: string): string {
    const contextStr = context ? ` pour ${context}` : '';
    
    if (validation.isValid) {
      let message = `✅ Validation réussie${contextStr}`;
      if (validation.warnings && validation.warnings.length > 0) {
        message += '\n⚠️ Avertissements:\n' + validation.warnings.map(w => `• ${w}`).join('\n');
      }
      return message;
    } else {
      let message = `❌ Erreurs de validation${contextStr}:\n`;
      message += validation.errors.map(e => `• ${e}`).join('\n');
      
      if (validation.warnings && validation.warnings.length > 0) {
        message += '\n⚠️ Avertissements:\n' + validation.warnings.map(w => `• ${w}`).join('\n');
      }
      
      return message;
    }
  }
}