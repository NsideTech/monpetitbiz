import { Injectable, Logger } from '@nestjs/common';
import { ProcessedMessage } from './interfaces/webhook.interface';
import { NLPService, UserContext, NLPResult } from './services/nlp.service';
import { AuthService } from '../auth/auth.service';
import { TransactionService } from '../transaction/transaction.service';
import { StockService } from '../stock/stock.service';
import { ReportService } from '../report/report.service';
import { WhatsappService } from './whatsapp.service';
import { TwilioWhatsAppService } from './services/twilio-whatsapp.service';
import { RegistrationHandlerService } from './services/registration-handler.service';
import { OnboardingCheckMiddleware } from './middleware/onboarding-check.middleware';
import { HelpService, HelpContext } from './services/help.service';
import { UnitCommandHandler } from './services/unit-command-handler.service';
import { ConfirmationStateService } from './services/confirmation-state.service';
import { SaleSessionService } from './services/sale-session.service';
import { InvoiceService } from '../invoice/invoice.service';
import { TransactionType } from '../transaction/entities/transaction.entity';
import { ReportPeriod } from '../report/dto/report.dto';
import { CartCreateHandler } from './handlers/cart-create-handler';
import { CartHandlers } from './handlers/cart-handlers';

export interface BotResponse {
  success: boolean;
  message: string;
  data?: any;
  requiresAuth?: boolean;
}

