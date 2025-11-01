import { Injectable, Logger } from '@nestjs/common';
import { SaleSessionService, SaleItem } from '../services/sale-session.service';
import { StockService } from '../../stock/stock.service';
import { TransactionService } from '../../transaction/transaction.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { UserContext } from '../services/nlp.service';
import { TransactionType } from '../../transaction/entities/transaction.entity';

export interface BotResponse {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable()
export class CartHandlers {
  private readonly logger = new Logger(CartHandlers.name);

  constructor(
    private readonly saleSessionService: SaleSessionService,
    private readonly stockService: StockService,
    private readonly transactionService: TransactionService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /**
   * Handle cart add command
   */
  async handleCartAdd(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      if (!command.product || !command.quantity) {
        return {
          success: false,
          message: 'Format: ajouter [produit] [quantité]\nExemple: ajouter pain 5'
        };
      }

      // Check if product exists and get price
      const stockLevel = await this.stockService.getStockLevel(userContext.businessId!, command.product);
      const unitPrice = await this.stockService.getUnitPrice(userContext.businessId!, command.product);

      if (stockLevel === 0) {
        return {
          success: false,
          message: `❌ Produit "${command.product}" en rupture de stock.`
        };
      }

      if (command.quantity > stockLevel) {
        return {
          success: false,
          message: `⚠️ Stock insuffisant pour ${command.product}\n` +
            `Stock disponible: ${stockLevel} unités\n` +
            `Quantité demandée: ${command.quantity} unités\n\n` +
            `💡 Voulez-vous ajouter ${stockLevel} unités (maximum disponible) ?\n` +
            `Tapez "ajouter ${command.product} ${stockLevel}" pour confirmer.`
        };
      }

      if (!unitPrice) {
        return {
          success: false,
          message: `❌ Prix non configuré pour "${command.product}".\n\n` +
            `💡 Configurez le prix avec: prix ${command.product} [montant]`
        };
      }

      // Get or create session
      let session = this.saleSessionService.getCurrentSession(phoneNumber);
      if (!session) {
        session = this.saleSessionService.startSession(phoneNumber, userContext.businessId!, userContext.userId!);
      }

      // Add item to session
      const item: SaleItem = {
        product: command.product,
        quantity: command.quantity,
        unitPrice: unitPrice,
        totalPrice: command.quantity * unitPrice,
        unit: 'pièce' // TODO: Get from product configuration
      };

      const updatedSession = this.saleSessionService.addItem(phoneNumber, item);
      if (!updatedSession) {
        return {
          success: false,
          message: 'Erreur lors de l\'ajout au panier.'
        };
      }

      // Generate response
      const isNewProduct = !session.items.find(i => i.product === command.product);
      const actionText = isNewProduct ? 'ajouté' : 'mis à jour';
      
      let response = `🛒 ${isNewProduct ? 'Panier créé !' : 'Panier mis à jour !'}\n\n`;
      response += `📦 ${command.product} ${actionText}: ${command.quantity} × ${this.formatCurrency(unitPrice)} = ${this.formatCurrency(item.totalPrice)}\n\n`;
      response += this.saleSessionService.getSessionSummary(phoneNumber) || '';

      return {
        success: true,
        message: response,
        data: { session: updatedSession }
      };

    } catch (error) {
      this.logger.error('Error handling cart add:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'ajout au panier.'
      };
    }
  }

  /**
   * Handle cart remove command
   */
  async handleCartRemove(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      if (!command.product) {
        return {
          success: false,
          message: 'Format: retirer [produit]\nExemple: retirer pain'
        };
      }

      const session = this.saleSessionService.getCurrentSession(phoneNumber);
      if (!session) {
        return {
          success: false,
          message: '❌ Aucun panier actif.\n\n💡 Commencez une vente avec "ajouter [produit] [quantité]"'
        };
      }

      const updatedSession = this.saleSessionService.removeItem(phoneNumber, command.product);
      if (!updatedSession) {
        return {
          success: false,
          message: `❌ Produit "${command.product}" non trouvé dans le panier.`
        };
      }

      let response = `❌ ${command.product} retiré du panier\n\n`;
      
      if (updatedSession.items.length === 0) {
        response += '🛒 Panier vide\n\n💡 Ajoutez des produits avec "ajouter [produit] [quantité]"';
      } else {
        response += this.saleSessionService.getSessionSummary(phoneNumber) || '';
      }

      return {
        success: true,
        message: response,
        data: { session: updatedSession }
      };

    } catch (error) {
      this.logger.error('Error handling cart remove:', error);
      return {
        success: false,
        message: 'Erreur lors de la suppression du panier.'
      };
    }
  }

