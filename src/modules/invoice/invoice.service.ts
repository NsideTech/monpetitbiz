import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaleSession, SaleItem } from '../whatsapp/services/sale-session.service';

export interface InvoiceData {
  id: string;
  businessId: string;
  businessName: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  tax?: number;
  total: number;
  createdAt: Date;
  invoiceNumber: string;
}

@Injectable()
export class InvoiceService {
  constructor() {}

  /**
   * Generate invoice from sale session
   */
  async generateInvoice(
    session: SaleSession, 
    businessName: string,
    customerName?: string
  ): Promise<InvoiceData> {
    const invoiceNumber = this.generateInvoiceNumber(session.businessId);
    
    const invoice: InvoiceData = {
      id: session.id,
      businessId: session.businessId,
      businessName,
      customerName,
      customerPhone: session.phoneNumber,
      items: [...session.items],
      subtotal: session.totalAmount,
      tax: 0, // TODO: Add tax calculation if needed
      total: session.totalAmount,
      createdAt: new Date(),
      invoiceNumber
    };

    return invoice;
  }

  /**
   * Generate invoice as text for WhatsApp
   */
  generateInvoiceText(invoice: InvoiceData): string {
    let text = `🧾 **FACTURE #${invoice.invoiceNumber}**\n\n`;
    
    text += `🏪 **${invoice.businessName}**\n`;
    text += `📅 ${this.formatDate(invoice.createdAt)}\n`;
    
    if (invoice.customerName) {
      text += `👤 Client: ${invoice.customerName}\n`;
    }
    text += `📱 Tél: ${invoice.customerPhone}\n\n`;
    
    text += `📋 **DÉTAIL DE LA VENTE:**\n`;
    text += `${'─'.repeat(30)}\n`;
    
    invoice.items.forEach((item, index) => {
      text += `${index + 1}. ${item.product}\n`;
      text += `   ${item.quantity} × ${this.formatCurrency(item.unitPrice)} = ${this.formatCurrency(item.totalPrice)}\n`;
    });
    
    text += `${'─'.repeat(30)}\n`;
    text += `💰 **TOTAL: ${this.formatCurrency(invoice.total)}**\n\n`;
    
    text += `✅ Vente enregistrée avec succès\n`;
    text += `🙏 Merci pour votre confiance !`;
    
    return text;
  }

  /**
   * Generate invoice as PDF (future implementation)
   */
  async generateInvoicePDF(invoice: InvoiceData): Promise<Buffer> {
    // TODO: Implement PDF generation using libraries like puppeteer or jsPDF
    throw new Error('PDF generation not implemented yet');
  }

  /**
   * Send invoice via WhatsApp
   */
  async sendInvoiceViaWhatsApp(
    phoneNumber: string, 
    invoice: InvoiceData,
    whatsappService: any
  ): Promise<void> {
    const invoiceText = this.generateInvoiceText(invoice);
    await whatsappService.sendMessage(phoneNumber, invoiceText);
  }

  private generateInvoiceNumber(businessId: string): string {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const time = date.getTime().toString().substr(-6);
    
    return `INV${year}${month}${day}${time}`;
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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