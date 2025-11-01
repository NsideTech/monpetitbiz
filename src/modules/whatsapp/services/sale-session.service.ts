import { Injectable } from '@nestjs/common';

export interface SaleItem {
  product: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit?: string;
}

export interface SaleSession {
  id: string;
  businessId: string;
  userId: string;
  phoneNumber: string;
  items: SaleItem[];
  totalAmount: number;
  createdAt: Date;
  lastUpdatedAt: Date;
  status: 'active' | 'completed' | 'cancelled';
}

@Injectable()
export class SaleSessionService {
  private activeSessions = new Map<string, SaleSession>();

  /**
   * Start a new sale session
   */
  startSession(phoneNumber: string, businessId: string, userId: string): SaleSession {
    // End any existing session for this user
    this.endSession(phoneNumber);

    const session: SaleSession = {
      id: this.generateSessionId(),
      businessId,
      userId,
      phoneNumber,
      items: [],
      totalAmount: 0,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      status: 'active'
    };

    this.activeSessions.set(phoneNumber, session);
    return session;
  }

  /**
   * Add item to current session
   */
  addItem(phoneNumber: string, item: SaleItem): SaleSession | null {
    const session = this.activeSessions.get(phoneNumber);
    if (!session || session.status !== 'active') {
      return null;
    }

    // Check if product already exists in session
    const existingItemIndex = session.items.findIndex(i => i.product === item.product);
    
    if (existingItemIndex >= 0) {
      // Update existing item
      const existingItem = session.items[existingItemIndex];
      existingItem.quantity += item.quantity;
      existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
    } else {
      // Add new item
      session.items.push(item);
    }

    // Recalculate total
    session.totalAmount = session.items.reduce((sum, item) => sum + item.totalPrice, 0);
    session.lastUpdatedAt = new Date();

    return session;
  }

  /**
   * Remove item from session
   */
  removeItem(phoneNumber: string, productName: string): SaleSession | null {
    const session = this.activeSessions.get(phoneNumber);
    if (!session || session.status !== 'active') {
      return null;
    }

    session.items = session.items.filter(item => item.product !== productName);
    session.totalAmount = session.items.reduce((sum, item) => sum + item.totalPrice, 0);
    session.lastUpdatedAt = new Date();

    return session;
  }

  /**
   * Update item quantity in session
   */
  updateItemQuantity(phoneNumber: string, productName: string, newQuantity: number): SaleSession | null {
    const session = this.activeSessions.get(phoneNumber);
    if (!session || session.status !== 'active') {
      return null;
    }

    const item = session.items.find(i => i.product === productName);
    if (!item) {
      return null;
    }

    if (newQuantity <= 0) {
      return this.removeItem(phoneNumber, productName);
    }

    item.quantity = newQuantity;
    item.totalPrice = item.quantity * item.unitPrice;
    session.totalAmount = session.items.reduce((sum, item) => sum + item.totalPrice, 0);
    session.lastUpdatedAt = new Date();

    return session;
  }

  /**
   * Get current session
   */
  getCurrentSession(phoneNumber: string): SaleSession | null {
    const session = this.activeSessions.get(phoneNumber);
    return session && session.status === 'active' ? session : null;
  }

  /**
   * Complete session (finalize sale)
   */
  completeSession(phoneNumber: string): SaleSession | null {
    const session = this.activeSessions.get(phoneNumber);
    if (!session || session.status !== 'active') {
      return null;
    }

    session.status = 'completed';
    session.lastUpdatedAt = new Date();
    
    // Keep completed session for a short time for reference
    setTimeout(() => {
      this.activeSessions.delete(phoneNumber);
    }, 5 * 60 * 1000); // 5 minutes

    return session;
  }

  /**
   * Cancel current session
   */
  cancelSession(phoneNumber: string): boolean {
    const session = this.activeSessions.get(phoneNumber);
    if (!session || session.status !== 'active') {
      return false;
    }

    session.status = 'cancelled';
    this.activeSessions.delete(phoneNumber);
    return true;
  }

  /**
   * End session (cleanup)
   */
  endSession(phoneNumber: string): void {
    this.activeSessions.delete(phoneNumber);
  }

  /**
   * Check if user has active session
   */
  hasActiveSession(phoneNumber: string): boolean {
    const session = this.activeSessions.get(phoneNumber);
    return session !== undefined && session.status === 'active';
  }

  /**
   * Get session summary for display
   */
  getSessionSummary(phoneNumber: string): string | null {
    const session = this.getCurrentSession(phoneNumber);
    if (!session) {
      return null;
    }

    if (session.items.length === 0) {
      return `🛒 **Panier créé et prêt !**\n\n` +
        `💡 Ajoutez des produits:\n` +
        `• "[produit] [quantité]" - exemple: pain 5\n` +
        `• "voir" - voir le contenu\n` +
        `• "annuler" - annuler le panier`;
    }

    let summary = `🛒 **Panier actuel:**\n\n`;
    
    session.items.forEach((item, index) => {
      summary += `${index + 1}. ${item.product}\n`;
      summary += `   ${item.quantity} × ${this.formatCurrency(item.unitPrice)} = ${this.formatCurrency(item.totalPrice)}\n\n`;
    });

    summary += `💰 **Total: ${this.formatCurrency(session.totalAmount)}**\n\n`;
    summary += `💡 Commandes disponibles:\n`;
    summary += `• "[produit] [quantité]" - ajouter un produit\n`;
    summary += `• "retirer [produit]" - retirer un produit\n`;
    summary += `• "voir" - voir le panier\n`;
    summary += `• "finaliser" - enregistrer la vente\n`;
    summary += `• "annuler" - annuler la vente`;

    return summary;
  }

  /**
   * Auto-expire old sessions (cleanup)
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [phoneNumber, session] of this.activeSessions.entries()) {
      if (now.getTime() - session.lastUpdatedAt.getTime() > maxAge) {
        this.activeSessions.delete(phoneNumber);
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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