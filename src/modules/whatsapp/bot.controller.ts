import { Injectable, Logger } from '@nestjs/common';
import { ProcessedMessage } from './interfaces/webhook.interface';
import { NLPService, UserContext, NLPResult } from './services/nlp.service';
import { AuthService } from '../auth/auth.service';
import { TransactionService } from '../transaction/transaction.service';
import { StockService } from '../stock/stock.service';
import { ReportService } from '../report/report.service';
import { WhatsappService } from './whatsapp.service';
import { TransactionType } from '../transaction/entities/transaction.entity';
import { ReportPeriod } from '../report/dto/report.dto';

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
  ) { }

  /**
   * Main entry point for processing WhatsApp messages
   * This orchestrates all services to handle user commands
   */
  async processMessage(message: ProcessedMessage): Promise<BotResponse> {
    this.logger.log(`Processing message from ${message.from}: "${message.body}"`);

    try {
      // Get user context
      const userContext = await this.getUserContext(message.from);

      // Process message with NLP service
      const nlpResult = await this.nlpService.processMessage(message, userContext);

      // Handle authentication if required
      if (nlpResult.requiresAuth && !userContext.isAuthenticated) {
        return await this.handleAuthenticationRequired(message.from, nlpResult);
      }

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

    switch (command.type) {
      case 'sale':
        return await this.handleSaleCommand(phoneNumber, command, userContext);

      case 'expense':
        return await this.handleExpenseCommand(phoneNumber, command, userContext);

      case 'stock':
        return await this.handleStockUpdateCommand(phoneNumber, command, userContext);

      case 'stock_query':
        return await this.handleStockQueryCommand(phoneNumber, command, userContext);

      case 'balance':
        return await this.handleBalanceCommand(phoneNumber, command, userContext);

      case 'report':
        return await this.handleReportCommand(phoneNumber, command, userContext);

      case 'unknown':
      default:
        const helpMessage = nlpResult.suggestedResponse || 'Commande non reconnue.';
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
        try {
          const stockDecremented = await this.stockService.decrementStock(
            userContext.businessId!,
            command.product,
            1
          );

          if (!stockDecremented) {
            const currentStock = await this.stockService.getStockLevel(
              userContext.businessId!,
              command.product
            );
            if (currentStock === 0) {
              stockMessage = `\n⚠️ ${command.product} est maintenant en rupture de stock.`;
            } else {
              stockMessage = `\n⚠️ Stock insuffisant pour ${command.product}.`;
            }
          }
        } catch (stockError) {
          this.logger.warn(`Stock update failed for sale ${transaction.id}:`, stockError);
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
      const stockItems = await this.stockService.getStock(
        userContext.businessId!,
        command.product
      );

      let response: string;

      if (command.product) {
        // Single product query
        const item = stockItems[0];
        response = `📦 Stock ${item.product}: ${item.quantity} unités`;

        if (item.quantity === 0) {
          response += ' ⚠️ (Rupture de stock)';
        } else if (item.quantity <= 5) {
          response += ' ⚠️ (Stock faible)';
        }
      } else {
        // All products query
        if (stockItems.length === 0) {
          response = '📦 Aucun produit en stock.';
        } else {
          response = '📦 ÉTAT DU STOCK:\n';
          stockItems.forEach(item => {
            response += `• ${item.product}: ${item.quantity} unités`;
            if (item.quantity === 0) {
              response += ' ⚠️';
            } else if (item.quantity <= 5) {
              response += ' ⚠️';
            }
            response += '\n';
          });
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
        response = `Produit "${command.product}" non trouvé dans le stock.`;
      } else {
        response = 'Erreur lors de la consultation du stock.';
      }

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
   * Handle authentication required scenario
   */
  private async handleAuthenticationRequired(
    phoneNumber: string,
    nlpResult: NLPResult
  ): Promise<BotResponse> {
    const response = `🔐 Authentification requise.\n\nPour utiliser ce service, vous devez d'abord vous authentifier.\n\nEnvoyez "AUTH" pour commencer le processus d'authentification.`;

    try {
      await this.whatsappService.sendMessage(phoneNumber, response);
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
      await this.whatsappService.sendMessage(phoneNumber, message);
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
      await this.whatsappService.sendMessage(phoneNumber, message);
    } catch (error) {
      this.logger.error(`Failed to send success message to ${phoneNumber}:`, error);
      // Log the successful operation even if message sending fails
      this.logger.warn(`Operation succeeded but notification failed for ${phoneNumber}: ${message}`);
    }
  }

  /**
   * Get user context from phone number
   */
  private async getUserContext(phoneNumber: string): Promise<UserContext> {
    try {
      const user = await this.authService.getUserByPhone(phoneNumber);

      if (!user || !user.isActive) {
        return { isAuthenticated: false };
      }

      return {
        userId: user.id,
        businessId: user.businessId,
        language: user.language,
        role: user.role,
        isAuthenticated: true,
      };
    } catch (error) {
      this.logger.error(`Error getting user context for ${phoneNumber}:`, error);
      return { isAuthenticated: false };
    }
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

    const allHealthy = Object.values(services).every(status => status);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString(),
    };
  }
}