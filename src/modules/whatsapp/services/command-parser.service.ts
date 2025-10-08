import { Injectable, Logger } from '@nestjs/common';

export interface ParsedCommand {
  type: 'sale' | 'expense' | 'stock' | 'stock_query' | 'balance' | 'report' | 'unknown';
  amount?: number;
  product?: string;
  description?: string;
  period?: 'day' | 'week' | 'month';
  stockAction?: 'update' | 'query';
  stockQuantity?: number;
  confidence: number;
  originalText: string;
  language: string;
}

export interface LanguagePatterns {
  sale: RegExp[];
  expense: RegExp[];
  stock: RegExp[];
  stockQuery: RegExp[];
  balance: RegExp[];
  report: RegExp[];
  amounts: RegExp[];
  products: RegExp;
}

@Injectable()
export class CommandParserService {
  private readonly logger = new Logger(CommandParserService.name);

  // French patterns
  private readonly frenchPatterns: LanguagePatterns = {
    sale: [
      /^(?:vente|vendu|j'ai vendu|sale)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
      /^(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s+(?:vente|vendu|sale)\s*(.*)$/i,
      /^j'ai vendu\s+(?:du\s+|de\s+|le\s+|la\s+|les\s+)?(.+?)\s+(?:à|pour|a)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
      /^j'ai vendu\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i, // "j'ai vendu 1000"
      /^(?:vente|sale)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
    ],
    expense: [
      /^(?:dépense|depense|expense|achat|acheté|j'ai acheté)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
      /^(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s+(?:dépense|depense|expense|achat)\s*(.*)$/i,
      /^j'ai acheté\s+(?:du\s+|de\s+|le\s+|la\s+|les\s+)?(.+?)\s+(?:à|pour|a)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
      /^(?:dépense|depense|expense)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
    ],
    stock: [
      /^(?:stock|maj stock|update stock)\s+(.+?)\s+(\d+)$/i,
      /^(?:stock|maj stock|update stock)\s+(\d+)\s+(.+)$/i,
      /^(.+?)\s+stock\s+(\d+)$/i,
    ],
    stockQuery: [
      /^(?:stock|voir stock|check stock)\s+(.+)$/i,
      /^(?:stock|voir stock|check stock)$/i,
      /^(.+?)\s+stock\s*\?*$/i,
    ],
    balance: [
      /^(?:bilan|balance|résumé|resume)\s+(jour|day|aujourd'hui|today)$/i,
      /^(?:bilan|balance|résumé|resume)\s+(semaine|week|cette semaine|this week)$/i,
      /^(?:bilan|balance|résumé|resume)\s+(mois|month|ce mois|this month)$/i,
      /^(?:bilan|balance|résumé|resume)$/i,
    ],
    report: [
      /^(?:rapport|report)\s+(?:pdf|PDF)$/i,
      /^(?:rapport|report)\s+(jour|day|semaine|week|mois|month)$/i,
      /^(?:rapport|report)$/i,
    ],
    amounts: [
      /(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f|francs?)?/gi,
    ],
    products: /(?:pain|riz|huile|sucre|lait|eau|savon|café|thé|biscuit|bonbon|cigarette|allumette|pile|crédit|credit|recharge|top\s*up)/gi,
  };

  // Wolof patterns (basic support)
  private readonly wolofPatterns: LanguagePatterns = {
    sale: [
      /^(?:jaay|sell)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
    ],
    expense: [
      /^(?:jënd|buy|acheté)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
    ],
    stock: [
      /^(?:stock|réserve)\s+(.+?)\s+(\d+)$/i,
    ],
    stockQuery: [
      /^(?:stock|réserve)\s+(.+)$/i,
      /^(?:stock|réserve)$/i,
    ],
    balance: [
      /^(?:bilan|compte)\s+(tey|aujourd'hui|today)$/i,
      /^(?:bilan|compte)\s+(ayu-bis|semaine|week)$/i,
      /^(?:bilan|compte)\s+(weer|mois|month)$/i,
      /^(?:bilan|compte)$/i,
    ],
    report: [
      /^(?:rapport|report)$/i,
    ],
    amounts: [
      /(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f|francs?)?/gi,
    ],
    products: /(?:mburu|ceeb|néré|ataya|café|lait|pain|riz)/gi,
  };

  /**
   * Parse a message and extract command information
   */
  parseMessage(text: string, userLanguage?: string): ParsedCommand {
    const cleanText = this.cleanText(text);
    const detectedLanguage = this.detectLanguage(cleanText, userLanguage);
    
    this.logger.debug(`Parsing message: "${cleanText}" (language: ${detectedLanguage})`);

    // Try to parse with detected language patterns
    const patterns = this.getPatterns(detectedLanguage);
    
    // Try each command type in order of specificity
    let result = this.tryParseSale(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseExpense(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseStock(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseStockQuery(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseBalance(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseReport(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    // Fallback: try to extract amount and product for generic parsing
    const fallbackResult = this.tryFallbackParsing(cleanText, patterns);
    return { ...fallbackResult, originalText: text, language: detectedLanguage } as ParsedCommand;
  }

  /**
   * Detect language from text
   */
  private detectLanguage(text: string, userPreference?: string): string {
    // If user has a language preference, use it
    if (userPreference && ['fr', 'wo'].includes(userPreference)) {
      return userPreference;
    }

    // Simple language detection based on keywords
    const frenchKeywords = /\b(vente|vendu|dépense|depense|bilan|rapport|stock|j'ai|pour|avec|sans|aujourd'hui|semaine|mois)\b/i;
    const wolofKeywords = /\b(jaay|jënd|tey|ayu-bis|weer|mburu|ceeb|ataya)\b/i;

    if (wolofKeywords.test(text)) {
      return 'wo';
    }
    
    if (frenchKeywords.test(text)) {
      return 'fr';
    }

    // Default to French
    return 'fr';
  }

  /**
   * Get patterns for specified language
   */
  private getPatterns(language: string): LanguagePatterns {
    switch (language) {
      case 'wo':
        return this.wolofPatterns;
      case 'fr':
      default:
        return this.frenchPatterns;
    }
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[''`]/g, "'") // Normalize apostrophes (including straight apostrophe)
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/\./g, ','); // Normalize decimal separator to comma
  }

  /**
   * Try to parse as sale command
   */
  private tryParseSale(text: string, patterns: LanguagePatterns): { type: string; confidence: number; [key: string]: any } {
    for (const pattern of patterns.sale) {
      const match = text.match(pattern);
      if (match) {
        let amount: number | undefined;
        let productText = '';

        // Check if this is a natural language pattern (contains "j'ai vendu")
        if (text.includes("j'ai vendu")) {
          // Check if this is "j'ai vendu AMOUNT" pattern (no product)
          if (match.length === 2 && this.parseAmount(match[1])) {
            amount = this.parseAmount(match[1]);
            productText = '';
          } else {
            // For "j'ai vendu du pain à 2000" - product is match[1], amount is match[2]
            productText = match[1] || '';
            amount = this.parseAmount(match[2]);
          }
        } else {
          // For other patterns, try to identify which match group contains the amount
          for (let i = 1; i < match.length; i++) {
            const possibleAmount = this.parseAmount(match[i]);
            if (possibleAmount) {
              amount = possibleAmount;
              // The other matches are product/description
              productText = match.filter((m, idx) => idx !== 0 && idx !== i && m).join(' ');
              break;
            }
          }
        }

        const product = this.extractProduct(productText);

        return {
          type: 'sale',
          amount,
          product: product || undefined,
          description: productText.trim() || undefined,
          confidence: amount ? 0.9 : 0.7,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as expense command
   */
  private tryParseExpense(text: string, patterns: LanguagePatterns): { type: string; confidence: number; [key: string]: any } {
    for (const pattern of patterns.expense) {
      const match = text.match(pattern);
      if (match) {
        let amount: number | undefined;
        let descriptionText = '';

        // Check if this is a natural language pattern (contains "j'ai acheté")
        if (text.includes("j'ai acheté")) {
          // For "j'ai acheté du sucre à 1000" - product is match[1], amount is match[2]
          descriptionText = match[1] || '';
          amount = this.parseAmount(match[2]);
        } else {
          // For other patterns, try to identify which match group contains the amount
          for (let i = 1; i < match.length; i++) {
            const possibleAmount = this.parseAmount(match[i]);
            if (possibleAmount) {
              amount = possibleAmount;
              // The other matches are product/description
              descriptionText = match.filter((m, idx) => idx !== 0 && idx !== i && m).join(' ');
              break;
            }
          }
        }

        const product = this.extractProduct(descriptionText);

        return {
          type: 'expense',
          amount,
          product: product || undefined,
          description: descriptionText.trim() || undefined,
          confidence: amount ? 0.9 : 0.7,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as stock update command
   */
  private tryParseStock(text: string, patterns: LanguagePatterns): { type: string; confidence: number; [key: string]: any } {
    for (const pattern of patterns.stock) {
      const match = text.match(pattern);
      if (match) {
        // Pattern could be: product quantity or quantity product
        let product: string;
        let quantity: number;

        if (isNaN(Number(match[1]))) {
          // First match is product, second is quantity
          product = match[1].trim();
          quantity = parseInt(match[2]);
        } else {
          // First match is quantity, second is product
          quantity = parseInt(match[1]);
          product = match[2].trim();
        }

        return {
          type: 'stock',
          stockAction: 'update',
          product,
          stockQuantity: quantity,
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as stock query command
   */
  private tryParseStockQuery(text: string, patterns: LanguagePatterns): { type: string; confidence: number; [key: string]: any } {
    for (const pattern of patterns.stockQuery) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        
        return {
          type: 'stock_query',
          stockAction: 'query',
          product: product || undefined,
          confidence: 0.8,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as balance command
   */
  private tryParseBalance(text: string, patterns: LanguagePatterns): { type: string; confidence: number; [key: string]: any } {
    for (const pattern of patterns.balance) {
      const match = text.match(pattern);
      if (match) {
        const periodText = match[1]?.toLowerCase();
        let period: 'day' | 'week' | 'month' = 'day';

        if (periodText) {
          if (/semaine|week|ayu-bis/.test(periodText)) {
            period = 'week';
          } else if (/mois|month|weer/.test(periodText)) {
            period = 'month';
          }
        }

        return {
          type: 'balance',
          period,
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as report command
   */
  private tryParseReport(text: string, patterns: LanguagePatterns): { type: string; confidence: number; [key: string]: any } {
    for (const pattern of patterns.report) {
      const match = text.match(pattern);
      if (match) {
        const periodText = match[1]?.toLowerCase();
        let period: 'day' | 'week' | 'month' = 'day';

        if (periodText) {
          if (/semaine|week/.test(periodText)) {
            period = 'week';
          } else if (/mois|month/.test(periodText)) {
            period = 'month';
          }
        }

        return {
          type: 'report',
          period,
          confidence: 0.8,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Fallback parsing for unrecognized commands
   */
  private tryFallbackParsing(text: string, patterns: LanguagePatterns): { type: string; confidence: number; [key: string]: any } {
    // Try to extract amount and product even if command type is unclear
    const amount = this.extractAmount(text, patterns);
    const product = this.extractProduct(text);

    if (amount && amount > 0) {
      // If we have an amount, guess the command type based on context
      if (/achat|acheté|dépense|depense|expense|jënd/.test(text)) {
        return {
          type: 'expense',
          amount,
          product: product || undefined,
          description: text,
          confidence: 0.4,
        };
      } else {
        // Default to sale if we have an amount
        return {
          type: 'sale',
          amount,
          product: product || undefined,
          description: text,
          confidence: 0.3,
        };
      }
    }

    return {
      type: 'unknown',
      confidence: 0,
    };
  }

  /**
   * Parse amount from text
   */
  private parseAmount(text: string): number | undefined {
    if (!text) return undefined;
    
    // Replace comma with dot for decimal parsing
    const normalizedText = text.replace(',', '.');
    const amount = parseFloat(normalizedText);
    
    return isNaN(amount) || amount <= 0 ? undefined : amount;
  }

  /**
   * Extract amount from text using patterns
   */
  private extractAmount(text: string, patterns: LanguagePatterns): number | undefined {
    const matches = text.match(patterns.amounts[0]);
    if (matches && matches.length > 0) {
      // Get the first amount found
      const amountText = matches[0].replace(/[^\d.,]/g, '');
      return this.parseAmount(amountText);
    }
    return undefined;
  }

  /**
   * Extract product name from text
   */
  private extractProduct(text: string): string | null {
    if (!text) return null;

    // First try to match known products
    const productMatch = text.match(this.frenchPatterns.products);
    if (productMatch) {
      return productMatch[0].toLowerCase();
    }

    // If no known product found, try to extract a reasonable product name
    // Remove common words and amounts
    const cleanedText = text
      .replace(/\d+(?:[.,]\d+)?/g, '') // Remove numbers
      .replace(/\b(?:cfa|fcfa|f|francs?|pour|avec|sans|de|du|la|le|les|un|une|des)\b/gi, '') // Remove common words
      .trim();

    if (cleanedText.length > 0 && cleanedText.length < 50) {
      return cleanedText;
    }

    return null;
  }

  /**
   * Get help message for unrecognized commands
   */
  getHelpMessage(language: string = 'fr'): string {
    if (language === 'wo') {
      return `Désolé, je n'ai pas compris. Essayez:
• "jaay 1000" - pour une vente
• "jënd 500 mburu" - pour un achat
• "stock pain 10" - pour mettre à jour le stock
• "bilan tey" - pour le bilan du jour`;
    }

    return `Désolé, je n'ai pas compris. Essayez:
• "vente 1000" ou "vente pain 1000" - pour enregistrer une vente
• "dépense 500" ou "dépense 500 marchandise" - pour une dépense
• "stock pain 10" - pour mettre à jour le stock
• "stock pain" - pour voir le stock d'un produit
• "bilan jour" - pour le bilan du jour
• "rapport PDF" - pour générer un rapport`;
  }

  /**
   * Validate parsed command
   */
  validateCommand(command: ParsedCommand): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (command.type) {
      case 'sale':
      case 'expense':
        if (!command.amount || command.amount <= 0) {
          errors.push('Le montant doit être un nombre positif');
        }
        if (command.amount && command.amount > 10000000) {
          errors.push('Le montant semble trop élevé');
        }
        break;

      case 'stock':
        if (!command.product) {
          errors.push('Le nom du produit est requis');
        }
        if (command.stockQuantity === undefined || command.stockQuantity < 0) {
          errors.push('La quantité doit être un nombre positif ou zéro');
        }
        break;

      case 'stock_query':
        // No specific validation needed
        break;

      case 'balance':
      case 'report':
        if (command.period && !['day', 'week', 'month'].includes(command.period)) {
          errors.push('Période invalide. Utilisez: jour, semaine, ou mois');
        }
        break;

      case 'unknown':
        errors.push('Commande non reconnue');
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}