import { Injectable, Logger } from '@nestjs/common';
import { SaleSessionService } from '../services/sale-session.service';
import { UserContext } from '../services/nlp.service';

export interface BotResponse {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable()
export class CartCreateHandler {
  private readonly logger = new Logger(CartCreateHandler.name);

  constructor(
    private readonly saleSessionService: SaleSessionService,
  ) {}

  /**
   * Handle cart create command
   */
  async handleCartCreate(
    phoneNumber: string,
    command: any,
    userContext: UserContext
  ): Promise<BotResponse> {
    try {
      // Check if user already has an active session
      const existingSession = this.saleSessionService.getCurrentSession(phoneNumber);
      
      if (existingSession) {
        if (existingSession.items.length === 0) {
          // Empty cart already exists
          const summary = this.saleSessionService.getSessionSummary(phoneNumber);
          return {
            success: true,
            message: `🛒 Vous avez déjà un panier vide.\n\n${summary}`,
            data: { session: existingSession }
          };
        } else {
          // Cart with items exists
          return {
            success: false,
            message: `🛒 Vous avez déjà un panier actif avec ${existingSession.items.length} produit(s).\n\n` +
              `💡 Options disponibles:\n` +
              `• "voir" - voir le contenu actuel\n` +
              `• "finaliser" - terminer la vente en cours\n` +
              `• "annuler" - supprimer le panier actuel\n\n` +
              `Ou continuez à ajouter des produits avec "[produit] [quantité]"`
          };
        }
      }

      // Create new session
      const session = this.saleSessionService.startSession(
        phoneNumber, 
        userContext.businessId!, 
        userContext.userId!
      );

      const summary = this.saleSessionService.getSessionSummary(phoneNumber);

      return {
        success: true,
        message: summary || 'Panier créé avec succès !',
        data: { session }
      };

    } catch (error) {
      this.logger.error('Error handling cart create:', error);
      return {
        success: false,
        message: 'Erreur lors de la création du panier.'
      };
    }
  }
}