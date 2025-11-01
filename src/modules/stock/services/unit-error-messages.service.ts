import { Injectable } from '@nestjs/common';
import { ProductUnit } from '../entities/product-unit.entity';

export enum UnitErrorType {
  UNIT_NOT_CONFIGURED = 'UNIT_NOT_CONFIGURED',
  INVALID_CONVERSION_FACTOR = 'INVALID_CONVERSION_FACTOR',
  UNKNOWN_UNIT = 'UNKNOWN_UNIT',
  INSUFFICIENT_STOCK_FOR_UNIT = 'INSUFFICIENT_STOCK_FOR_UNIT',
  INVALID_PRICE_FORMAT = 'INVALID_PRICE_FORMAT',
  UNIT_CONFIGURATION_CONFLICT = 'UNIT_CONFIGURATION_CONFLICT',
  INVALID_PRODUCT_NAME = 'INVALID_PRODUCT_NAME',
  INVALID_UNIT_NAME = 'INVALID_UNIT_NAME',
  INVALID_QUANTITY = 'INVALID_QUANTITY',
  INVALID_MARGIN = 'INVALID_MARGIN',
  PRICE_CONSISTENCY_ERROR = 'PRICE_CONSISTENCY_ERROR',
  MISSING_CONFIGURATION = 'MISSING_CONFIGURATION',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface ErrorMessageContext {
  productName?: string;
  unit?: string;
  availableUnits?: string[];
  currentStock?: number;
  requestedQuantity?: number;
  conversionFactor?: number;
  price?: number;
  suggestions?: string[];
  examples?: string[];
}

/**
 * Service for generating French error messages with examples and contextual help
 * Implements requirements 8.2, 8.3, 8.4 for error messages and help
 */
@Injectable()
export class UnitErrorMessagesService {

  /**
   * Get error message for specific error type with context
   * Requirement 8.2: Créer tous les messages d'erreur avec exemples
   */
  getErrorMessage(errorType: UnitErrorType, context: ErrorMessageContext = {}): string {
    switch (errorType) {
      case UnitErrorType.UNIT_NOT_CONFIGURED:
        return this.getUnitNotConfiguredMessage(context);
      
      case UnitErrorType.INVALID_CONVERSION_FACTOR:
        return this.getInvalidConversionFactorMessage(context);
      
      case UnitErrorType.UNKNOWN_UNIT:
        return this.getUnknownUnitMessage(context);
      
      case UnitErrorType.INSUFFICIENT_STOCK_FOR_UNIT:
        return this.getInsufficientStockMessage(context);
      
      case UnitErrorType.INVALID_PRICE_FORMAT:
        return this.getInvalidPriceFormatMessage(context);
      
      case UnitErrorType.UNIT_CONFIGURATION_CONFLICT:
        return this.getConfigurationConflictMessage(context);
      
      case UnitErrorType.INVALID_PRODUCT_NAME:
        return this.getInvalidProductNameMessage(context);
      
      case UnitErrorType.INVALID_UNIT_NAME:
        return this.getInvalidUnitNameMessage(context);
      
      case UnitErrorType.INVALID_QUANTITY:
        return this.getInvalidQuantityMessage(context);
      
      case UnitErrorType.INVALID_MARGIN:
        return this.getInvalidMarginMessage(context);
      
      case UnitErrorType.PRICE_CONSISTENCY_ERROR:
        return this.getPriceConsistencyErrorMessage(context);
      
      case UnitErrorType.MISSING_CONFIGURATION:
        return this.getMissingConfigurationMessage(context);
      
      case UnitErrorType.VALIDATION_ERROR:
        return this.getValidationErrorMessage(context);
      
      default:
        return '❌ Erreur inconnue. Contactez le support technique.';
    }
  }  /**
 
  * Unit not configured error message
   * Requirement 8.2: Messages d'erreur avec exemples
   */
  private getUnitNotConfiguredMessage(context: ErrorMessageContext): string {
    const productName = context.productName || '[produit]';
    
    return `❌ **Unités non configurées pour ${productName}**\n\n` +
      `Pour configurer les unités, tapez:\n` +
      `📝 \`produit unité ${productName} achat [unité_achat] [facteur] [unité_base]\`\n\n` +
      `**Exemples:**\n` +
      `• \`produit unité bière achat caisse 24 bouteille\`\n` +
      `• \`produit unité riz achat sac 50 kg\`\n` +
      `• \`produit unité savon achat carton 12 pièce\`\n\n` +
      `💡 **Aide:** L'unité d'achat est celle dans laquelle vous achetez le produit, ` +
      `l'unité de base est celle dans laquelle vous le vendez.`;
  }

