import { Injectable, Logger } from '@nestjs/common';

export interface ParsedCommand {
  type: 'sale' | 'expense' | 'stock' | 'stock_query' | 'product_list' | 'price_set' | 'product_add' | 'balance' | 'report' | 'registration' | 'help' | 'unknown' | 'unit_config' | 'unit_view' | 'unit_stock' | 'unit_price_purchase' | 'unit_price_selling' | 'unit_alert' | 'unit_history' | 'unit_price_view' | 'product_delete' | 'confirm_delete' | 'cart_create' | 'cart_add' | 'cart_remove' | 'cart_view' | 'cart_finalize' | 'cart_cancel' | 'transaction_list' | 'add_owner';
  amount?: number;
  quantity?: number; // For sales by quantity (e.g., "vente 10 pain")
  product?: string;
  description?: string;
  period?: 'day' | 'week' | 'month';
  stockAction?: 'update' | 'query';
  stockQuantity?: number;
  unitPrice?: number; // For price setting commands
  helpCategory?: 'general' | 'sales' | 'expenses' | 'stock' | 'reports' | 'commands';
  confidence: number;
  originalText: string;
  language: string;
  // Unit-specific fields
  unit?: string;
  baseUnit?: string;
  purchaseUnit?: string;
  conversionFactor?: number;
  threshold?: number;
  margin?: number;
  // Transaction list fields
  transactionType?: 'sale' | 'expense' | 'all';
  limit?: number;
  // Add owner fields
  newOwnerPhoneNumber?: string;
  newOwnerName?: string;
}

export interface LanguagePatterns {
  sale: RegExp[];
  expense: RegExp[];
  stock: RegExp[];
  stockQuery: RegExp[];
  productList: RegExp[];
  priceSet: RegExp[];
  productAdd: RegExp[];
  balance: RegExp[];
  report: RegExp[];
  help: RegExp[];
  amounts: RegExp[];
  products: RegExp;
  // Unit command patterns
  unitConfig: RegExp[];
  unitView: RegExp[];
  unitStock: RegExp[];
  unitPricePurchase: RegExp[];
  unitPriceSelling: RegExp[];
  unitAlert: RegExp[];
  unitHistory: RegExp[];
  unitPriceView: RegExp[];
  productDelete: RegExp[];
  confirmDelete: RegExp[];
  cartCreate: RegExp[];
  cartAdd: RegExp[];
  cartRemove: RegExp[];
  cartView: RegExp[];
    cartFinalize: RegExp[];
    cartCancel: RegExp[];
    transactionList: RegExp[];
    addOwner: RegExp[];
}

@Injectable()
export class CommandParserService {
  private readonly logger = new Logger(CommandParserService.name);