  /**
   * Handle cart view command
   */
  async handleCartView(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const session = this.saleSessionService.getCurrentSession(phoneNumber);
      if (!session || session.items.length === 0) {
        return {
          success: false,
          message: '🛒 Panier vide\n\n💡 Ajoutez des produits avec "ajouter [produit] [quantité]"'
        };
      }

      const summary = this.saleSessionService.getSessionSummary(phoneNumber);
      return {
        success: true,
        message: summary || 'Erreur lors de l\'affichage du panier.',
        data: { session }
      };

    } catch (error) {
      this.logger.error('Error handling cart view:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'affichage du panier.'
      };
    }
  }

  /**
   * Handle cart finalize command
   */
  async handleCartFinalize(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const session = this.saleSessionService.getCurrentSession(phoneNumber);
      if (!session || session.items.length === 0) {
        return {
          success: false,
          message: '❌ Impossible de finaliser une vente vide.\n\n💡 Ajoutez des produits avec "ajouter [produit] [quantité]"'
        };
      }

      // Validate stock availability for all items
      for (const item of session.items) {
        const currentStock = await this.stockService.getStockLevel(userContext.businessId!, item.product);
        if (currentStock < item.quantity) {
          return {
            success: false,
            message: `❌ Stock insuffisant pour finaliser la vente.\n\n` +
              `${item.product}: ${item.quantity} demandées, ${currentStock} disponibles\n\n` +
              `💡 Modifiez les quantités ou réapprovisionnez le stock.`
          };
        }
      }

      // Record transaction
      const transaction = await this.transactionService.recordTransaction({
        businessId: userContext.businessId!,
        userId: userContext.userId!,
        type: TransactionType.SALE,
        amount: session.totalAmount,
        description: `Vente multi-produits: ${session.items.map(i => `${i.quantity}x ${i.product}`).join(', ')}`
      });

      // Update stock for all items
      for (const item of session.items) {
        try {
          await this.stockService.decrementStock(
            userContext.businessId!,
            item.product,
            item.quantity,
            userContext.userId!,
            item.totalPrice
          );
        } catch (error) {
          this.logger.warn(`Failed to update stock for ${item.product}:`, error);
        }
      }

      // Generate invoice
      const businessName = userContext.businessName || 'MonPetitBiz';
      const invoice = await this.invoiceService.generateInvoice(session, businessName);
      const invoiceText = this.invoiceService.generateInvoiceText(invoice);

      // Complete session
      this.saleSessionService.completeSession(phoneNumber);

      return {
        success: true,
        message: invoiceText,
        data: { 
          transaction,
          invoice,
          totalAmount: session.totalAmount,
          itemCount: session.items.length
        }
      };

    } catch (error) {
      this.logger.error('Error handling cart finalize:', error);
      return {
        success: false,
        message: 'Erreur lors de la finalisation de la vente.'
      };
    }
  }

  /**
   * Handle cart cancel command
   */
  async handleCartCancel(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      const session = this.saleSessionService.getCurrentSession(phoneNumber);
      if (!session) {
        return {
          success: false,
          message: '❌ Aucun panier à annuler.'
        };
      }

      const itemCount = session.items.length;
      const totalAmount = session.totalAmount;

      const cancelled = this.saleSessionService.cancelSession(phoneNumber);
      if (!cancelled) {
        return {
          success: false,
          message: 'Erreur lors de l\'annulation du panier.'
        };
      }

      return {
        success: true,
        message: `🗑️ Panier annulé\n\n` +
          `${itemCount} produit(s) supprimé(s)\n` +
          `Montant annulé: ${this.formatCurrency(totalAmount)}\n\n` +
          `💡 Commencez une nouvelle vente avec "ajouter [produit] [quantité]"`,
        data: { cancelledAmount: totalAmount, cancelledItems: itemCount }
      };

    } catch (error) {
      this.logger.error('Error handling cart cancel:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'annulation du panier.'
      };
    }
  }

  private formatCurrency(amount: number, currency: string = 'XOF'): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}