  /**
   * Invalid conversion factor error message
   */
  private getInvalidConversionFactorMessage(context: ErrorMessageContext): string {
    let message = `❌ **Facteur de conversion invalide**\n\n` +
      `Le facteur de conversion doit être un nombre entier positif entre 1 et 10,000.\n\n`;

    if (context.conversionFactor !== undefined) {
      message += `Valeur saisie: ${context.conversionFactor}\n\n`;
    }

    message += `**Exemples valides:**\n` +
      `• \`24\` pour une caisse de 24 bouteilles\n` +
      `• \`12\` pour un carton de 12 savons\n` +
      `• \`50\` pour un sac de 50 kg\n\n` +
      `**Exemples invalides:**\n` +
      `• \`24.5\` (doit être un nombre entier)\n` +
      `• \`-10\` (doit être positif)\n` +
      `• \`0\` (doit être supérieur à 0)`;

    if (context.suggestions && context.suggestions.length > 0) {
      message += `\n\n💡 **Suggestion:** ${context.suggestions[0]}`;
    }

    return message;
  }

  /**
   * Unknown unit error message
   */
  private getUnknownUnitMessage(context: ErrorMessageContext): string {
    const productName = context.productName || '[produit]';
    const unit = context.unit || '[unité]';
    
    let message = `❌ **Unité '${unit}' inconnue pour ${productName}**\n\n`;

    if (context.availableUnits && context.availableUnits.length > 0) {
      message += `**Unités disponibles:**\n`;
      context.availableUnits.forEach(u => {
        message += `• \`${u}\`\n`;
      });
      message += '\n';
    }

    message += `**Exemples d'utilisation:**\n`;
    if (context.availableUnits && context.availableUnits.length >= 2) {
      const [baseUnit, purchaseUnit] = context.availableUnits;
      message += `• \`stock ${productName} 5 ${purchaseUnit}\`\n` +
        `• \`stock ${productName} 24 ${baseUnit}\`\n`;
    } else {
      message += `• \`stock ${productName} 5 caisse\`\n` +
        `• \`stock ${productName} 24 bouteille\`\n`;
    }

    if (context.suggestions && context.suggestions.length > 0) {
      message += `\n💡 **Vouliez-vous dire:** ${context.suggestions.join(', ')} ?`;
    }

    return message;
  }

  /**
   * Insufficient stock error message
   */
  private getInsufficientStockMessage(context: ErrorMessageContext): string {
    const productName = context.productName || '[produit]';
    const unit = context.unit || 'unités';
    
    let message = `❌ **Stock insuffisant pour ${productName}**\n\n`;

    if (context.requestedQuantity && context.currentStock !== undefined) {
      message += `**Demandé:** ${context.requestedQuantity} ${unit}\n`;
      
      // Calculate available in requested unit
      if (context.conversionFactor && unit !== 'pièce') {
        const availableInUnit = Math.floor(context.currentStock / context.conversionFactor);
        message += `**Disponible:** ${availableInUnit} ${unit}\n`;
      }
      
      message += `**Stock total:** ${context.currentStock} unités de base\n\n`;
    }

    message += `**Actions possibles:**\n` +
      `• Réduire la quantité demandée\n` +
      `• Vérifier le stock avec \`stock ${productName}\`\n` +
      `• Réapprovisionner le produit\n\n` +
      `💡 **Conseil:** Configurez des alertes de stock pour éviter les ruptures ` +
      `avec \`alerte ${productName} [seuil] [unité]\``;

    return message;
  }  /**

   * Invalid price format error message
   */
  private getInvalidPriceFormatMessage(context: ErrorMessageContext): string {
    let message = `❌ **Format de prix invalide**\n\n`;

    if (context.price !== undefined) {
      message += `Valeur saisie: ${context.price}\n\n`;
    }

    message += `**Format correct:** Nombre entier en FCFA\n\n` +
      `**Exemples valides:**\n` +
      `• \`12000\` pour 12,000 FCFA\n` +
      `• \`500\` pour 500 FCFA\n` +
      `• \`25000\` pour 25,000 FCFA\n\n` +
      `**Exemples invalides:**\n` +
      `• \`12,000\` (pas de virgules)\n` +
      `• \`12000 FCFA\` (pas d'unité)\n` +
      `• \`12.5\` (évitez les décimales)\n` +
      `• \`-500\` (doit être positif)\n\n` +
      `💡 **Conseil:** Les prix en FCFA sont généralement des nombres entiers.`;

    return message;
  }

