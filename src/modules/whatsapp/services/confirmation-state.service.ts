import { Injectable } from '@nestjs/common';

export interface PendingConfirmation {
  type: 'product_delete';
  data: {
    product: string;
    businessId: string;
    userId: string;
  };
  timestamp: Date;
}

@Injectable()
export class ConfirmationStateService {
  private pendingConfirmations = new Map<string, PendingConfirmation>();

  /**
   * Set a pending confirmation for a user
   */
  setPendingConfirmation(phoneNumber: string, confirmation: PendingConfirmation): void {
    this.pendingConfirmations.set(phoneNumber, confirmation);
    
    // Auto-expire after 5 minutes
    setTimeout(() => {
      this.clearPendingConfirmation(phoneNumber);
    }, 5 * 60 * 1000);
  }

  /**
   * Get pending confirmation for a user
   */
  getPendingConfirmation(phoneNumber: string): PendingConfirmation | null {
    return this.pendingConfirmations.get(phoneNumber) || null;
  }

  /**
   * Clear pending confirmation for a user
   */
  clearPendingConfirmation(phoneNumber: string): void {
    this.pendingConfirmations.delete(phoneNumber);
  }

  /**
   * Check if user has a pending confirmation
   */
  hasPendingConfirmation(phoneNumber: string): boolean {
    return this.pendingConfirmations.has(phoneNumber);
  }

  /**
   * Check if confirmation is expired (older than 5 minutes)
   */
  isConfirmationExpired(phoneNumber: string): boolean {
    const confirmation = this.pendingConfirmations.get(phoneNumber);
    if (!confirmation) return true;

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    return confirmation.timestamp < fiveMinutesAgo;
  }
}