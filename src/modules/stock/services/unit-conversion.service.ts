import { Injectable, BadRequestException } from '@nestjs/common';
import { ProductUnit } from '../entities/product-unit.entity';
import { UnitErrorMessagesService, UnitErrorType } from './unit-error-messages.service';

export interface ParsedQuantityWithUnit {
  quantity: number;
  unit: string;
}

export interface StockDisplayInfo {
  baseQuantity: number;
  formattedDisplay: string;
  purchaseUnits: number;
  remainingBaseUnits: number;
}

@Injectable()
export class UnitConversionService {
  constructor(
    private readonly unitErrorMessagesService: UnitErrorMessagesService,
  ) {}
  /**
   * Convert quantity from any unit to base unit
   * Requirement 2.1: WHEN le marchand tape "stock [produit] [quantité] [unité_achat]", 
   * THEN le Système_Stock SHALL convertir automatiquement en unités de base
   */
  convertToBaseUnit(quantity: number, fromUnit: string, productConfig: ProductUnit): number {
    if (!productConfig) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNIT_NOT_CONFIGURED,
        { productName: 'ce produit' }
      );
      throw new BadRequestException(errorMessage);
    }

    if (quantity < 0) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.INVALID_QUANTITY
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate the unit
    if (!this.validateUnit(fromUnit, productConfig)) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNKNOWN_UNIT,
        {
          productName: productConfig.productName,
          unit: fromUnit,
          availableUnits: this.getAvailableUnits(productConfig)
        }
      );
      throw new BadRequestException(errorMessage);
    }

    // If already in base unit, return as is
    if (fromUnit.toLowerCase() === productConfig.baseUnit.toLowerCase()) {
      return quantity;
    }

    // If in purchase unit, convert to base unit
    if (fromUnit.toLowerCase() === productConfig.purchaseUnit.toLowerCase()) {
      return quantity * productConfig.conversionFactor;
    }

    throw new BadRequestException(`Conversion non supportée de l'unité '${fromUnit}'`);
  }

  /**
   * Convert quantity from base unit to specified unit
   * Requirement 4.1: WHEN le marchand tape "stock [produit]", 
   * THEN le Système_Stock SHALL afficher le stock en unités de base et en équivalent unités d'achat
   */
  convertFromBaseUnit(baseQuantity: number, toUnit: string, productConfig: ProductUnit): number {
    if (!productConfig) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNIT_NOT_CONFIGURED,
        { productName: 'ce produit' }
      );
      throw new BadRequestException(errorMessage);
    }

    if (baseQuantity < 0) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.INVALID_QUANTITY
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate the unit
    if (!this.validateUnit(toUnit, productConfig)) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNKNOWN_UNIT,
        {
          productName: productConfig.productName,
          unit: toUnit,
          availableUnits: this.getAvailableUnits(productConfig)
        }
      );
      throw new BadRequestException(errorMessage);
    }

    // If converting to base unit, return as is
    if (toUnit.toLowerCase() === productConfig.baseUnit.toLowerCase()) {
      return baseQuantity;
    }

    // If converting to purchase unit, divide by conversion factor
    if (toUnit.toLowerCase() === productConfig.purchaseUnit.toLowerCase()) {
      return Math.floor(baseQuantity / productConfig.conversionFactor);
    }

    throw new BadRequestException(`Conversion non supportée vers l'unité '${toUnit}'`);
  }

  /**
   * Format stock display with both purchase and base units
   * Requirement 4.2: WHEN le marchand tape "stock bière", 
   * THEN le Système_Stock SHALL afficher "Stock: 73 bouteilles (3 caisses + 1 bouteille)"
   */
  formatStockDisplay(baseQuantity: number, productConfig: ProductUnit): string {
    if (!productConfig) {
      return `${baseQuantity} unités`;
    }

    if (baseQuantity === 0) {
      return `0 ${productConfig.baseUnit}`;
    }

    // Calculate purchase units and remaining base units
    const purchaseUnits = Math.floor(baseQuantity / productConfig.conversionFactor);
    const remainingBaseUnits = baseQuantity % productConfig.conversionFactor;

    // If no purchase units, show only base units
    if (purchaseUnits === 0) {
      return `${baseQuantity} ${productConfig.baseUnit}${baseQuantity > 1 ? 's' : ''}`;
    }

    // If no remaining base units, show only purchase units
    if (remainingBaseUnits === 0) {
      return `${baseQuantity} ${productConfig.baseUnit}${baseQuantity > 1 ? 's' : ''} (${purchaseUnits} ${productConfig.purchaseUnit}${purchaseUnits > 1 ? 's' : ''})`;
    }

    // Show both purchase units and remaining base units
    return `${baseQuantity} ${productConfig.baseUnit}${baseQuantity > 1 ? 's' : ''} (${purchaseUnits} ${productConfig.purchaseUnit}${purchaseUnits > 1 ? 's' : ''} + ${remainingBaseUnits} ${productConfig.baseUnit}${remainingBaseUnits > 1 ? 's' : ''})`;
  }

  /**
   * Parse quantity with unit from user input
   * Requirement 2.5: Parse user input like "5 caisse" or "24 bouteille"
   * Requirement 8.2: Validation des formats d'entrée
   */
  parseQuantityWithUnit(input: string, productConfig?: ProductUnit): ParsedQuantityWithUnit {
    if (!input || input.trim().length === 0) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.VALIDATION_ERROR,
        { suggestions: ['Saisie vide. Format attendu: [quantité] [unité]'] }
      );
      throw new BadRequestException(errorMessage);
    }

    const trimmedInput = input.trim();
    
    // Try multiple parsing patterns for flexibility
    let match = this.tryParseQuantityWithUnit(trimmedInput);
    
    if (!match) {
      const exampleUnit = productConfig?.purchaseUnit || 'caisse';
      const exampleBaseUnit = productConfig?.baseUnit || 'pièce';
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.VALIDATION_ERROR,
        { 
          suggestions: [
            `Format invalide: "${input}"`,
            `Formats acceptés:`,
            `• [quantité] [unité]: "5 ${exampleUnit}"`,
            `• [quantité][unité]: "24${exampleBaseUnit}"`,
            `• [quantité] [unité]s: "5 ${exampleUnit}s"`
          ]
        }
      );
      throw new BadRequestException(errorMessage);
    }

    const quantity = parseFloat(match.quantity);
    const unit = this.normalizeUnit(match.unit);

    // Validate quantity
    if (isNaN(quantity) || quantity < 0) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.INVALID_QUANTITY
      );
      throw new BadRequestException(errorMessage);
    }

    // Additional validation for very large quantities
    if (quantity > 1000000) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.VALIDATION_ERROR,
        { suggestions: ['Quantité trop importante (maximum: 1,000,000)'] }
      );
      throw new BadRequestException(errorMessage);
    }

    // For purchase units, ensure it's a whole number
    if (productConfig && unit === productConfig.purchaseUnit.toLowerCase() && !Number.isInteger(quantity)) {
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.VALIDATION_ERROR,
        { 
          suggestions: [
            `La quantité pour l'unité d'achat "${productConfig.purchaseUnit}" doit être un nombre entier`
          ]
        }
      );
      throw new BadRequestException(errorMessage);
    }

    // Validate unit if product config is provided
    if (productConfig && !this.validateUnit(unit, productConfig)) {
      const availableUnits = this.getAvailableUnits(productConfig);
      const suggestions = this.suggestSimilarUnits(unit, availableUnits);
      
      const errorMessage = this.unitErrorMessagesService.getErrorMessage(
        UnitErrorType.UNKNOWN_UNIT,
        {
          productName: productConfig.productName,
          unit,
          availableUnits,
          suggestions
        }
      );
      
      throw new BadRequestException(errorMessage);
    }

    return {
      quantity,
      unit
    };
  }

  /**
   * Validate if a unit is supported for a product
   * Requirement 8.2: Validation des formats d'entrée
   */
  validateUnit(unit: string, productConfig: ProductUnit): boolean {
    if (!productConfig || !unit) {
      return false;
    }

    const lowerUnit = unit.toLowerCase();
    const baseUnit = productConfig.baseUnit.toLowerCase();
    const purchaseUnit = productConfig.purchaseUnit.toLowerCase();

    return lowerUnit === baseUnit || lowerUnit === purchaseUnit;
  }

  /**
   * Get list of available units for a product
   * Used for error messages and help
   */
  getAvailableUnits(productConfig: ProductUnit): string[] {
    if (!productConfig) {
      return ['pièce']; // Default unit
    }

    return [productConfig.baseUnit, productConfig.purchaseUnit];
  }

  /**
   * Validate conversion factor
   * Requirement 8.1: WHEN le marchand saisit un facteur de conversion, 
   * THEN le Système_Stock SHALL valider que c'est un nombre entier positif
   */
  validateConversionFactor(factor: number): boolean {
    return Number.isInteger(factor) && factor > 0 && factor <= 10000;
  }

  /**
   * Get detailed stock information for display
   * Returns both raw numbers and formatted display
   */
  getStockDisplayInfo(baseQuantity: number, productConfig: ProductUnit): StockDisplayInfo {
    const purchaseUnits = productConfig ? 
      Math.floor(baseQuantity / productConfig.conversionFactor) : 0;
    const remainingBaseUnits = productConfig ? 
      baseQuantity % productConfig.conversionFactor : baseQuantity;

    return {
      baseQuantity,
      formattedDisplay: this.formatStockDisplay(baseQuantity, productConfig),
      purchaseUnits,
      remainingBaseUnits
    };
  }

  /**
   * Parse quantity input without unit (assumes base unit)
   * Used for backward compatibility with existing commands
   */
  parseQuantityOnly(input: string): number {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      throw new BadRequestException('Quantité requise');
    }

    const quantity = parseFloat(trimmedInput);
    
    if (isNaN(quantity) || quantity < 0) {
      throw new BadRequestException('La quantité doit être un nombre positif');
    }

    return quantity;
  }

  /**
   * Check if input contains a unit specification
   * Used to determine parsing strategy
   */
  hasUnitSpecification(input: string): boolean {
    if (!input || input.trim().length === 0) {
      return false;
    }

    // Check if input matches various patterns with units
    const patterns = [
      /^\d+(?:\.\d+)?\s+\w+s?$/,  // "5 caisse" or "5 caisses"
      /^\d+(?:\.\d+)?\w+$/,       // "24bouteille"
      /^\d+(?:\.\d+)?\s*\w+s?$/   // "5caisse" or "5 caisse"
    ];

    return patterns.some(pattern => pattern.test(input.trim()));
  }

  /**
   * Try to parse quantity and unit from input using multiple patterns
   * Supports various input formats for user convenience
   */
  private tryParseQuantityWithUnit(input: string): { quantity: string; unit: string } | null {
    const patterns = [
      // Standard format: "5 caisse"
      /^(\d+(?:\.\d+)?)\s+(\w+)s?$/,
      // Compact format: "24bouteille"
      /^(\d+(?:\.\d+)?)(\w+)s?$/,
      // Flexible spacing: "5caisse" or "5 caisse"
      /^(\d+(?:\.\d+)?)\s*(\w+)s?$/
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return {
          quantity: match[1],
          unit: match[2]
        };
      }
    }

    return null;
  }

  /**
   * Normalize unit names to handle variations
   * Removes plural forms and standardizes casing
   */
  private normalizeUnit(unit: string): string {
    let normalized = unit.toLowerCase().trim();
    
    // Remove common plural endings
    if (normalized.endsWith('s') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    
    // Handle common unit variations
    const unitMappings: { [key: string]: string } = {
      'piece': 'pièce',
      'pieces': 'pièce',
      'pcs': 'pièce',
      'pc': 'pièce',
      'unite': 'pièce',
      'unites': 'pièce',
      'bouteille': 'bouteille',
      'btl': 'bouteille',
      'caisse': 'caisse',
      'carton': 'carton',
      'sac': 'sac',
      'paquet': 'paquet',
      'boite': 'boîte',
      'boîte': 'boîte'
    };

    return unitMappings[normalized] || normalized;
  }

  /**
   * Suggest similar units when user input doesn't match exactly
   * Uses simple string similarity to help with typos
   */
  private suggestSimilarUnits(inputUnit: string, availableUnits: string[]): string[] {
    const suggestions: string[] = [];
    const input = inputUnit.toLowerCase();

    for (const unit of availableUnits) {
      const unitLower = unit.toLowerCase();
      
      // Check for partial matches or common prefixes
      if (unitLower.includes(input) || input.includes(unitLower)) {
        suggestions.push(unit);
      } else if (this.calculateSimilarity(input, unitLower) > 0.6) {
        suggestions.push(unit);
      }
    }

    return suggestions;
  }

  /**
   * Calculate simple string similarity for unit suggestions
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate edit distance between two strings
   */
  private getEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1, // substitution
            matrix[j][i - 1] + 1,     // insertion
            matrix[j - 1][i] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Generate help message for unit input formats
   * Requirement 8.2: Gérer les cas d'erreur et messages d'aide
   */
  generateHelpMessage(productConfig?: ProductUnit): string {
    if (!productConfig) {
      return `Formats acceptés pour les quantités:\n` +
        `• [quantité] [unité]: "5 caisse"\n` +
        `• [quantité][unité]: "24pièce"\n` +
        `• [quantité] seulement: "50" (utilise l'unité par défaut)`;
    }

    const { baseUnit, purchaseUnit, conversionFactor } = productConfig;
    
    return `Formats acceptés pour ${productConfig.productName}:\n` +
      `• Unité d'achat: "[quantité] ${purchaseUnit}" (ex: "5 ${purchaseUnit}")\n` +
      `• Unité de base: "[quantité] ${baseUnit}" (ex: "${conversionFactor} ${baseUnit}")\n` +
      `• Conversion: 1 ${purchaseUnit} = ${conversionFactor} ${baseUnit}s\n` +
      `• Formats flexibles: "5${purchaseUnit}", "5 ${purchaseUnit}s", etc.`;
  }
}