  /**
   * Configuration conflict error message
   */
  private getConfigurationConflictMessage(context: ErrorMessageContext): string {
    const productName = context.productName || '[produit]';
    
    let message = `⚠️ **Conflit de configuration détecté pour ${productName}**\n\n`;

    if (context.currentStock !== undefined) {
      message += `**Stock actuel:** ${context.currentStock} unités de base\n\n`;
    }

    message += `**Impact de la modification:**\n` +
      `• Les conversions d'unités seront recalculées\n` +
      `• L'historique des mouvements reste inchangé\n` +
      `• Les prix peuvent nécessiter un ajustement\n\n` +
      `**Actions recommandées:**\n` +
      `• Vérifiez que les nouvelles unités sont correctes\n` +
      `• Recalculez les prix si nécessaire\n` +
      `• Ajustez les seuils d'alerte\n\n` +
      `**Pour continuer, tapez:** \`oui\`\n` +
      `**Pour annuler, tapez:** \`non\``;

    return message;
  }

  /**
   * Invalid product name error message
   */
  private getInvalidProductNameMessage(context: ErrorMessageContext): string {
    return `❌ **Nom de produit invalide**\n\n` +
      `**Règles pour les noms de produits:**\n` +
      `• Entre 2 et 255 caractères\n` +
      `• Lettres, chiffres, espaces, tirets et points autorisés\n` +
      `• Pas de caractères spéciaux (@, #, %, etc.)\n\n` +
      `**Exemples valides:**\n` +
      `• \`bière\`\n` +
      `• \`coca-cola\`\n` +
      `• \`riz jasmin\`\n` +
      `• \`savon-lux\`\n\n` +
      `**Exemples invalides:**\n` +
      `• \`b\` (trop court)\n` +
      `• \`bière@33cl\` (caractère spécial)\n` +
      `• \`\` (vide)`;
  }

  /**
   * Invalid unit name error message
   */
  private getInvalidUnitNameMessage(context: ErrorMessageContext): string {
    return `❌ **Nom d'unité invalide**\n\n` +
      `**Règles pour les noms d'unités:**\n` +
      `• Maximum 50 caractères\n` +
      `• Lettres, chiffres, espaces, tirets et underscores autorisés\n` +
      `• Évitez les caractères spéciaux\n\n` +
      `**Unités courantes:**\n` +
      `• **Base:** pièce, bouteille, kg, litre, gramme\n` +
      `• **Achat:** caisse, carton, sac, paquet, boîte\n\n` +
      `**Exemples valides:**\n` +
      `• \`bouteille\` / \`caisse\`\n` +
      `• \`kg\` / \`sac\`\n` +
      `• \`pièce\` / \`carton\``;
  } 
 /**
   * Invalid quantity error message
   */
  private getInvalidQuantityMessage(context: ErrorMessageContext): string {
    return `❌ **Quantité invalide**\n\n` +
      `**Règles pour les quantités:**\n` +
      `• Doit être un nombre positif\n` +
      `• Maximum 1,000,000 unités\n` +
      `• Pour les unités d'achat, utilisez des nombres entiers\n\n` +
      `**Exemples valides:**\n` +
      `• \`5\` (5 unités)\n` +
      `• \`24\` (24 unités)\n` +
      `• \`100\` (100 unités)\n\n` +
      `**Exemples invalides:**\n` +
      `• \`-5\` (négatif)\n` +
      `• \`0\` (zéro)\n` +
      `• \`2.5 caisse\` (décimal pour unité d'achat)`;
  }