  // French patterns
  private readonly frenchPatterns: LanguagePatterns = {
    sale: [
      // Format: vente 1000 (montant seul)
      /^(?:vente|vendu|j'ai vendu|sale)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*$/i,

      // Format with quotes: vente 10 'ciment blanc 50kg' 500
      /^(?:vente|vendu|j'ai vendu|sale)\s+(\d+)\s+['"]([^'"]+)['"]\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,

      // Format with quotes: vente 10 'ciment blanc 50kg'
      /^(?:vente|vendu|j'ai vendu|sale)\s+(\d+)\s+['"]([^'"]+)['"]$/i,

      // Format: vente 10 pain 500 (quantité + produit + montant)
      // Captures everything between first and last number as product name
      /^(?:vente|vendu|j'ai vendu|sale)\s+(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,

      // Format: vente 10 pain (quantité + produit)
      /^(?:vente|vendu|j'ai vendu|sale)\s+(\d+)\s+(.+?)$/i,

      // Format with quotes: vente 'ciment blanc 50kg' 500
      /^(?:vente|sale)\s+['"]([^'"]+)['"]\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,

      // Format: vente pain 500 (produit + montant avec CFA explicite)
      /^(?:vente|sale)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)$/i,

      // Format: vente 1500,50 huile (montant + produit)
      /^(?:vente|sale)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s+(.+)$/i,

      // Format: j'ai vendu du pain à 2000 (langage naturel)
      /^j'ai vendu\s+(?:du\s+|de\s+|le\s+|la\s+|les\s+)?(.+?)\s+(?:à|pour|a)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,

      // Format: 1000 vente (montant en premier)
      /^(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s+(?:vente|vendu|sale)\s*(.*)$/i,

      // Format: vente pain (produit sans montant - sera demandé)
      /^(?:vente|sale)\s+(.+)$/i,
    ],
    expense: [
      /^(?:dépense|depense|expense|achat|acheté|j'ai acheté)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
      /^(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s+(?:dépense|depense|expense|achat)\s*(.*)$/i,
      /^j'ai acheté\s+(?:du\s+|de\s+|le\s+|la\s+|les\s+)?(.+?)\s+(?:à|pour|a)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
      /^(?:dépense|depense|expense)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
    ],
    stock: [
      // Support quoted product names: stock 'ciment blanc 50kg' 100
      /^(?:stock|maj stock|update stock)\s+['"]([^'"]+)['"]\s+(\d+(?:[.,]\d+)?)$/i,
      // Format: stock [produit] [quantité] - greedy match to capture full product name
      // Uses lookahead to ensure we capture everything except the last number
      /^(?:stock|maj stock|update stock)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*$/i,
      /^(?:stock|maj stock|update stock)\s+(\d+(?:[.,]\d+)?)\s+(.+)$/i,
      // Support quoted names in reverse format
      /^['"]([^'"]+)['"]?\s+stock\s+(\d+(?:[.,]\d+)?)$/i,
      /^(.+?)\s+stock\s+(\d+(?:[.,]\d+)?)$/i,
    ],
    stockQuery: [
      /^(?:stock|voir stock|check stock)\s+(.+)$/i,
      /^(?:stock|voir stock|check stock)$/i,
      /^(.+?)\s+stock\s*\?*$/i,
      // Format: produit [nom] - query stock for a specific product
      /^produit\s+(.+)$/i,
    ],
    productList: [
      /^(?:produits|liste produits|voir produits|list products)$/i,
    ],
    priceSet: [
      // Support quoted product names: prix 'ciment blanc 50kg' 5000
      /^(?:prix|price)\s+['"]([^'"]+)['"]\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
      // Format: prix [produit] [montant] - capture everything except the last number
      /^(?:prix|price)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
    ],
    productAdd: [
      // Format: ajout produit 'nom_produit' prix - must be checked before the simple form
      /^(?:ajout|ajouter|add|create)\s+produit\s+['"]?([^'"]+?)['"]?\s+(?:prix|price|à)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
      // Format: ajout produit 'nom_produit' 500 - must be checked before the simple form
      /^(?:ajout|ajouter|add|create)\s+produit\s+['"]?(.+?)['"]?\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i,
      // Format: ajout produit 'nom_produit' - simple form without price
      /^(?:ajout|ajouter|add|create)\s+produit\s+['"]?([^'"]+)['"]?$/i,
      // Format: nouveau produit 'nom_produit'
      /^(?:nouveau|nouvelle|new)\s+produit\s+['"]?([^'"]+)['"]?$/i,
      // Format: créer produit 'nom_produit'
      /^(?:créer|creer|create)\s+produit\s+['"]?([^'"]+)['"]?$/i,
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
    help: [
      /^(?:aide|help|aidez-moi|help me|\?)$/i,
      /^(?:aide|help)\s+(vente|ventes|sales?)$/i,
      /^(?:aide|help)\s+(dépense|dépenses|depense|depenses|expense|expenses)$/i,
      /^(?:aide|help)\s+(stock|stocks|inventaire)$/i,
      /^(?:aide|help)\s+(unité|unités|unite|unites|unit|units)$/i,
      /^(?:aide|help)\s+(rapport|rapports|report|reports)$/i,
      /^(?:aide|help)\s+(commande|commandes|command|commands)$/i,
      /^(?:comment|how)\s+(?:faire|to|do)\s*(.*)$/i,
      /^(?:que|what)\s+(?:puis-je|can i|peux-je)\s+(?:faire|do)$/i,
    ],
    amounts: [
      /(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f|francs?)?/gi,
    ],
    products: /(?:pain|riz|huile|sucre|lait|eau|savon|café|thé|biscuit|bonbon|cigarette|allumette|pile|crédit|credit|recharge|top\s*up)/gi,

    // Unit command patterns
    unitConfig: [
      // Format: produit unité [produit] achat [unité_achat] [facteur] [unité_base]
      /^(?:produit|product)\s+(?:unité|unite|unit)\s+(\w+)\s+(?:achat|purchase)\s+(\w+)\s+(\d+)\s+(\w+)$/i,
    ],
    unitView: [
      // Format: produit unité [produit]
      /^(?:produit|product)\s+(?:unité|unite|unit)\s+(\w+)$/i,
    ],
    unitStock: [
      // Format: stock [produit] [quantité] [unité]
      /^(?:stock|maj stock|update stock)\s+(\w+)\s+(\d+(?:[.,]\d+)?)\s+(\w+)$/i,
    ],
    unitPricePurchase: [
      // Format: prix achat [produit] [prix] [unité]
      /^(?:prix|price)\s+(?:achat|purchase|buy)\s+(\w+)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s+(\w+)$/i,
    ],
    unitPriceSelling: [
      // Format: prix vente [produit] [marge]%
      /^(?:prix|price)\s+(?:vente|sell|sale)\s+(\w+)\s+(\d+(?:[.,]\d+)?)%$/i,
    ],
    unitAlert: [
      // Format: alerte [produit] [seuil] [unité]
      /^(?:alerte|alert)\s+(\w+)\s+(\d+(?:[.,]\d+)?)\s+(\w+)$/i,
    ],
    unitHistory: [
      // Format: historique [produit]
      /^(?:historique|history)\s+(\w+)$/i,
    ],
    unitPriceView: [
      // Format: prix [produit]
      /^(?:prix|price)\s+(\w+)$/i,
    ],
    productDelete: [
      // Format: supprimer produit [produit] (obligatoire: "produit" doit être présent)
      /^(?:supprimer|delete|effacer|remove)\s+produit\s+(\w+)$/i,
      /^produit\s+(?:supprimer|delete|effacer|remove)\s+(\w+)$/i,
      // Format: supprimer [produit], delete [produit], effacer [produit], remove [produit] (without "produit" keyword)
      // Note: This is checked before cartRemove to prioritize product deletion
      /^(?:supprimer|delete|effacer|remove)\s+(\w+)$/i,
    ],
    confirmDelete: [
      // Format: confirmer, oui, yes
      /^(?:confirmer|confirm|oui|yes|ok)$/i,
    ],
    cartCreate: [
      // Format: nouveau panier, créer panier, new cart, create cart
      // Note: "panier" and "cart" alone are handled by cartView
      /^(?:nouveau|nouvelle|new)\s+panier$/i,
      /^(?:créer|creer|create)\s+panier$/i,
      /^(?:new|create)\s+cart$/i,
    ],
    cartAdd: [
      // Format: ajouter [produit] [quantité], add [produit] [quantité]
      /^(?:ajouter|ajout|add)\s+(\w+)\s+(\d+(?:[.,]\d+)?)$/i,
      // Format: [produit] [quantité] (dans le contexte d'un panier actif)
      /^(\w+)\s+(\d+(?:[.,]\d+)?)$/i,
      // Format: + [produit] [quantité] (raccourci)
      /^\+\s+(\w+)\s+(\d+(?:[.,]\d+)?)$/i,
    ],
    cartRemove: [
      // Format: retirer [produit], enlever [produit] (remove/supprimer are handled by productDelete)
      /^(?:retirer|enlever)\s+(\w+)$/i,
      // Format: - [produit]
      /^-\s+(\w+)$/i,
    ],
    cartView: [
      // Format: panier, cart (view current cart)
      /^(?:panier|cart)$/i,
      // Format: voir, contenu, show, view, voir panier, show cart
      /^(?:voir|contenu|show|view|voir panier|show cart)$/i,
    ],
    cartFinalize: [
      // Format: finaliser, finalize, terminer, valider
      /^(?:finaliser|finalize|terminer|valider|confirmer vente)$/i,
    ],
    cartCancel: [
      // Format: annuler, cancel, annuler panier
      /^(?:annuler|cancel|annuler panier|cancel cart)$/i,
    ],
    transactionList: [
      // Format: transactions, transactions jour, ventes jour, liste ventes
      /^(?:transactions?|liste transactions?)$/i,
      /^(?:transactions?|liste transactions?)\s+(jour|today|semaine|week|mois|month)$/i,
      /^(?:ventes?|sales?)\s+(jour|today|semaine|week|mois|month)$/i,
      /^(?:liste\s+)?(?:ventes?|sales?)$/i,
      /^(?:dépenses?|depenses?|expenses?)\s+(jour|today|semaine|week|mois|month)$/i,
      /^(?:liste\s+)?(?:dépenses?|depenses?|expenses?)$/i,
    ],
    addOwner: [
      // Format: ajouter administrateur +226709876543 Fatou Diallo
      /^(?:ajouter|ajout|add)\s+(?:administrateur|admin|propriétaire|proprietaire|owner)\s+(\+?\d{10,15})\s+(.+)$/i,
      // Format: ajouter admin +226709876543 Fatou Diallo
      /^(?:ajouter|ajout|add)\s+admin\s+(\+?\d{10,15})\s+(.+)$/i,
      // Format: ajouter propriétaire +226709876543 Fatou Diallo
      /^(?:ajouter|ajout|add)\s+propriétaire\s+(\+?\d{10,15})\s+(.+)$/i,
      // Format: ajouter administrateur (sans paramètres - déclenche le flux)
      /^(?:ajouter|ajout|add)\s+(?:administrateur|admin|propriétaire|proprietaire|owner)$/i,
    ],
  };

  // TODO: Add Mooré (Burkina Faso) language support
  // Mooré patterns for Burkina Faso users
  // Examples: "koose 1000" (vendre), "rãmde 500" (acheter), "stock rĩis" (stock riz)
  // private readonly morePatterns: LanguagePatterns = {
  //   sale: [
  //     /^(?:koose|vendre)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
  //   ],
  //   expense: [
  //     /^(?:rãmde|acheter)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
  //   ],
  //   stock: [
  //     /^(?:stock|réserve)\s+(.+?)\s+(\d+)$/i,
  //   ],
  //   balance: [
  //     /^(?:compte|bilan)\s+(tɩ|aujourd'hui)$/i,
  //   ],
  //   products: /(?:rĩis|koom|burukutu|pɛɛn|galga)/gi,
  // };

  // TODO: Add Dioula (Mali/Côte d'Ivoire) language support  
  // Dioula patterns for West African users
  // Examples: "feereli 1000" (vendre), "san 500" (acheter)
  // private readonly dioulaPatterns: LanguagePatterns = {
  //   sale: [
  //     /^(?:feereli|vendre)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
  //   ],
  //   expense: [
  //     /^(?:san|acheter)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?\s*(.*)$/i,
  //   ],
  //   products: /(?:malo|ji|kini|taba)/gi,
  // };

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
    // Check for help first as it's a high-priority command
    let result = this.tryParseHelp(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    // Try unit commands first (higher specificity than basic commands)
    result = this.tryParseUnitConfig(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseUnitStock(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseUnitPricePurchase(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseUnitPriceSelling(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseUnitAlert(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseUnitHistory(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseUnitView(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseUnitPriceView(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    // Try stock update BEFORE stock query (more specific pattern should be checked first)
    // This fixes: "stock b9000 10" being interpreted as stock query instead of stock update
    result = this.tryParseStock(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    // Try stock query BEFORE sale to avoid false positives (e.g., "produit b9000" should be stock query, not sale)
    result = this.tryParseStockQuery(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    // Cart add with explicit "ajouter/add" should be checked before sale to avoid conflicts
    if (/^(?:ajouter|ajout|add)\s+/i.test(cleanText)) {
      result = this.tryParseCartAdd(cleanText, patterns);
      if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;
    }

    // Try basic commands
    result = this.tryParseSale(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseExpense(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseProductDelete(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseConfirmDelete(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    // Cart commands (high priority)
    result = this.tryParseCartCreate(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseCartView(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseCartFinalize(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseCartCancel(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseCartRemove(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    // Cart add should be checked with context (will be handled in bot controller)
    result = this.tryParseCartAdd(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseProductList(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseProductAdd(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParsePriceSet(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseBalance(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseReport(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseTransactionList(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    result = this.tryParseAddOwner(cleanText, patterns);
    if (result.confidence > 0.5) return { ...result, originalText: text, language: detectedLanguage } as ParsedCommand;

    // Fallback: try to extract amount and product for generic parsing
    const fallbackResult = this.tryFallbackParsing(cleanText, patterns);
    return { ...fallbackResult, originalText: text, language: detectedLanguage } as ParsedCommand;
  }

  /**
   * Detect language from text
   */
  private detectLanguage(text: string, userPreference?: string): string {
    // TODO: Add support for more languages: mooré ('mo') and dioula ('di')
    // If user has a language preference, use it
    if (userPreference && ['fr', 'wo'].includes(userPreference)) {
      return userPreference;
    }

    // Simple language detection based on keywords
    const frenchKeywords = /\b(vente|vendu|dépense|depense|bilan|rapport|stock|j'ai|pour|avec|sans|aujourd'hui|semaine|mois)\b/i;
    // const wolofKeywords = /\b(jaay|jënd|tey|ayu-bis|weer|mburu|ceeb|ataya)\b/i;

    // TODO: Add Mooré keywords detection
    // const moreKeywords = /\b(koose|rãmde|tɩ|galga|rĩis|koom|burukutu|pɛɛn|barka)\b/i;

    // TODO: Add Dioula keywords detection  
    // const dioulaKeywords = /\b(feereli|san|malo|ji|kini|taba|nba)\b/i;

    // if (wolofKeywords.test(text)) {
    //   return 'wo';
    // }

    // TODO: Uncomment when mooré support is implemented
    // if (moreKeywords.test(text)) {
    //   return 'mo';
    // }

    // TODO: Uncomment when dioula support is implemented
    // if (dioulaKeywords.test(text)) {
    //   return 'di';
    // }

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
      // case 'wo':
      //   return this.wolofPatterns;

      // TODO: Add mooré language support
      // case 'mo':
      //   return this.morePatterns;

      // TODO: Add dioula language support
      // case 'di':
      //   return this.dioulaPatterns;

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
  private tryParseSale(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    // Skip if text starts with "produit" - this should be handled by stockQuery
    if (/^produit\s+/i.test(text)) {
      return { type: 'unknown', confidence: 0 };
    }

    for (const pattern of patterns.sale) {
      const match = text.match(pattern);
      if (match) {
        let amount: number | undefined;
        let quantity: number | undefined;
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
          // Smart parsing: distinguish between quantity and amount
          const result = this.parseQuantityAndAmount(match, text);
          amount = result.amount;
          quantity = result.quantity;
          productText = result.productText;
        }

        const product = this.extractProduct(productText);

        return {
          type: 'sale',
          amount,
          quantity,
          product: product || undefined,
          description: productText.trim() || undefined,
          confidence: (amount || quantity) ? 0.9 : 0.7,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Smart parsing to distinguish between quantity and amount
   */
  private parseQuantityAndAmount(match: RegExpMatchArray, originalText: string): {
    amount?: number;
    quantity?: number;
    productText: string;
  } {
    let amount: number | undefined;
    let quantity: number | undefined;
    let productText = '';

    // Check for the specific pattern: vente 10 pain 500
    const fullPattern = /^(?:vente|vendu|j'ai vendu|sale)\s+(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?$/i;
    const fullMatch = originalText.match(fullPattern);

    if (fullMatch) {
      // Format: vente 10 pain 500 (quantity + product + amount)
      quantity = parseInt(fullMatch[1]);
      productText = fullMatch[2].trim();
      amount = this.parseAmount(fullMatch[3]);
      return { amount, quantity, productText };
    }

    // Extract all numbers and text from matches
    const numbers: number[] = [];
    const textParts: string[] = [];

    for (let i = 1; i < match.length; i++) {
      if (match[i]) {
        const num = this.parseAmount(match[i]);
        if (num !== undefined) {
          numbers.push(num);
        } else {
          textParts.push(match[i]);
        }
      }
    }

    productText = textParts.join(' ').trim();

    if (numbers.length === 1) {
      const number = numbers[0];

      // Heuristics to determine if it's quantity or amount
      if (this.isLikelyQuantity(number, productText, originalText)) {
        quantity = number;
        // For quantity sales, we need to calculate amount later or ask for price
      } else {
        amount = number;
      }
    } else if (numbers.length === 2) {
      // Two numbers: try to determine which is quantity and which is amount
      const [first, second] = numbers;

      if (this.isLikelyQuantity(first, productText, originalText)) {
        quantity = first;
        amount = second;
      } else if (this.isLikelyQuantity(second, productText, originalText)) {
        quantity = second;
        amount = first;
      } else {
        // Both seem like amounts, take the larger as amount
        amount = Math.max(first, second);
      }
    }

    return { amount, quantity, productText };
  }

  /**
   * Determine if a number is likely a quantity rather than an amount
   */
  private isLikelyQuantity(number: number, productText: string, originalText: string): boolean {
    // Small numbers (1-100) are more likely to be quantities
    if (number <= 100) {
      // Check if the pattern suggests quantity first
      // "vente 10 pain" vs "vente pain 10"
      const quantityFirstPattern = /^(?:vente|sale)\s+(\d+)\s+(.+)$/i;
      if (quantityFirstPattern.test(originalText)) {
        return true;
      }

      // Very small numbers (1-20) are almost always quantities
      if (number <= 20) {
        return true;
      }

      // Numbers 21-100 with product context are likely quantities
      if (productText && number <= 100) {
        return true;
      }
    }

    // Large numbers (>500) are more likely to be amounts in CFA
    if (number >= 500) {
      return false;
    }

    // Medium numbers (101-499) are ambiguous, use context
    // If there's a product mentioned, lean towards quantity
    if (productText && number < 500) {
      return true;
    }

    return false;
  }

  /**
   * Try to parse as expense command
   */
  private tryParseExpense(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
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
  private tryParseStock(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
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
  private tryParseStockQuery(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    // Check for "produit [nom]" pattern first (high confidence)
    // Pattern: "produit [nom]" or "produit [nom] [montant]" (montant will be ignored but detected)
    const produitPattern = /^produit\s+(.+?)(?:\s+(\d+(?:[.,]\d+)?)\s*(?:cfa|fcfa|f)?)?$/i;
    const produitMatch = text.match(produitPattern);
    if (produitMatch) {
      const product = produitMatch[1]?.trim();
      const amount = produitMatch[2] ? this.parseAmount(produitMatch[2]) : undefined;
      
      // If amount is present, this might be intended as price setting
      // But we'll still treat it as stock query and let the handler suggest using "prix" command
      return {
        type: 'stock_query',
        stockAction: 'query',
        product: product || undefined,
        // Store amount if present so handler can suggest price command
        suggestedPrice: amount,
        confidence: 0.95, // High confidence for explicit "produit" command
      };
    }

    // Check other stock query patterns
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
   * Try to parse as product delete command
   */
  private tryParseProductDelete(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.productDelete) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();

        return {
          type: 'product_delete',
          product,
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as confirm delete command
   */
  private tryParseConfirmDelete(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.confirmDelete) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'confirm_delete',
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as cart create command
   */
  private tryParseCartCreate(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.cartCreate) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'cart_create',
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as cart add command
   */
  private tryParseCartAdd(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.cartAdd) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        const quantity = parseFloat(match[2]?.replace(',', '.'));

        return {
          type: 'cart_add',
          product,
          quantity,
          confidence: 0.8, // Lower confidence, needs context validation
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as cart remove command
   */
  private tryParseCartRemove(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.cartRemove) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();

        return {
          type: 'cart_remove',
          product,
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as cart view command
   */
  private tryParseCartView(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.cartView) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'cart_view',
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as cart finalize command
   */
  private tryParseCartFinalize(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.cartFinalize) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'cart_finalize',
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as cart cancel command
   */
  private tryParseCartCancel(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.cartCancel) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'cart_cancel',
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as product list command
   */
  private tryParseProductList(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.productList) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'product_list',
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as product add command
   */
  private tryParseProductAdd(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.productAdd) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        const price = match[2] ? this.parseAmount(match[2]) : undefined;

        return {
          type: 'product_add',
          product,
          unitPrice: price,
          confidence: product ? (price ? 0.95 : 0.9) : 0.7,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as price set command
   */
  private tryParsePriceSet(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.priceSet) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        const price = this.parseAmount(match[2]);

        return {
          type: 'price_set',
          product,
          unitPrice: price,
          confidence: price ? 0.9 : 0.7,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as balance command
   */
  private tryParseBalance(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
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
  private tryParseReport(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
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
   * Try to parse as transaction list command
   */
  private tryParseTransactionList(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.transactionList) {
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

        // Determine transaction type from command
        let transactionType: 'sale' | 'expense' | 'all' = 'all';
        if (/ventes?|sales?/i.test(text)) {
          transactionType = 'sale';
        } else if (/dépenses?|depenses?|expenses?/i.test(text)) {
          transactionType = 'expense';
        }

        return {
          type: 'transaction_list',
          period,
          transactionType,
          limit: 20, // Default to 20 most recent transactions
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  private tryParseAddOwner(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.addOwner) {
      const match = text.match(pattern);
      if (match) {
        // If we have phone number and name in the match
        if (match[1] && match[2]) {
          return {
            type: 'add_owner',
            newOwnerPhoneNumber: match[1].trim(),
            newOwnerName: match[2].trim(),
            confidence: 0.95,
          };
        }
        // If only the command without parameters
        return {
          type: 'add_owner',
          confidence: 0.9,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse help command
   */
  private tryParseHelp(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.help) {
      const match = text.match(pattern);
      if (match) {
        let helpCategory: string = 'general';
        let confidence = 0.9;

        // Determine help category based on the match
        if (match[1]) {
          const category = match[1].toLowerCase();
          if (/vente|sales?|jaay/.test(category)) {
            helpCategory = 'sales';
          } else if (/dépense|depense|expense|jënd/.test(category)) {
            helpCategory = 'expenses';
          } else if (/stock|inventaire/.test(category)) {
            helpCategory = 'stock';
          } else if (/unité|unités|unite|unites|unit|units/.test(category)) {
            helpCategory = 'units';
          } else if (/rapport|report/.test(category)) {
            helpCategory = 'reports';
          } else if (/commande|command/.test(category)) {
            helpCategory = 'commands';
          }
        }

        return {
          type: 'help',
          helpCategory,
          confidence,
        };
      }
    }

    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as unit configuration command
   * Format: produit unité [produit] achat [unité_achat] [facteur] [unité_base]
   */
  private tryParseUnitConfig(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.unitConfig) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        const purchaseUnit = match[2]?.trim();
        const conversionFactor = parseInt(match[3]);
        const baseUnit = match[4]?.trim();

        return {
          type: 'unit_config',
          product,
          purchaseUnit,
          conversionFactor,
          baseUnit,
          confidence: 0.95,
        };
      }
    }
    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as unit view command
   * Format: produit unité [produit]
   */
  private tryParseUnitView(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.unitView) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();

        return {
          type: 'unit_view',
          product,
          confidence: 0.9,
        };
      }
    }
    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as unit stock command
   * Format: stock [produit] [quantité] [unité]
   */
  private tryParseUnitStock(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.unitStock) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        const quantity = parseFloat(match[2]);
        const unit = match[3]?.trim();

        return {
          type: 'unit_stock',
          product,
          stockQuantity: quantity,
          unit,
          confidence: 0.9,
        };
      }
    }
    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as unit purchase price command
   * Format: prix achat [produit] [prix] [unité]
   */
  private tryParseUnitPricePurchase(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.unitPricePurchase) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        const price = this.parseAmount(match[2]);
        const unit = match[3]?.trim();

        return {
          type: 'unit_price_purchase',
          product,
          unitPrice: price,
          unit,
          confidence: 0.9,
        };
      }
    }
    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as unit selling price command
   * Format: prix vente [produit] [marge]%
   */
  private tryParseUnitPriceSelling(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.unitPriceSelling) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        const margin = parseFloat(match[2]);

        return {
          type: 'unit_price_selling',
          product,
          margin,
          confidence: 0.9,
        };
      }
    }
    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as unit alert command
   * Format: alerte [produit] [seuil] [unité]
   */
  private tryParseUnitAlert(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.unitAlert) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();
        const threshold = parseFloat(match[2]);
        const unit = match[3]?.trim();

        return {
          type: 'unit_alert',
          product,
          threshold,
          unit,
          confidence: 0.9,
        };
      }
    }
    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as unit history command
   * Format: historique [produit]
   */
  private tryParseUnitHistory(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.unitHistory) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();

        return {
          type: 'unit_history',
          product,
          confidence: 0.9,
        };
      }
    }
    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Try to parse as unit price view command
   * Format: prix [produit]
   */
  private tryParseUnitPriceView(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
    for (const pattern of patterns.unitPriceView) {
      const match = text.match(pattern);
      if (match) {
        const product = match[1]?.trim();

        return {
          type: 'unit_price_view',
          product,
          confidence: 0.85, // Slightly lower confidence as it could conflict with price_set
        };
      }
    }
    return { type: 'unknown', confidence: 0 };
  }

  /**
   * Fallback parsing for unrecognized commands
   */
  private tryFallbackParsing(text: string, patterns: LanguagePatterns): { type: string; confidence: number;[key: string]: any } {
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
    // TODO: Add help messages for mooré and dioula languages
    if (language === 'wo') {
      return `Désolé, je n'ai pas compris. Essayez:\n` +
        `• "jaay 1000" - pour une vente\n` +
        `• "jënd 500 mburu" - pour un achat\n` +
        `• "stock pain 10" - pour mettre à jour le stock\n` +
        `• "bilan tey" - pour le bilan du jour\n\n` +
        `💡 Tapez "aide" pour une aide complète.`;
    }

    // TODO: Add mooré help message
    // if (language === 'mo') {
    //   return `Tɩ n kãng-a. Seb-a:\n` +
    //     `• "koose 1000" - koosgo\n` +
    //     `• "rãmde 500 rĩis" - rãmde\n` +
    //     `• "stock rĩis 10" - stock mise à jour\n` +
    //     `• "compte tɩ" - compte du jour\n\n` +
    //     `💡 Seb-a "ndãmde" pour aide complète.`;
    // }

    // TODO: Add dioula help message  
    // if (language === 'di') {
    //   return `N ma a faaham. A ka kɛ:\n` +
    //     `• "feereli 1000" - feereli\n` +
    //     `• "san 500 malo" - san\n` +
    //     `• "stock malo 10" - stock mise à jour\n\n` +
    //     `💡 A ka "dɛmɛ" fɔ ka dɛmɛ kɛ.`;
    // }

    return `Désolé, je n'ai pas compris. Essayez:\n` +
      `• "vente 1000" - vente de 1000 CFA\n` +
      `• "vente 10 pain 500" - vendre 10 pains pour 500 CFA au total\n` +
      `• "vente pain 250" - vendre du pain pour 250 CFA\n` +
      `• "dépense 500" ou "dépense 500 marchandise" - pour une dépense\n` +
      `• "stock pain 10" - pour mettre à jour le stock\n` +
      `• "stock pain" - pour voir le stock d'un produit\n` +
      `• "produit unité bière achat caisse 24 bouteille" - configurer les unités\n` +
      `• "bilan jour" - pour le bilan du jour\n\n` +
      `💡 **Noms composés** : Utilisez des guillemets pour les produits avec plusieurs mots ou chiffres\n` +
      `   Exemple : stock 'ciment blanc 50kg' 100\n\n` +
      `💡 Tapez "aide" pour une aide complète ou "aide unités" pour les unités multiples.`;
  }

  /**
   * Validate parsed command
   */
  validateCommand(command: ParsedCommand): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (command.type) {
      case 'sale':
        // For sales, allow either:
        // 1. Amount only (e.g., "vente 1000")
        // 2. Quantity + product (e.g., "vente 10 pain") - amount will be asked later
        // 3. Quantity + product + amount (e.g., "vente 10 pain 3000")
        if (command.quantity && command.product) {
          // Quantity-based sale: amount is optional (will be asked if missing)
          if (command.amount !== undefined && command.amount <= 0) {
            errors.push('Le montant doit être un nombre positif');
          }
          if (command.amount && command.amount > 10000000) {
            errors.push('Le montant semble trop élevé');
          }
        } else {
          // Simple sale: amount is required
          if (!command.amount || command.amount <= 0) {
            errors.push('Le montant doit être un nombre positif');
          }
          if (command.amount && command.amount > 10000000) {
            errors.push('Le montant semble trop élevé');
          }
        }
        break;

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

      case 'help':
        // Help commands are always valid
        // Validate helpCategory if provided
        if (command.helpCategory && !['general', 'sales', 'expenses', 'stock', 'units', 'reports', 'commands'].includes(command.helpCategory)) {
          errors.push('Catégorie d\'aide invalide');
        }
        break;

      case 'registration':
        // Registration commands are always valid
        break;

      // Unit command validations
      case 'unit_config':
        if (!command.product) {
          errors.push('Le nom du produit est requis');
        }
        if (!command.baseUnit) {
          errors.push('L\'unité de base est requise');
        }
        if (!command.purchaseUnit) {
          errors.push('L\'unité d\'achat est requise');
        }
        if (!command.conversionFactor || command.conversionFactor <= 0 || !Number.isInteger(command.conversionFactor)) {
          errors.push('Le facteur de conversion doit être un nombre entier positif');
        }
        if (command.conversionFactor && command.conversionFactor > 10000) {
          errors.push('Le facteur de conversion semble trop élevé (maximum: 10000)');
        }
        break;

      case 'unit_view':
      case 'unit_history':
      case 'unit_price_view':
        if (!command.product) {
          errors.push('Le nom du produit est requis');
        }
        break;

      case 'unit_stock':
        if (!command.product) {
          errors.push('Le nom du produit est requis');
        }
        if (!command.unit) {
          errors.push('L\'unité est requise');
        }
        if (command.stockQuantity === undefined || command.stockQuantity < 0) {
          errors.push('La quantité doit être un nombre positif ou zéro');
        }
        break;

      case 'unit_price_purchase':
        if (!command.product) {
          errors.push('Le nom du produit est requis');
        }
        if (!command.unit) {
          errors.push('L\'unité est requise');
        }
        if (!command.unitPrice || command.unitPrice <= 0) {
          errors.push('Le prix doit être un nombre positif');
        }
        if (command.unitPrice && command.unitPrice > 10000000) {
          errors.push('Le prix semble trop élevé');
        }
        break;

      case 'unit_price_selling':
        if (!command.product) {
          errors.push('Le nom du produit est requis');
        }
        if (command.margin === undefined || command.margin < 0 || command.margin > 1000) {
          errors.push('La marge doit être entre 0% et 1000%');
        }
        break;

      case 'unit_alert':
        if (!command.product) {
          errors.push('Le nom du produit est requis');
        }
        if (!command.unit) {
          errors.push('L\'unité est requise');
        }
        if (!command.threshold || command.threshold <= 0) {
          errors.push('Le seuil d\'alerte doit être un nombre positif');
        }
        break;

      case 'product_delete':
        if (!command.product) {
          errors.push('Le nom du produit à supprimer est requis');
        }
        break;

      case 'cart_create':
        // No validation needed for cart creation
        break;

      case 'cart_add':
        if (!command.product) {
          errors.push('Le nom du produit est requis');
        }
        if (!command.quantity || command.quantity <= 0) {
          errors.push('La quantité doit être un nombre positif');
        }
        break;

      case 'cart_remove':
        if (!command.product) {
          errors.push('Le nom du produit à retirer est requis');
        }
        break;

      case 'cart_view':
      case 'cart_finalize':
      case 'cart_cancel':
        // No validation needed for these commands
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