@Injectable()
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(
    private readonly nlpService: NLPService,
    private readonly authService: AuthService,
    private readonly transactionService: TransactionService,
    private readonly stockService: StockService,
    private readonly reportService: ReportService,
    private readonly whatsappService: WhatsappService,
    private readonly twilioWhatsAppService: TwilioWhatsAppService,
    private readonly registrationHandlerService: RegistrationHandlerService,
    private readonly onboardingCheckMiddleware: OnboardingCheckMiddleware,
    private readonly helpService: HelpService,
    private readonly unitCommandHandler: UnitCommandHandler,
    private readonly confirmationStateService: ConfirmationStateService,
    private readonly saleSessionService: SaleSessionService,
    private readonly invoiceService: InvoiceService,
    private readonly cartCreateHandler: CartCreateHandler,
    private readonly cartHandlers: CartHandlers,
  ) { }

  /**
   * Main entry point for processing WhatsApp messages
   * This orchestrates all services to handle user commands
   */
  async processMessage(message: ProcessedMessage): Promise<BotResponse> {
    this.logger.log(`Processing message from ${message.from}: "${message.body}"`);

    try {
      // FIRST: Check if user is in registration flow (before middleware)
      if (this.registrationHandlerService.isInRegistrationFlow(message.from)) {
        return await this.handleRegistrationFlow(message);
      }

      // SECOND: Check onboarding status using middleware
      const interceptResult = await this.onboardingCheckMiddleware.interceptMessage(
        message.from,
        message.body
      );

      // If middleware says not to process and provides a response, send it
      if (!interceptResult.shouldProcess && interceptResult.response) {
        await this.sendErrorMessage(message.from, interceptResult.response);
        return {
          success: false,
          message: interceptResult.response,
          requiresAuth: interceptResult.redirectToOnboarding
        };
      }

      // Get user context
      const userContext = await this.getUserContext(message.from);

      // If there was a database connection error, retry once and inform user
      if (userContext.dbError) {
        this.logger.warn(`Database connection error for ${message.from}, retrying...`);
        
        // Retry once after a short delay
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryContext = await this.getUserContext(message.from);
        
        // If retry also fails, inform user about connection issue
        if (retryContext.dbError) {
          const errorMessage = "🔧 **Problème de connexion**\n\n" +
            "Nous avons des difficultés à nous connecter à la base de données.\n\n" +
            "⏰ Veuillez réessayer dans quelques instants.\n\n" +
            "💡 Si le problème persiste, contactez le support.";
          await this.sendErrorMessage(message.from, errorMessage);
          return {
            success: false,
            message: errorMessage,
            requiresAuth: false
          };
        }
        
        // Retry succeeded, use the retry context
        Object.assign(userContext, retryContext);
      }

      // Check if this is a greeting message (bonjour, bonsoir, allo)
      const isGreeting = this.isGreetingMessage(message.body);
      
      if (isGreeting) {
        // If user is authenticated, ask what they want to do
        if (userContext.isAuthenticated) {
          return await this.handleGreetingForAuthenticatedUser(message.from, userContext);
        } else {
          // If user is not authenticated, start onboarding
          this.logger.log(`Greeting from unauthenticated user ${message.from}, starting onboarding`);
          const registrationResult = await this.registrationHandlerService.handleRegistrationMessage(
            message.from,
            message.body
          );
          
          if (registrationResult.nextStep !== 'not_registration') {
            return await this.handleRegistrationFlow(message);
          }
          
          // Fallback to authentication required
          return await this.handleAuthenticationRequired(message.from, null);
        }
      }

      // If user is not authenticated, check if this is a registration intent
      if (!userContext.isAuthenticated) {
        const registrationResult = await this.registrationHandlerService.handleRegistrationMessage(
          message.from,
          message.body
        );

        // If it's a registration message, handle it
        if (registrationResult.nextStep !== 'not_registration') {
          return await this.handleRegistrationFlow(message);
        }

        // If not registration and not authenticated, require authentication
        return await this.handleAuthenticationRequired(message.from, null);
      }

      // Process message with NLP service for authenticated users
      const nlpResult = await this.nlpService.processMessage(message, userContext);

      // Handle permission errors
      if (!nlpResult.isValid && nlpResult.errors.some(e => e.includes('réservée au propriétaire'))) {
        const response = 'Cette action est réservée au propriétaire de l\'entreprise.';
        await this.sendErrorMessage(message.from, response);
        return { success: false, message: response };
      }

      // Handle validation errors
      if (!nlpResult.isValid) {
        const response = nlpResult.errors.join('. ') || 'Commande invalide.';
        await this.sendErrorMessage(message.from, response);
        return { success: false, message: response };
      }

      // Route to appropriate handler based on command type
      return await this.routeCommand(message.from, nlpResult, userContext);

    } catch (error) {
      this.logger.error(`Error processing message from ${message.from}:`, error);

      const errorResponse = 'Désolé, une erreur s\'est produite. Veuillez réessayer plus tard.';
      await this.sendErrorMessage(message.from, errorResponse);

      return { success: false, message: errorResponse };
    }
  }

  /**
   * Route command to appropriate service handler
   */
  private async routeCommand(
    phoneNumber: string,
    nlpResult: NLPResult,
    userContext: UserContext
  ): Promise<BotResponse> {
    const { command } = nlpResult;

    // Check role-based permissions before routing
    const permissionCheck = this.checkCommandPermissions(command.type, userContext);
    if (!permissionCheck.allowed) {
      await this.sendErrorMessage(phoneNumber, permissionCheck.message);
      return { success: false, message: permissionCheck.message };
    }

    switch (command.type) {
      case 'sale':
        return await this.handleSaleCommand(phoneNumber, command, userContext);

      case 'expense':
        return await this.handleExpenseCommand(phoneNumber, command, userContext);

      case 'stock':
        return await this.handleStockUpdateCommand(phoneNumber, command, userContext);

      case 'stock_query':
        return await this.handleStockQueryCommand(phoneNumber, command, userContext);

      case 'product_list':
        return await this.handleProductListCommand(phoneNumber, command, userContext);

      case 'balance':
        return await this.handleBalanceCommand(phoneNumber, command, userContext);

      case 'report':
        return await this.handleReportCommand(phoneNumber, command, userContext);

      case 'transaction_list':
        return await this.handleTransactionListCommand(phoneNumber, command, userContext);

      case 'add_owner':
        return await this.handleAddOwnerCommand(phoneNumber, command, userContext);

      case 'help':
        return await this.handleHelpCommand(phoneNumber, command, userContext);

      case 'price_set':
        return await this.handlePriceSetCommand(phoneNumber, command, userContext);

      case 'product_add':
        return await this.handleProductAddCommand(phoneNumber, command, userContext);

      // Unit command handlers
      case 'unit_config':
        return await this.handleUnitConfigCommand(phoneNumber, command, userContext);

      case 'unit_view':
        return await this.handleUnitViewCommand(phoneNumber, command, userContext);

      case 'unit_stock':
        return await this.handleUnitStockCommand(phoneNumber, command, userContext);

      case 'unit_price_purchase':
        return await this.handleUnitPricePurchaseCommand(phoneNumber, command, userContext);

      case 'unit_price_selling':
        return await this.handleUnitPriceSellingCommand(phoneNumber, command, userContext);

      case 'unit_alert':
        return await this.handleUnitAlertCommand(phoneNumber, command, userContext);

      case 'unit_history':
        return await this.handleUnitHistoryCommand(phoneNumber, command, userContext);

      case 'unit_price_view':
        return await this.handleUnitPriceViewCommand(phoneNumber, command, userContext);

      case 'product_delete':
        return await this.handleProductDeleteCommand(phoneNumber, command, userContext);

      case 'confirm_delete':
        return await this.handleConfirmDeleteCommand(phoneNumber, command, userContext);

      case 'cart_create':
        return await this.handleCartCreateCommand(phoneNumber, command, userContext);

      case 'cart_add':
        return await this.handleCartAddCommand(phoneNumber, command, userContext);

      case 'cart_remove':
        return await this.handleCartRemoveCommand(phoneNumber, command, userContext);

      case 'cart_view':
        return await this.handleCartViewCommand(phoneNumber, command, userContext);

      case 'cart_finalize':
        return await this.handleCartFinalizeCommand(phoneNumber, command, userContext);

      case 'cart_cancel':
        return await this.handleCartCancelCommand(phoneNumber, command, userContext);

      case 'unknown':
      default:
        const helpMessage = this.generateRoleBasedHelpMessage(userContext);
        await this.sendErrorMessage(phoneNumber, helpMessage);
        return { success: false, message: helpMessage };
    }
  }

  /**
   * Handle sale command
   * Requirements: 1.1, 1.2, 1.3
   */
  private async handleSaleCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Handle quantity-based sales (e.g., "vente 10 pain" or "vente 10 pain 2000")
      // If quantity and product are specified, use handleQuantitySale
      // This handles both cases: with and without explicit amount
      if (command.quantity && command.product) {
        return await this.handleQuantitySale(phoneNumber, command, userContext);
      }

      // Handle amount-based sales (traditional format)
      if (!command.amount || command.amount <= 0) {
        const response = 'Le montant de la vente doit être spécifié et positif.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // Record the sale transaction
      const transaction = await this.transactionService.recordTransaction({
        businessId: userContext.businessId!,
        userId: userContext.userId!,
        type: TransactionType.SALE,
        amount: command.amount,
        product: command.product,
        description: command.description,
      });

      // Update stock if product is specified
      let stockMessage = '';
      if (command.product) {
        this.logger.log(`[BotController] Processing stock update for product: ${command.product}, business: ${userContext.businessId}`);

        try {
          // Get stock level before decrement for logging
          const stockBefore = await this.stockService.getStockLevel(
            userContext.businessId!,
            command.product
          );
          this.logger.log(`[BotController] Stock before decrement: ${stockBefore}`);

          const stockDecremented = await this.stockService.decrementStock(
            userContext.businessId!,
            command.product,
            1
          );

          // Get stock level after decrement for verification
          const stockAfter = await this.stockService.getStockLevel(
            userContext.businessId!,
            command.product
          );
          this.logger.log(`[BotController] Stock after decrement: ${stockAfter}, decrement successful: ${stockDecremented}`);

          if (!stockDecremented) {
            if (stockAfter === 0) {
              stockMessage = `\n⚠️ ${command.product} est maintenant en rupture de stock.`;
            } else {
              stockMessage = `\n⚠️ Stock insuffisant pour ${command.product}.`;
            }
          } else {
            // Stock was successfully decremented
            if (stockAfter <= 5 && stockAfter > 0) {
              stockMessage = `\n⚠️ ${command.product} - Stock faible: ${stockAfter} restant(s).`;
            } else if (stockAfter === 0) {
              stockMessage = `\n⚠️ ${command.product} est maintenant en rupture de stock.`;
            }
          }
        } catch (stockError) {
          this.logger.error(`Stock update failed for sale ${transaction.id}:`, stockError);
          stockMessage = `\n⚠️ Erreur lors de la mise à jour du stock pour ${command.product}.`;
          // Don't fail the sale if stock update fails
        }
      }

      // Send confirmation
      let response = `✅ Vente enregistrée: ${this.formatCurrency(command.amount)}`;
      if (command.product) {
        response += ` (${command.product})`;
      }
      response += stockMessage;

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { transactionId: transaction.id }
      };

    } catch (error) {
      this.logger.error('Error handling sale command:', error);
      const response = 'Erreur lors de l\'enregistrement de la vente. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle quantity-based sale (e.g., "vente 10 pain" or "vente 10 pain 500")
   */
  private async handleQuantitySale(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      this.logger.log(`[BotController] Processing quantity sale: ${command.quantity} ${command.product}, amount: ${command.amount || 'not specified'}`);

      // Check if we have enough stock
      this.logger.log(`[BotController] Checking stock for product: "${command.product}", quantity: ${command.quantity}`);
      const currentStock = await this.stockService.getStockLevel(
        userContext.businessId!,
        command.product
      );
      this.logger.log(`[BotController] Current stock for "${command.product}": ${currentStock}`);

      if (currentStock < command.quantity) {
        const response = `❌ Stock insuffisant pour ${command.product}.\n` +
          `Stock disponible: ${currentStock} unités\n` +
          `Quantité demandée: ${command.quantity} unités`;
        this.logger.warn(`[BotController] Insufficient stock: requested ${command.quantity}, available ${currentStock}`);
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // If amount is not specified, check if unit price is set
      if (!command.amount || command.amount <= 0) {
        // Try to get unit price for automatic calculation
        const unitPrice = await this.stockService.getUnitPrice(
          userContext.businessId!,
          command.product
        );

        if (unitPrice && unitPrice > 0) {
          // Calculate amount automatically
          command.amount = command.quantity * unitPrice;
          this.logger.log(`[BotController] Auto-calculated amount: ${command.quantity} × ${unitPrice} = ${command.amount}`);
          
          // Show a message about auto-calculation
          const calculationInfo = `💡 Prix unitaire: ${this.formatCurrency(unitPrice)}\n` +
            `📊 Calcul: ${command.quantity} × ${this.formatCurrency(unitPrice)} = ${this.formatCurrency(command.amount)}\n\n`;
          
          // Continue to process the sale (will be shown in confirmation)
        } else {
          // No unit price set, ask for amount
          const response = `📦 Vente de ${command.quantity} ${command.product}\n\n` +
            `💡 Veuillez préciser le montant total:\n` +
            `• Tapez: "vente ${command.quantity} ${command.product} [montant]"\n` +
            `• Exemple: "vente ${command.quantity} ${command.product} 2500"\n\n` +
            `💡 Ou définissez le prix unitaire: prix ${command.product} [montant]`;

          await this.sendErrorMessage(phoneNumber, response);
          return { success: false, message: response };
        }
      } else {
        // Amount is explicitly provided (e.g., "vente 10 pain 2000")
        // Use the provided amount directly without recalculating from unit price
        this.logger.log(`[BotController] Using provided amount: ${command.amount} for ${command.quantity} ${command.product}`);
      }

      // Process the sale with both quantity and amount
      const transaction = await this.transactionService.recordTransaction({
        businessId: userContext.businessId!,
        userId: userContext.userId!,
        type: TransactionType.SALE,
        amount: command.amount,
        product: command.product,
        description: `${command.quantity} ${command.product}`,
      });

      // Update stock - decrement by the specified quantity
      let stockMessage = '';
      try {
        const stockBefore = await this.stockService.getStockLevel(
          userContext.businessId!,
          command.product
        );
        this.logger.log(`[BotController] Stock before decrement: ${stockBefore}`);

        // Decrement stock by the quantity sold
        for (let i = 0; i < command.quantity; i++) {
          await this.stockService.decrementStock(
            userContext.businessId!,
            command.product,
            1
          );
        }

        const stockAfter = await this.stockService.getStockLevel(
          userContext.businessId!,
          command.product
        );
        this.logger.log(`[BotController] Stock after decrement: ${stockAfter}`);

        if (stockAfter <= 5 && stockAfter > 0) {
          stockMessage = `\n⚠️ ${command.product} - Stock faible: ${stockAfter} restant(s).`;
        } else if (stockAfter === 0) {
          stockMessage = `\n⚠️ ${command.product} est maintenant en rupture de stock.`;
        }

      } catch (stockError) {
        this.logger.error(`Stock update failed for quantity sale ${transaction.id}:`, stockError);
        stockMessage = `\n⚠️ Erreur lors de la mise à jour du stock pour ${command.product}.`;
      }

      // Calculate unit price for display
      const unitPrice = Math.round(command.amount / command.quantity);
      
      // Check if this was auto-calculated from unit price
      const storedUnitPrice = await this.stockService.getUnitPrice(
        userContext.businessId!,
        command.product
      );
      const wasAutoCalculated = storedUnitPrice && Math.abs(storedUnitPrice - unitPrice) < 1;
      const wasExplicitAmount = command.amount && command.amount > 0 && !wasAutoCalculated;

      // Send confirmation
      let response = `✅ Vente enregistrée:\n`;
      response += `📦 Quantité: ${command.quantity} ${command.product}\n`;
      response += `💰 Montant total: ${this.formatCurrency(command.amount)}`;
      if (wasAutoCalculated) {
        response += ` ✨\n`;
        response += `💵 Prix unitaire: ${this.formatCurrency(unitPrice)} (calculé automatiquement)`;
      } else if (wasExplicitAmount) {
        response += `\n`;
        response += `💵 Prix unitaire effectif: ${this.formatCurrency(unitPrice)} (prix spécial)`;
      } else {
        response += `\n`;
        response += `💵 Prix unitaire: ${this.formatCurrency(unitPrice)}`;
      }
      response += stockMessage;

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: {
          transactionId: transaction.id,
          quantity: command.quantity,
          unitPrice: unitPrice
        }
      };

    } catch (error) {
      this.logger.error('Error handling quantity sale:', error);
      const response = 'Erreur lors du traitement de la vente par quantité.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle product list command
   * Returns list of all products with stock and prices
   */
  private async handleProductListCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const products = await this.stockService.getAllProductsWithPrices(userContext.businessId!);

      if (products.length === 0) {
        const response = '📦 Aucun produit enregistré.\n\n💡 Commencez par ajouter des produits avec "stock [produit] [quantité]"';
        await this.sendSuccessMessage(phoneNumber, response);
        return {
          success: true,
          message: response,
          data: { products: [] }
        };
      }

      let response = '📋 **LISTE DES PRODUITS**\n\n';
      let totalValue = 0;
      let hasPrices = false;

      products.forEach((item, index) => {
        response += `${index + 1}. **${item.product}**\n`;
        
        // Show product code if available
        if (item.productCode) {
          response += `   🏷️ Code: ${item.productCode}\n`;
        }
        
        response += `   📦 Stock: ${item.quantity} unité${item.quantity > 1 ? 's' : ''}`;
        
        if (item.unitPrice) {
          hasPrices = true;
          response += `\n   💰 Prix: ${this.formatCurrency(item.unitPrice)}/unité`;
          const itemValue = item.quantity * item.unitPrice;
          totalValue += itemValue;
          response += `\n   💵 Valeur: ${this.formatCurrency(itemValue)}`;
        } else {
          response += `\n   💡 Prix non défini`;
        }

        // Add stock status warnings
        if (item.stockStatus === 'out') {
          response += '\n   ⚠️ **Rupture de stock**';
        } else if (item.stockStatus === 'low') {
          response += '\n   ⚠️ **Stock faible**';
        }

        response += '\n\n';
      });

      // Add summary
      response += `━━━━━━━━━━━━━━━━━\n`;
      response += `📊 **Total:** ${products.length} produit${products.length > 1 ? 's' : ''}\n`;
      
      if (hasPrices && totalValue > 0) {
        response += `💰 **Valeur totale du stock:** ${this.formatCurrency(totalValue)}\n`;
      }

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { 
          products,
          totalCount: products.length,
          totalValue: hasPrices ? totalValue : null
        }
      };

    } catch (error) {
      this.logger.error('Error handling product list command:', error);
      const response = 'Erreur lors de la récupération de la liste des produits.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle expense command
   * Requirements: 2.1, 2.2, 2.3
   */
  private async handleExpenseCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      if (!command.amount || command.amount <= 0) {
        const response = 'Le montant de la dépense doit être spécifié et positif.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // Record the expense transaction
      const transaction = await this.transactionService.recordTransaction({
        businessId: userContext.businessId!,
        userId: userContext.userId!,
        type: TransactionType.EXPENSE,
        amount: command.amount,
        product: command.product,
        description: command.description,
      });

      // Send confirmation
      let response = `✅ Dépense enregistrée: ${this.formatCurrency(command.amount)}`;
      if (command.description || command.product) {
        response += ` (${command.description || command.product})`;
      }

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { transactionId: transaction.id }
      };

    } catch (error) {
      this.logger.error('Error handling expense command:', error);
      const response = 'Erreur lors de l\'enregistrement de la dépense. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle stock update command
   * Requirements: 3.1
   */
  private async handleStockUpdateCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      if (!command.product) {
        const response = 'Le nom du produit est requis pour mettre à jour le stock.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      if (command.stockQuantity === undefined || command.stockQuantity < 0) {
        const response = 'La quantité doit être un nombre positif ou zéro.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // Update stock
      const stockItem = await this.stockService.updateStock(
        userContext.businessId!,
        command.product,
        command.stockQuantity
      );

      const response = `✅ Stock mis à jour: ${stockItem.product} = ${stockItem.quantity} unités`;
      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { stockItem }
      };

    } catch (error) {
      this.logger.error('Error handling stock update command:', error);
      const response = 'Erreur lors de la mise à jour du stock. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle stock query command
   * Requirements: 3.2, 3.3
   */
  private async handleStockQueryCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Check if user provided an amount (e.g., "produit b9000 20000")
      // This suggests they might want to set a price instead
      if (command.suggestedPrice) {
        const suggestion = `💡 Vous avez fourni un montant (${this.formatCurrency(command.suggestedPrice)}).\n` +
          `Pour définir un prix, utilisez:\n` +
          `prix ${command.product} ${command.suggestedPrice}\n\n` +
          `Sinon, voici le stock actuel:\n`;
        
        // Continue to show stock, but with the suggestion first
        const stockItems = await this.stockService.getStock(
          userContext.businessId!,
          command.product
        );

        if (stockItems.length > 0) {
          const item = stockItems[0];
          let response = suggestion + `📦 Stock ${item.product}: ${item.quantity} unités`;

          if (item.quantity === 0) {
            response += ' ⚠️ (Rupture de stock)';
          } else if (item.quantity <= 5) {
            response += ' ⚠️ (Stock faible)';
          }

          if (item.unitPrice) {
            response += `\n💰 Prix actuel: ${this.formatCurrency(item.unitPrice)}/unité`;
          }

          await this.sendSuccessMessage(phoneNumber, response);
          return {
            success: true,
            message: response,
            data: { stockItems }
          };
        }
      }

      const stockItems = await this.stockService.getStock(
        userContext.businessId!,
        command.product
      );

      let response: string;

      if (command.product) {
        // Single product query
        const item = stockItems[0];
        response = `📦 **${item.product}**\n`;
        
        // Show product code
        if (item.productCode) {
          response += `🏷️ **Code:** ${item.productCode}\n`;
        }
        
        response += `📊 **Stock:** ${item.quantity} unité${item.quantity > 1 ? 's' : ''}`;

        if (item.quantity === 0) {
          response += ' ⚠️ (Rupture de stock)';
        } else if (item.quantity <= 5) {
          response += ' ⚠️ (Stock faible)';
        }

        // Add price information if available
        if (item.unitPrice) {
          response += `\n💰 **Prix:** ${this.formatCurrency(item.unitPrice)}/unité`;
          if (item.quantity > 0) {
            const totalValue = item.quantity * item.unitPrice;
            response += `\n💵 **Valeur:** ${this.formatCurrency(totalValue)}`;
          }
        } else {
          const codeOrName = item.productCode || item.product;
          response += `\n\n💡 Prix non défini. Définissez avec:\nprix ${codeOrName} [montant]`;
        }
      } else {
        // All products query
        if (stockItems.length === 0) {
          response = '📦 Aucun produit en stock.';
        } else {
          response = '📦 ÉTAT DU STOCK:\n\n';
          let totalValue = 0;
          
          stockItems.forEach(item => {
            response += `• ${item.product}: ${item.quantity} unités`;
            
            if (item.unitPrice) {
              response += ` - prix unitaire: ${this.formatCurrency(item.unitPrice)}`;
              const itemValue = item.quantity * item.unitPrice;
              totalValue += itemValue;
            }
            
            if (item.quantity === 0) {
              response += ' ⚠️';
            } else if (item.quantity <= 5) {
              response += ' ⚠️';
            }
            response += '\n';
          });

          // Show total inventory value if any prices are set
          if (totalValue > 0) {
            response += `\n💰 Valeur totale du stock: ${this.formatCurrency(totalValue)}`;
          }
        }
      }

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { stockItems }
      };

    } catch (error) {
      this.logger.error('Error handling stock query command:', error);

      let response: string;
      if (error.message.includes('not found')) {
        response = `❌ Produit "${command.product}" non trouvé dans le stock.\n\n` +
          `💡 **Pour créer ce produit, utilisez :**\n` +
          `• "ajout produit ${command.product}"\n` +
          `• "ajout produit ${command.product} [prix]"\n\n` +
          `**Exemples :**\n` +
          `• "ajout produit ${command.product}" (le prix sera demandé)\n` +
          `• "ajout produit ${command.product} 500" (avec prix)\n\n` +
          `📝 Ensuite, ajoutez du stock avec : "stock ${command.product} [quantité]"`;
      } else {
        response = 'Erreur lors de la consultation du stock.';
      }

      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle price set command
   * Sets unit price for a product (simple pricing without units)
   */
  /**
   * Handle product add command
   */
  private async handleProductAddCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      if (!command.product || !command.product.trim()) {
        const response = '❌ Veuillez spécifier le nom du produit.\n\n' +
          '📝 Format: ajout produit \'nom_produit\'\n' +
          '💡 Exemple: ajout produit \'pain\'';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      const productName = command.product.trim();

      // If price is provided, create product with price directly
      if (command.unitPrice && command.unitPrice > 0) {
        const stockItem = await this.stockService.setUnitPrice(
          userContext.businessId!,
          productName,
          command.unitPrice
        );

        let response = `✅ **Produit créé avec succès !**\n\n`;
        response += `📦 **Nom:** ${stockItem.product}\n`;
        response += `🏷️ **Code:** ${stockItem.productCode}\n`;
        response += `💰 **Prix:** ${this.formatCurrency(command.unitPrice)}\n\n`;
        response += `💡 **Commandes rapides:**\n`;
        response += `• Stock: "stock ${stockItem.productCode} [quantité]"\n`;
        response += `• Vente: "vente [qté] ${stockItem.productCode}"\n`;
        response += `• Requête: "produit ${stockItem.productCode}"`;

        await this.sendSuccessMessage(phoneNumber, response);

        return {
          success: true,
          message: response,
          data: { stockItem, productCode: stockItem.productCode }
        };
      }

      // If no price provided, create product without price (will generate code)
      const stockItem = await this.stockService.setUnitPrice(
        userContext.businessId!,
        productName,
        0 // Will be updated later
      );

      const response = `📦 **Produit créé !**\n\n` +
        `📦 **Nom:** ${productName}\n` +
        `🏷️ **Code:** ${stockItem.productCode}\n\n` +
        `💰 Veuillez définir le prix unitaire :\n\n` +
        `📝 **Avec le code:** prix ${stockItem.productCode} [montant]\n` +
        `💡 **Exemple:** prix ${stockItem.productCode} 500`;

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { stockItem, productCode: stockItem.productCode, waitingForPrice: true }
      };

    } catch (error) {
      this.logger.error(`Error handling product add command for ${phoneNumber}:`, error);
      const errorResponse = '❌ Erreur lors de l\'ajout du produit.\n\n' +
        '💡 Vérifiez le format et réessayez.';
      await this.sendErrorMessage(phoneNumber, errorResponse);
      return { success: false, message: errorResponse };
    }
  }

  private async handlePriceSetCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      if (!command.product || !command.product.trim()) {
        const response = '❌ Veuillez spécifier le nom du produit.\n\n' +
          '📝 Format: prix [produit] [montant]\n' +
          '💡 Exemple: prix pain 300';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      if (!command.unitPrice || command.unitPrice <= 0) {
        const response = '❌ Veuillez spécifier un prix valide.\n\n' +
          '📝 Format: prix [produit] [montant]\n' +
          '💡 Exemple: prix pain 300';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // Set the unit price
      const stockItem = await this.stockService.setUnitPrice(
        userContext.businessId!,
        command.product,
        command.unitPrice
      );

      let response = `✅ **Prix défini avec succès !**\n\n`;
      response += `📦 **Produit:** ${stockItem.product}\n`;
      response += `🏷️ **Code:** ${stockItem.productCode}\n`;
      response += `💰 **Prix:** ${this.formatCurrency(command.unitPrice)}/unité\n\n`;
      
      // Check if product has stock
      if (stockItem.quantity > 0) {
        const totalValue = stockItem.quantity * command.unitPrice;
        response += `📊 **Stock actuel:** ${stockItem.quantity} unités\n`;
        response += `💵 **Valeur du stock:** ${this.formatCurrency(totalValue)}\n\n`;
        response += `💡 **Commande rapide:** vente [qté] ${stockItem.productCode}`;
      } else {
        response += `💡 **Ajoutez du stock avec:**\nstock ${stockItem.productCode} [quantité]`;
      }

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { stockItem }
      };

    } catch (error) {
      this.logger.error('Error handling price set command:', error);
      const response = '❌ Erreur lors de la définition du prix. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle balance command
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  private async handleBalanceCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const period = this.mapPeriod(command.period || 'day');

      const report = await this.reportService.generateBalanceReport({
        businessId: userContext.businessId!,
        period,
        includeTopProducts: true,
        topProductsLimit: 3
      });

      let response = `📊 BILAN ${report.period.toUpperCase()}\n\n`;
      response += `💰 Ventes: ${this.formatCurrency(report.totalSales)}\n`;
      response += `💸 Dépenses: ${this.formatCurrency(report.totalExpenses)}\n`;
      response += `📈 Bénéfice: ${this.formatCurrency(report.netProfit)}\n\n`;
      response += `📋 Transactions: ${report.transactionCount} (${report.salesCount} ventes, ${report.expenseCount} dépenses)`;

      if (report.topProducts && report.topProducts.length > 0) {
        response += '\n\n🏆 TOP PRODUITS:\n';
        report.topProducts.forEach((product, index) => {
          response += `${index + 1}. ${product.product}: ${this.formatCurrency(product.revenue)}\n`;
        });
      }

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { report }
      };

    } catch (error) {
      this.logger.error('Error handling balance command:', error);
      const response = 'Erreur lors de la génération du bilan. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle report command (PDF generation)
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  private async handleReportCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const period = this.mapPeriod(command.period || 'day');

      // Send initial message
      await this.sendSuccessMessage(
        phoneNumber,
        '📄 Génération du rapport PDF en cours...'
      );

      // Generate and send PDF report
      const result = await this.reportService.generateAndSendPDFReport(
        userContext.businessId!,
        phoneNumber,
        period
      );

      return {
        success: result.success,
        message: result.message,
        data: { period }
      };

    } catch (error) {
      this.logger.error('Error handling report command:', error);
      const response = 'Erreur lors de la génération du rapport PDF. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle transaction list command
   * Shows detailed list of transactions with products and quantities
   */
  private async handleTransactionListCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const period = this.mapPeriod(command.period || 'day');
      const transactionType = command.transactionType;
      
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        default: // day
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
      }

      // Get transactions
      const transactions = await this.transactionService.getTransactions(
        userContext.businessId!,
        command.limit || 20,
        undefined,
        transactionType === 'all' ? undefined : (transactionType === 'sale' ? TransactionType.SALE : TransactionType.EXPENSE)
      );

      // Filter by date
      const filteredTransactions = transactions.filter(t => t.createdAt >= startDate);

      if (filteredTransactions.length === 0) {
        let response = `📋 TRANSACTIONS - ${period.toUpperCase()}\n\n`;
        response += '✨ Aucune transaction trouvée pour cette période.';
        
        await this.sendSuccessMessage(phoneNumber, response);
        return { success: true, message: response };
      }

      // Format response
      let response = `📋 TRANSACTIONS - ${period.toUpperCase()}\n`;
      if (transactionType === 'sale') {
        response += '🛒 Ventes uniquement\n\n';
      } else if (transactionType === 'expense') {
        response += '💸 Dépenses uniquement\n\n';
      } else {
        response += '📊 Toutes les transactions\n\n';
      }

      let totalAmount = 0;
      filteredTransactions.forEach((transaction, index) => {
        const time = transaction.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const emoji = transaction.type === TransactionType.SALE ? '✅' : '💸';
        const typeText = transaction.type === TransactionType.SALE ? 'Vente' : 'Dépense';
        
        response += `${emoji} ${typeText} - ${time}\n`;
        
        if (transaction.product) {
          // Try to extract quantity from description
          const qtyMatch = transaction.description?.match(/^(\d+)/);
          if (qtyMatch) {
            response += `   📦 ${qtyMatch[1]} × ${transaction.product}\n`;
          } else {
            response += `   📦 ${transaction.product}\n`;
          }
        }
        
        response += `   💰 ${this.formatCurrency(transaction.amount)}\n`;
        
        if (index < filteredTransactions.length - 1) {
          response += '\n';
        }
        
        totalAmount += Number(transaction.amount);
      });

      response += `\n━━━━━━━━━━━━━━━━━\n`;
      response += `📊 Total: ${filteredTransactions.length} transaction(s)\n`;
      response += `💰 Montant total: ${this.formatCurrency(totalAmount)}`;

      await this.sendSuccessMessage(phoneNumber, response);

      return {
        success: true,
        message: response,
        data: { transactions: filteredTransactions, period, transactionType }
      };

    } catch (error) {
      this.logger.error('Error handling transaction list command:', error);
      const response = 'Erreur lors de la récupération des transactions. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle registration flow messages
   */
  private async handleRegistrationFlow(message: ProcessedMessage): Promise<BotResponse> {
    try {
      const registrationResult = await this.registrationHandlerService.handleRegistrationMessage(
        message.from,
        message.body
      );

      // Send the registration response message
      if (registrationResult.message) {
        await this.twilioWhatsAppService.sendMessage(message.from, registrationResult.message);
      }

      // Handle registration completion
      if (registrationResult.completed && registrationResult.data?.accessToken) {
        // Registration completed successfully, user is now authenticated
        this.logger.log(`Registration completed for ${message.from}`);

        return {
          success: true,
          message: registrationResult.message,
          data: {
            registered: true,
            userType: registrationResult.data.user?.role,
            businessCode: registrationResult.data.businessCode
          }
        };
      }

      return {
        success: true,
        message: registrationResult.message,
        data: { inRegistration: true, nextStep: registrationResult.nextStep }
      };

    } catch (error) {
      this.logger.error(`Error handling registration flow for ${message.from}:`, error);

      const errorResponse = 'Erreur lors de l\'inscription. Tapez "bonjour" pour recommencer.';
      await this.sendErrorMessage(message.from, errorResponse);

      return { success: false, message: errorResponse };
    }
  }

  /**
   * Handle add owner command
   * Only owners can add other owners
   */
  private async handleAddOwnerCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Check if user is authenticated and is an owner
      if (!userContext.isAuthenticated) {
        const response = '❌ Vous devez être connecté pour ajouter un administrateur.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      if (userContext.role !== 'owner') {
        const response = '❌ Seuls les propriétaires peuvent ajouter d\'autres administrateurs.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // If phone number and name are provided, add directly
      if (command.newOwnerPhoneNumber && command.newOwnerName) {
        try {
          const result = await this.authService.addOwnerToBusiness(
            phoneNumber,
            command.newOwnerPhoneNumber,
            command.newOwnerName,
            userContext.language || 'fr'
          );

          const successMessage = `✅ **Administrateur ajouté avec succès !**\n\n` +
            `👤 **Nom :** ${command.newOwnerName}\n` +
            `📱 **Numéro :** ${command.newOwnerPhoneNumber}\n` +
            `🏢 **Entreprise :** ${result.user.business.name}\n\n` +
            `${command.newOwnerName} est maintenant administrateur de votre entreprise avec les mêmes permissions que vous.`;

          await this.sendSuccessMessage(phoneNumber, successMessage);

          // Send welcome message to the new administrator
          const welcomeMessage = `🎉 **Bienvenue dans MonPetitBiz !**\n\n` +
            `Vous avez été ajouté comme administrateur de l'entreprise **${result.user.business.name}**.\n\n` +
            `✅ **Vous pouvez maintenant :**\n` +
            `• Gérer les produits et le stock\n` +
            `• Enregistrer des ventes et dépenses\n` +
            `• Consulter les rapports et bilans\n` +
            `• Ajouter d'autres administrateurs\n` +
            `• Accéder à toutes les fonctionnalités\n\n` +
            `💡 **Pour commencer, envoyez simplement "aide" pour voir toutes les commandes disponibles.**\n\n` +
            `Bienvenue dans l'équipe ! 🚀`;

          try {
            await this.twilioWhatsAppService.sendMessage(
              command.newOwnerPhoneNumber,
              welcomeMessage
            );
            this.logger.log(`Welcome message sent to new administrator: ${command.newOwnerPhoneNumber}`);
          } catch (error) {
            this.logger.error(`Failed to send welcome message to ${command.newOwnerPhoneNumber}:`, error);
            // Don't fail the whole operation if welcome message fails
          }

          return {
            success: true,
            message: successMessage,
            data: {
              newOwner: {
                id: result.user.id,
                phoneNumber: result.user.phoneNumber,
                name: result.user.employeeName,
              }
            }
          };
        } catch (error) {
          this.logger.error(`Error adding owner for ${phoneNumber}:`, error);
          
          let errorMessage = '❌ Erreur lors de l\'ajout de l\'administrateur.';
          if (error.status === 403) {
            errorMessage = '❌ Seuls les propriétaires peuvent ajouter d\'autres administrateurs.';
          } else if (error.status === 409) {
            errorMessage = `❌ ${error.message || 'Ce numéro est déjà utilisé dans une autre entreprise.'}`;
          } else if (error.message) {
            errorMessage = `❌ ${error.message}`;
          }

          await this.sendErrorMessage(phoneNumber, errorMessage);
          return { success: false, message: errorMessage };
        }
      }

      // If parameters not provided, ask for them
      const promptMessage = `📝 **Ajouter un administrateur**\n\n` +
        `Pour ajouter un autre administrateur à votre entreprise, j'ai besoin de :\n\n` +
        `1️⃣ Le numéro de téléphone WhatsApp\n` +
        `2️⃣ Le nom complet\n\n` +
        `💡 **Format :**\n` +
        `\`ajouter administrateur [numéro] [nom]\`\n\n` +
        `**Exemple :**\n` +
        `\`ajouter administrateur +226709876543 Fatou Diallo\``;

      await this.sendSuccessMessage(phoneNumber, promptMessage);

      return {
        success: true,
        message: promptMessage,
        data: { awaitingInput: true }
      };

    } catch (error) {
      this.logger.error('Error handling add owner command:', error);
      const response = '❌ Erreur lors du traitement de la commande. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle help command
   */
  private async handleHelpCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const helpContext: HelpContext = {
        userRole: userContext.role,
        businessName: userContext.businessName,
        language: userContext.language,
        isAuthenticated: userContext.isAuthenticated
      };

      const helpCategory = command.helpCategory || 'general';
      const helpMessage = this.helpService.getHelpMessage(helpCategory, helpContext);

      await this.sendSuccessMessage(phoneNumber, helpMessage);

      return {
        success: true,
        message: helpMessage,
        data: { helpCategory }
      };

    } catch (error) {
      this.logger.error('Error handling help command:', error);
      const response = 'Erreur lors de l\'affichage de l\'aide. Veuillez réessayer.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle unit configuration command
   * Requirements: 1.1, 1.2, 1.3
   */
  private async handleUnitConfigCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Create matches array for the handler
      const matches = [
        command.originalText,
        command.product,
        command.purchaseUnit,
        command.conversionFactor?.toString(),
        command.baseUnit
      ];

      const result = await this.unitCommandHandler.handleConfigureUnits(
        userContext.businessId!,
        userContext.userId!,
        matches as RegExpMatchArray
      );

      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Error handling unit config command:', error);
      const response = 'Erreur lors de la configuration des unités.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle unit view command
   * Requirements: 1.4
   */
  private async handleUnitViewCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.unitCommandHandler.handleViewUnits(
        userContext.businessId!,
        command.product
      );

      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Error handling unit view command:', error);
      const response = 'Erreur lors de la consultation des unités.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle unit stock command
   * Requirements: 2.1, 2.2
   */
  private async handleUnitStockCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Create matches array for the handler
      const matches = [
        command.originalText,
        command.product,
        command.stockQuantity?.toString(),
        command.unit
      ];

      const result = await this.unitCommandHandler.handleStockWithUnit(
        userContext.businessId!,
        userContext.userId!,
        matches as RegExpMatchArray
      );

      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Error handling unit stock command:', error);
      const response = 'Erreur lors de la mise à jour du stock avec unités.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle unit purchase price command
   * Requirements: 5.1, 5.2
   */
  private async handleUnitPricePurchaseCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Create matches array for the handler
      const matches = [
        command.originalText,
        command.product,
        command.unitPrice?.toString(),
        command.unit
      ];

      const result = await this.unitCommandHandler.handlePurchasePrice(
        userContext.businessId!,
        matches as RegExpMatchArray
      );

      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Error handling unit purchase price command:', error);
      const response = 'Erreur lors de la définition du prix d\'achat.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle unit selling price command
   * Requirements: 5.3, 5.4
   */
  private async handleUnitPriceSellingCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Create matches array for the handler
      const matches = [
        command.originalText,
        command.product,
        command.margin?.toString()
      ];

      const result = await this.unitCommandHandler.handleSellingMargin(
        userContext.businessId!,
        matches as RegExpMatchArray
      );

      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Error handling unit selling price command:', error);
      const response = 'Erreur lors du calcul du prix de vente.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle unit alert command
   * Requirements: 6.1, 6.2
   */
  private async handleUnitAlertCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Create matches array for the handler
      const matches = [
        command.originalText,
        command.product,
        command.threshold?.toString(),
        command.unit
      ];

      const result = await this.unitCommandHandler.handleAlertConfig(
        userContext.businessId!,
        matches as RegExpMatchArray
      );

      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Error handling unit alert command:', error);
      const response = 'Erreur lors de la configuration de l\'alerte.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle unit history command
   * Requirements: 7.1, 7.2
   */
  private async handleUnitHistoryCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.unitCommandHandler.handleMovementHistory(
        userContext.businessId!,
        command.product
      );

      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Error handling unit history command:', error);
      const response = 'Erreur lors de la consultation de l\'historique.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle unit price view command
   * Requirements: 5.5
   */
  private async handleUnitPriceViewCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.unitCommandHandler.handleViewPrices(
        userContext.businessId!,
        command.product
      );

      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Error handling unit price view command:', error);
      const response = 'Erreur lors de la consultation des prix.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle product delete command
   * Requirements: Allow users to delete products from stock
   */
  private async handleProductDeleteCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      if (!command.product) {
        const response = '❌ Format incorrect.\n\n' +
          '💡 Utilisez: "supprimer produit [nom_produit]"\n\n' +
          '**Exemples:**\n' +
          '• "supprimer produit pain"\n' +
          '• "delete produit lait"\n' +
          '• "effacer produit biscuit"';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // Check if product exists in stock
      try {
        const stockLevel = await this.stockService.getStockLevel(userContext.businessId!, command.product);
        
        // Set pending confirmation
        this.confirmationStateService.setPendingConfirmation(phoneNumber, {
          type: 'product_delete',
          data: {
            product: command.product,
            businessId: userContext.businessId!,
            userId: userContext.userId!
          },
          timestamp: new Date()
        });

        // Send confirmation message
        const stockInfo = stockLevel > 0 ? `\n📦 Stock actuel: ${stockLevel} unité(s)` : '\n📦 Produit en rupture de stock';
        
        const confirmationMessage = `⚠️ **Confirmation de suppression**\n\n` +
          `Êtes-vous sûr de vouloir supprimer le produit "${command.product}" ?${stockInfo}\n\n` +
          `Cette action supprimera :\n` +
          `• Le produit du stock\n` +
          `• Sa configuration d'unités (si elle existe)\n` +
          `• L'historique des mouvements sera conservé\n\n` +
          `💡 Pour confirmer, tapez : "confirmer"\n` +
          `💡 Pour annuler, ignorez ce message (expire dans 5 minutes)`;

        await this.sendErrorMessage(phoneNumber, confirmationMessage);

        return {
          success: false,
          message: confirmationMessage,
          data: { requiresConfirmation: true, product: command.product }
        };

      } catch (error) {
        if (error.message.includes('not found')) {
          const response = `❌ Produit "${command.product}" non trouvé dans le stock.`;
          await this.sendErrorMessage(phoneNumber, response);
          return { success: false, message: response };
        }
        throw error;
      }

    } catch (error) {
      this.logger.error('Error handling product delete command:', error);
      const response = 'Erreur lors de la préparation de suppression du produit.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle confirm delete command
   */
  private async handleConfirmDeleteCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Check if there's a pending confirmation
      const pendingConfirmation = this.confirmationStateService.getPendingConfirmation(phoneNumber);
      
      if (!pendingConfirmation) {
        const response = '❌ Aucune action en attente de confirmation.\n\n💡 Tapez "supprimer [produit]" pour supprimer un produit.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // Check if confirmation is expired
      if (this.confirmationStateService.isConfirmationExpired(phoneNumber)) {
        this.confirmationStateService.clearPendingConfirmation(phoneNumber);
        const response = '⏰ La demande de confirmation a expiré.\n\n💡 Tapez "supprimer [produit]" pour recommencer.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // Verify user context matches the pending confirmation
      if (pendingConfirmation.data.businessId !== userContext.businessId || 
          pendingConfirmation.data.userId !== userContext.userId) {
        this.confirmationStateService.clearPendingConfirmation(phoneNumber);
        const response = '❌ Erreur de validation. Veuillez recommencer la suppression.';
        await this.sendErrorMessage(phoneNumber, response);
        return { success: false, message: response };
      }

      // Execute the deletion
      if (pendingConfirmation.type === 'product_delete') {
        const result = await this.stockService.deleteProduct(
          pendingConfirmation.data.businessId,
          pendingConfirmation.data.product,
          pendingConfirmation.data.userId
        );

        // Clear the pending confirmation
        this.confirmationStateService.clearPendingConfirmation(phoneNumber);

        if (result.success) {
          await this.sendSuccessMessage(phoneNumber, result.message);
        } else {
          await this.sendErrorMessage(phoneNumber, result.message);
        }

        return {
          success: result.success,
          message: result.message,
          data: { productDeleted: pendingConfirmation.data.product }
        };
      }

      // Unknown confirmation type
      this.confirmationStateService.clearPendingConfirmation(phoneNumber);
      const response = '❌ Type de confirmation non reconnu.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };

    } catch (error) {
      this.logger.error('Error handling confirm delete command:', error);
      this.confirmationStateService.clearPendingConfirmation(phoneNumber);
      const response = 'Erreur lors de la confirmation de suppression.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle authentication required scenario
   */
  private async handleAuthenticationRequired(
    phoneNumber: string,
    nlpResult: NLPResult | null
  ): Promise<BotResponse> {
    const response = `👋 Bienvenue !\n\nPour utiliser ce service, vous devez d'abord vous inscrire.\n\nTapez "bonjour" pour commencer votre inscription.`;

    try {
      await this.twilioWhatsAppService.sendMessage(phoneNumber, response);
    } catch (error) {
      this.logger.error(`Failed to send auth required message to ${phoneNumber}:`, error);
    }

    return {
      success: false,
      message: response,
      requiresAuth: true
    };
  }

  /**
   * Send error message with fallback handling
   */
  private async sendErrorMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      await this.twilioWhatsAppService.sendMessage(phoneNumber, message);
    } catch (error) {
      this.logger.error(`Failed to send error message to ${phoneNumber}:`, error);
      // Could implement alternative notification methods here (email, SMS, etc.)
    }
  }

  /**
   * Send success message with fallback handling
   */
  private async sendSuccessMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      await this.twilioWhatsAppService.sendMessage(phoneNumber, message);
    } catch (error) {
      this.logger.error(`Failed to send success message to ${phoneNumber}:`, error);
      // Log the successful operation even if message sending fails
      this.logger.warn(`Operation succeeded but notification failed for ${phoneNumber}: ${message}`);
    }
  }

  /**
   * Check if user has permission to execute a command based on their role
   */
  private checkCommandPermissions(
    commandType: string,
    userContext: UserContext
  ): { allowed: boolean; message: string } {
    if (!userContext.isAuthenticated || !userContext.role) {
      return {
        allowed: false,
        message: 'Authentification requise pour utiliser cette commande.'
      };
    }

    const { role } = userContext;

    switch (commandType) {
      case 'sale':
      case 'stock':
      case 'stock_query':
      case 'product_list':
      case 'unit_stock':
      case 'unit_view':
      case 'unit_history':
      case 'unit_price_view':
        // All authenticated users can perform these actions
        return { allowed: true, message: '' };

      case 'product_add':
      case 'price_set':
        // Product add and price set - only owners and managers
        if (role === 'owner' || role === 'manager') {
          return { allowed: true, message: '' };
        }
        return {
          allowed: false,
          message: '❌ Seuls les propriétaires et managers peuvent ajouter des produits ou définir des prix.'
        };

      case 'unit_config':
      case 'unit_price_purchase':
      case 'unit_price_selling':
      case 'unit_alert':
      case 'product_delete':
        // Unit configuration and product deletion commands - only owners and managers
        if (role === 'owner' || role === 'manager') {
          return { allowed: true, message: '' };
        }

        const actionName = commandType === 'product_delete' ? 
          'La suppression de produits' : 'La configuration des unités';

        return {
          allowed: false,
          message: `❌ **Action non autorisée**\n\n` +
            `${actionName} est réservée aux propriétaires et managers.\n\n` +
            `🔑 **Vos permissions (${this.getRoleDisplayName(role)}) :**\n` +
            `${this.getRolePermissions(role)}\n\n` +
            `💡 Contactez votre manager pour effectuer cette action.`
        };

      case 'expense':
      case 'balance':
      case 'report':
        // Only owners and managers can perform these actions
        if (role === 'owner' || role === 'manager') {
          return { allowed: true, message: '' };
        }

        return {
          allowed: false,
          message: `❌ **Action non autorisée**\n\n` +
            `Cette fonction est réservée aux propriétaires et managers.\n\n` +
            `🔑 **Vos permissions (${this.getRoleDisplayName(role)}) :**\n` +
            `${this.getRolePermissions(role)}\n\n` +
            `💡 Contactez votre manager pour plus d'informations.`
        };

      default:
        return { allowed: true, message: '' };
    }
  }

  /**
   * Get display name for user role
   */
  private getRoleDisplayName(role: string): string {
    switch (role) {
      case 'owner':
        return 'Propriétaire';
      case 'manager':
        return 'Manager';
      case 'seller':
        return 'Vendeur';
      default:
        return 'Utilisateur';
    }
  }

  /**
   * Get permissions description for a role
   */
  private getRolePermissions(role: string): string {
    switch (role) {
      case 'owner':
        return '✅ Toutes les fonctions disponibles\n' +
          '• Enregistrer ventes et dépenses\n' +
          '• Gérer le stock\n' +
          '• Voir les bilans et rapports\n' +
          '• Ajouter des employés';

      case 'manager':
        return '✅ Fonctions de gestion avancées\n' +
          '• Enregistrer ventes et dépenses\n' +
          '• Gérer le stock\n' +
          '• Voir les bilans et rapports';

      case 'seller':
        return '✅ Fonctions de vente\n' +
          '• Enregistrer des ventes\n' +
          '• Consulter et gérer le stock\n' +
          '❌ Pas d\'accès aux dépenses et rapports';

      default:
        return 'Aucune permission définie';
    }
  }

  /**
   * Generate role-based help message
   */
  private generateRoleBasedHelpMessage(userContext: UserContext): string {
    if (!userContext.isAuthenticated || !userContext.role) {
      return '❓ Commande non reconnue. Tapez "aide" pour voir les commandes disponibles.';
    }

    // Use the new HelpService for better help messages
    const helpContext: HelpContext = {
      userRole: userContext.role,
      businessName: userContext.businessName,
      language: userContext.language,
      isAuthenticated: userContext.isAuthenticated
    };

    const quickHelp = `❓ **Commande non reconnue**\n\n` +
      `💡 Tapez "aide" pour voir toutes les commandes disponibles.\n\n` +
      `🚀 **Commandes rapides :**\n` +
      `• "vente 1000" - Enregistrer une vente\n` +
      `• "stock pain 10" - Mettre à jour le stock\n` +
      `• "bilan" - Voir le bilan du jour\n` +
      (userContext.role === 'owner' ? `• "dépense 500" - Enregistrer une dépense\n` : '') +
      `\n💬 Tapez "aide" pour l'aide complète.`;

    return quickHelp;
  }

  /**
   * Check if message is a greeting (bonjour, bonsoir, allo, etc.)
   */
  private isGreetingMessage(message: string): boolean {
    const normalizedMessage = message.toLowerCase().trim();
    
    const greetingKeywords = [
      'bonjour',
      'bonsoir',
      'allo',
      'salut',
      'hello',
      'hi',
      'hey',
      'coucou',
      'bon matin',
      'bonne journée',
      'bonne soirée'
    ];
    
    // Check for exact matches or simple greetings
    return greetingKeywords.some(keyword => 
      normalizedMessage === keyword || 
      normalizedMessage.startsWith(keyword + ' ') ||
      normalizedMessage === keyword + '!'
    );
  }

  /**
   * Handle greeting message for authenticated users
   * Ask what they want to do
   */
  private async handleGreetingForAuthenticatedUser(
    phoneNumber: string,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const greetingMessage = this.getGreetingMessage(userContext);
      await this.sendSuccessMessage(phoneNumber, greetingMessage);
      
      return {
        success: true,
        message: greetingMessage,
        data: { isGreeting: true }
      };
    } catch (error) {
      this.logger.error(`Error handling greeting for ${phoneNumber}:`, error);
      const response = 'Erreur lors du traitement de votre message.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Generate greeting message asking what user wants to do
   */
  private getGreetingMessage(userContext: UserContext): string {
    const role = userContext.role || 'seller';
    const businessName = userContext.businessName || 'votre entreprise';
    
    let message = `👋 **Bonjour !**\n\n`;
    
    if (userContext.businessName) {
      message += `Bienvenue dans ${businessName} !\n\n`;
    }
    
    message += `**Que souhaitez-vous faire aujourd'hui ?**\n\n`;
    
    // Role-based options
    if (role === 'owner' || role === 'manager') {
      message += `💰 **Ventes et Dépenses**\n`;
      message += `• "vente [produit] [montant]" - Enregistrer une vente\n`;
      message += `• "dépense [montant] [description]" - Enregistrer une dépense\n\n`;
      
      message += `📦 **Gestion du Stock**\n`;
      message += `• "produits" - Voir la liste complète des produits\n`;
      message += `• "stock [produit] [quantité]" - Mettre à jour le stock\n`;
      message += `• "stock [produit]" - Voir le stock d'un produit\n`;
      message += `• "stock" - Voir tout le stock\n`;
      message += `• "supprimer produit [nom]" - Supprimer un produit (nécessite confirmation)\n\n`;
      
      message += `📊 **Rapports et Bilans**\n`;
      message += `• "bilan" - Voir le bilan du jour\n`;
      message += `• "rapport [période]" - Générer un rapport\n`;
      message += `• "transactions" - Voir les transactions\n\n`;
    } else if (role === 'seller') {
      message += `💰 **Ventes**\n`;
      message += `• "vente [produit] [montant]" - Enregistrer une vente\n\n`;
      
      message += `📦 **Stock**\n`;
      message += `• "produits" - Voir la liste complète des produits\n`;
      message += `• "stock [produit]" - Voir le stock d'un produit\n`;
      message += `• "stock" - Voir tout le stock\n`;
      message += `• "stock [produit] [quantité]" - Mettre à jour le stock\n\n`;
    }
    
    message += `💡 **Aide**\n`;
    message += `• "aide" - Voir toutes les commandes disponibles\n\n`;
    
    message += `💬 **Exemples**\n`;
    message += `• "vente pain 500"\n`;
    message += `• "stock pain"\n`;
    message += `• "bilan"`;
    
    return message;
  }

  /**
   * Get user context from phone number
   * Handles database connection errors gracefully
   */
  private async getUserContext(phoneNumber: string): Promise<UserContext> {
    try {
      const user = await this.authService.getUserByPhone(phoneNumber);

      if (!user || !user.isActive) {
        return { isAuthenticated: false };
      }

      return {
        userId: user.id.toString(),
        businessId: user.business?.id?.toString(),
        businessName: user.business?.name,
        language: user.language || 'fr',
        role: user.role as 'owner' | 'seller' | 'manager',
        isAuthenticated: true
      };

    } catch (error) {
      this.logger.error(`Error getting user context for ${phoneNumber}:`, error);
      
      // Check if this is a database connection error
      const isDbError = this.isDatabaseConnectionError(error);
      
      if (isDbError) {
        this.logger.warn(`Database connection error detected for ${phoneNumber}, will retry`);
        // Return context indicating DB error (not authentication failure)
        return { 
          isAuthenticated: false,
          dbError: true 
        };
      }
      
      // For other errors, assume user is not authenticated
      return { isAuthenticated: false };
    }
  }

  /**
   * Check if error is a database connection error
   */
  private isDatabaseConnectionError(error: any): boolean {
    if (!error) return false;

    // TypeORM connection errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'EPIPE') {
      return true;
    }

    // PostgreSQL connection errors
    if (error.code === '57P01' || // admin_shutdown
        error.code === '57P02' || // crash_shutdown
        error.code === '57P03' || // cannot_connect_now
        error.code === '08003' || // connection_does_not_exist
        error.code === '08006' || // connection_failure
        error.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
        error.code === '08004' || // sqlserver_rejected_establishment_of_sqlconnection
        error.code === '08007') { // transaction_resolution_unknown
      return true;
    }

    // TypeORM QueryFailedError with connection issues
    if (error.name === 'QueryFailedError' || 
        error.name === 'ConnectionError' ||
        error.name === 'ConnectionTimeoutError') {
      return true;
    }

    // Check error message for connection-related keywords
    const errorMessage = error.message?.toLowerCase() || '';
    const connectionKeywords = [
      'connection',
      'connect',
      'timeout',
      'refused',
      'network',
      'database',
      'postgres',
      'econnrefused',
      'enotfound',
      'etimedout'
    ];

    return connectionKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Map period string to ReportPeriod enum
   */
  private mapPeriod(period: string): ReportPeriod {
    switch (period) {
      case 'week':
        return ReportPeriod.WEEK;
      case 'month':
        return ReportPeriod.MONTH;
      case 'day':
      default:
        return ReportPeriod.DAY;
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

  /**
   * Handle cart create command
   */
  private async handleCartCreateCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.cartCreateHandler.handleCartCreate(phoneNumber, command, userContext);
      
      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return result;
    } catch (error) {
      this.logger.error('Error handling cart create command:', error);
      const response = 'Erreur lors de la création du panier.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle cart add command
   */
  private async handleCartAddCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.cartHandlers.handleCartAdd(phoneNumber, command, userContext);
      
      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return result;
    } catch (error) {
      this.logger.error('Error handling cart add command:', error);
      const response = 'Erreur lors de l\'ajout au panier.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle cart remove command
   */
  private async handleCartRemoveCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.cartHandlers.handleCartRemove(phoneNumber, command, userContext);
      
      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return result;
    } catch (error) {
      this.logger.error('Error handling cart remove command:', error);
      const response = 'Erreur lors de la suppression du panier.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle cart view command
   */
  private async handleCartViewCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.cartHandlers.handleCartView(phoneNumber, command, userContext);
      
      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return result;
    } catch (error) {
      this.logger.error('Error handling cart view command:', error);
      const response = 'Erreur lors de l\'affichage du panier.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle cart finalize command
   */
  private async handleCartFinalizeCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.cartHandlers.handleCartFinalize(phoneNumber, command, userContext);
      
      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return result;
    } catch (error) {
      this.logger.error('Error handling cart finalize command:', error);
      const response = 'Erreur lors de la finalisation de la vente.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Handle cart cancel command
   */
  private async handleCartCancelCommand(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const result = await this.cartHandlers.handleCartCancel(phoneNumber, command, userContext);
      
      if (result.success) {
        await this.sendSuccessMessage(phoneNumber, result.message);
      } else {
        await this.sendErrorMessage(phoneNumber, result.message);
      }

      return result;
    } catch (error) {
      this.logger.error('Error handling cart cancel command:', error);
      const response = 'Erreur lors de l\'annulation du panier.';
      await this.sendErrorMessage(phoneNumber, response);
      return { success: false, message: response };
    }
  }

  /**
   * Health check for bot controller
   */
  async healthCheck(): Promise<{
    status: string;
    services: Record<string, boolean>;
    timestamp: string;
  }> {
    const services = {
      nlp: true,
      auth: true,
      transaction: true,
      stock: true,
      report: true,
      whatsapp: true,
      registration: true,
    };

    // Test each service availability (without making actual database calls)
    // Services are considered healthy if they can be instantiated and are available
    try {
      // Test if auth service is available
      if (!this.authService) {
        services.auth = false;
      }
    } catch (error) {
      services.auth = false;
    }

    try {
      // Test if stock service is available
      if (!this.stockService) {
        services.stock = false;
      }
    } catch (error) {
      services.stock = false;
    }

    try {
      // Test if transaction service is available
      if (!this.transactionService) {
        services.transaction = false;
      }
    } catch (error) {
      services.transaction = false;
    }

    try {
      // Test if report service is available
      if (!this.reportService) {
        services.report = false;
      }
    } catch (error) {
      services.report = false;
    }

    try {
      // Test if whatsapp service is available
      if (!this.whatsappService) {
        services.whatsapp = false;
      }
    } catch (error) {
      services.whatsapp = false;
    }

    try {
      // Test if registration handler service is available
      if (!this.registrationHandlerService) {
        services.registration = false;
      }
    } catch (error) {
      services.registration = false;
    }

    const allHealthy = Object.values(services).every(status => status);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString(),
    };
  }
}