  /**
   * Invalid margin error message
   */
  private getInvalidMarginMessage(context: ErrorMessageContext): string {
    return `❌ **Marge bénéficiaire invalide**\n\n` +
      `**Règles pour les marges:**\n` +
      `• Entre 0% et 1000%\n` +
      `• Nombre positif uniquement\n` +
      `• Saisir seulement le nombre (sans %)\n\n` +
      `**Exemples valides:**\n` +
      `• \`40\` pour 40% de marge\n` +
      `• \`25\` pour 25% de marge\n` +
      `• \`100\` pour 100% de marge\n\n` +
      `**Marges typiques:**\n` +
      `• **Alimentaire:** 20-50%\n` +
      `• **Boissons:** 30-60%\n` +
      `• **Produits d'hygiène:** 40-80%\n\n` +
      `💡 **Conseil:** Une marge de 40% est souvent un bon point de départ.`;
  }

  /**
   * Price consistency error message
   */
  private getPriceConsistencyErrorMessage(context: ErrorMessageContext): string {
    const productName = context.productName || '[produit]';
    
    return `⚠️ **Incohérence de prix détectée pour ${productName}**\n\n` +
      `**Problème:** Le prix de vente est inférieur ou égal au coût d'achat unitaire.\n\n` +
      `**Actions recommandées:**\n` +
      `• Vérifiez le prix d'achat avec \`prix ${productName}\`\n` +
      `• Recalculez le prix de vente avec une marge appropriée\n` +
      `• Utilisez \`prix vente ${productName} [marge]%\` pour recalculer\n\n` +
      `**Exemple de correction:**\n` +
      `\`prix vente ${productName} 40\` (pour 40% de marge)\n\n` +
      `💡 **Rappel:** Prix de vente = Coût unitaire × (1 + Marge/100)`;
  }

  /**
   * Missing configuration error message
   */
  private getMissingConfigurationMessage(context: ErrorMessageContext): string {
    const productName = context.productName || '[produit]';
    
    let message = `⚠️ **Configuration incomplète pour ${productName}**\n\n`;
    
    message += `**Éléments manquants:**\n`;
    if (context.suggestions) {
      context.suggestions.forEach(suggestion => {
        message += `• ${suggestion}\n`;
      });
    }
    
    message += `\n**Configuration complète recommandée:**\n` +
      `1. \`produit unité ${productName} achat [unité] [facteur] [unité_base]\`\n` +
      `2. \`prix achat ${productName} [prix] [unité]\`\n` +
      `3. \`prix vente ${productName} [marge]%\`\n` +
      `4. \`alerte ${productName} [seuil] [unité]\`\n\n` +
      `💡 **Conseil:** Une configuration complète permet une gestion optimale du stock.`;

    return message;
  }

  /**
   * General validation error message
   */
  private getValidationErrorMessage(context: ErrorMessageContext): string {
    let message = `❌ **Erreur de validation**\n\n`;
    
    if (context.suggestions && context.suggestions.length > 0) {
      message += `**Erreurs détectées:**\n`;
      context.suggestions.forEach(error => {
        message += `• ${error}\n`;
      });
      message += '\n';
    }
    
    message += `**Aide générale:**\n` +
      `• Tapez \`aide unités\` pour voir tous les formats\n` +
      `• Tapez \`produit unité [produit]\` pour voir la configuration\n` +
      `• Tapez \`stock [produit]\` pour voir le stock actuel\n\n` +
      `💡 **Conseil:** Vérifiez la syntaxe de votre commande et réessayez.`;

    return message;
  }

  /**
   * Get help message for unit commands
   * Requirement 8.4: Messages d'aide contextuelle
   */
  getHelpMessage(topic?: string): string {
    switch (topic) {
      case 'configuration':
        return this.getConfigurationHelpMessage();
      case 'prix':
      case 'prices':
        return this.getPriceHelpMessage();
      case 'stock':
        return this.getStockHelpMessage();
      case 'alertes':
      case 'alerts':
        return this.getAlertHelpMessage();
      case 'unités':
      case 'units':
      default:
        return this.getGeneralHelpMessage();
    }
  }

  /**
   * General help message for units
   */
  private getGeneralHelpMessage(): string {
    return `📚 **Aide - Gestion des Unités Multiples**\n\n` +
      `**Commandes principales:**\n` +
      `• \`produit unité [produit] achat [unité] [facteur] [unité_base]\` - Configurer les unités\n` +
      `• \`stock [produit] [quantité] [unité]\` - Ajouter du stock\n` +
      `• \`prix achat [produit] [prix] [unité]\` - Prix d'achat\n` +
      `• \`prix vente [produit] [marge]%\` - Prix de vente\n` +
      `• \`alerte [produit] [seuil] [unité]\` - Seuil d'alerte\n\n` +
      `**Consultation:**\n` +
      `• \`stock [produit]\` - Voir le stock\n` +
      `• \`prix [produit]\` - Voir les prix\n` +
      `• \`historique [produit]\` - Voir l'historique\n\n` +
      `**Aide spécialisée:**\n` +
      `• \`aide configuration\` - Aide sur la configuration\n` +
      `• \`aide prix\` - Aide sur les prix\n` +
      `• \`aide stock\` - Aide sur la gestion de stock\n` +
      `• \`aide alertes\` - Aide sur les alertes`;
  }

  /**
   * Configuration help message
   */
  private getConfigurationHelpMessage(): string {
    return `⚙️ **Aide - Configuration des Unités**\n\n` +
      `**Syntaxe:**\n` +
      `\`produit unité [produit] achat [unité_achat] [facteur] [unité_base]\`\n\n` +
      `**Exemples concrets:**\n` +
      `• \`produit unité bière achat caisse 24 bouteille\`\n` +
      `  → 1 caisse = 24 bouteilles\n` +
      `• \`produit unité riz achat sac 50 kg\`\n` +
      `  → 1 sac = 50 kg\n` +
      `• \`produit unité savon achat carton 12 pièce\`\n` +
      `  → 1 carton = 12 pièces\n\n` +
      `**Règles importantes:**\n` +
      `• Le facteur doit être un nombre entier positif\n` +
      `• L'unité d'achat et l'unité de base doivent être différentes\n` +
      `• Utilisez des noms d'unités simples et cohérents\n\n` +
      `**Consultation:**\n` +
      `• \`produit unité [produit]\` - Voir la configuration actuelle`;
  }

  /**
   * Price help message
   */
  private getPriceHelpMessage(): string {
    return `💰 **Aide - Gestion des Prix**\n\n` +
      `**Prix d'achat:**\n` +
      `\`prix achat [produit] [prix] [unité]\`\n` +
      `• \`prix achat bière 12000 caisse\` → 12,000 FCFA/caisse\n` +
      `• \`prix achat riz 25000 sac\` → 25,000 FCFA/sac\n\n` +
      `**Prix de vente (avec marge):**\n` +
      `\`prix vente [produit] [marge]%\`\n` +
      `• \`prix vente bière 40\` → 40% de marge\n` +
      `• \`prix vente riz 25\` → 25% de marge\n\n` +
      `**Consultation:**\n` +
      `• \`prix [produit]\` - Voir tous les prix et marges\n\n` +
      `**Calculs automatiques:**\n` +
      `• Coût unitaire = Prix d'achat ÷ Facteur de conversion\n` +
      `• Prix de vente = Coût unitaire × (1 + Marge/100)\n\n` +
      `**Marges recommandées:**\n` +
      `• Alimentaire: 20-50% • Boissons: 30-60% • Hygiène: 40-80%`;
  }

  /**
   * Stock help message
   */
  private getStockHelpMessage(): string {
    return `📦 **Aide - Gestion de Stock**\n\n` +
      `**Ajouter du stock:**\n` +
      `\`stock [produit] [quantité] [unité]\`\n` +
      `• \`stock bière 5 caisse\` → Ajoute 5 caisses (120 bouteilles)\n` +
      `• \`stock bière 24 bouteille\` → Ajoute 24 bouteilles\n\n` +
      `**Consulter le stock:**\n` +
      `• \`stock [produit]\` → Stock avec conversion d'unités\n` +
      `• \`stock\` → Tous les produits\n\n` +
      `**Vente (décrément automatique):**\n` +
      `• \`vente [montant] [produit] [quantité]\`\n` +
      `• La quantité est toujours en unité de base\n\n` +
      `**Affichage intelligent:**\n` +
      `• "73 bouteilles (3 caisses + 1 bouteille)"\n` +
      `• Montre les unités d'achat complètes + reste\n\n` +
      `**Historique:**\n` +
      `• \`historique [produit]\` → Tous les mouvements avec conversions`;
  }

  /**
   * Alert help message
   */
  private getAlertHelpMessage(): string {
    return `🔔 **Aide - Alertes de Stock**\n\n` +
      `**Configuration:**\n` +
      `\`alerte [produit] [seuil] [unité]\`\n` +
      `• \`alerte bière 2 caisse\` → Alerte si < 48 bouteilles\n` +
      `• \`alerte riz 5 sac\` → Alerte si < 250 kg\n\n` +
      `**Fonctionnement:**\n` +
      `• Le seuil est converti en unités de base\n` +
      `• Alerte déclenchée lors des ventes\n` +
      `• Suggestions de réapprovisionnement automatiques\n\n` +
      `**Messages d'alerte:**\n` +
      `• Stock actuel avec conversions\n` +
      `• Seuil configuré\n` +
      `• Suggestion de commande en unités d'achat\n\n` +
      `**Seuils recommandés:**\n` +
      `• 1-2 unités d'achat pour rotation rapide\n` +
      `• 3-5 unités d'achat pour rotation lente\n` +
      `• Ajustez selon vos habitudes de réapprovisionnement`;
  }

  /**
   * Get correction suggestions for common errors
   * Requirement 8.3: Implémenter les suggestions de correction
   */
  getCorrectionSuggestions(input: string, errorType: UnitErrorType): string[] {
    const suggestions: string[] = [];

    switch (errorType) {
      case UnitErrorType.INVALID_CONVERSION_FACTOR:
        if (input.includes('.')) {
          const rounded = Math.round(parseFloat(input));
          suggestions.push(`Essayez avec ${rounded} (nombre entier)`);
        }
        break;

      case UnitErrorType.INVALID_PRICE_FORMAT:
        const cleanPrice = input.replace(/[^\d]/g, '');
        if (cleanPrice) {
          suggestions.push(`Essayez avec ${cleanPrice} (sans caractères spéciaux)`);
        }
        break;

      case UnitErrorType.UNKNOWN_UNIT:
        // Suggest similar units based on common typos
        const unitSuggestions = this.getSimilarUnits(input);
        suggestions.push(...unitSuggestions);
        break;
    }

    return suggestions;
  }

  /**
   * Get similar units for typo correction
   */
  private getSimilarUnits(input: string): string[] {
    const commonUnits = [
      'pièce', 'bouteille', 'caisse', 'carton', 'sac', 'paquet', 'boîte',
      'kg', 'gramme', 'litre', 'mètre'
    ];

    const inputLower = input.toLowerCase();
    return commonUnits.filter(unit => 
      unit.includes(inputLower) || 
      inputLower.includes(unit) ||
      this.calculateSimilarity(inputLower, unit) > 0.6
    );
  }

  /**
   * Calculate string similarity for suggestions
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate edit distance between strings
   */
  private getEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}