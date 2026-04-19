import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type {Transaction} from '../api/types';

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatAmount = (n: number, currency: string): string => {
  const formatted = (Number(n) || 0).toLocaleString('fr-FR');
  return currency === 'XOF' ? `${formatted} F CFA` : `${formatted} ${currency}`;
};

const formatDate = (s: string): string =>
  new Date(s).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function buildInvoiceHtml(
  transaction: Transaction,
  businessName: string,
): string {
  const isSale = transaction.type === 'sale';
  const isCreditSale = isSale && !!(transaction.isCreditSale ?? (transaction as {is_credit_sale?: boolean}).is_credit_sale);
  const docType = isSale
    ? isCreditSale
      ? 'FACTURE (Vente à crédit)'
      : 'FACTURE'
    : 'BON DE DÉPENSE';
  const invoiceNumber = `FAC-${new Date(transaction.createdAt).toISOString().slice(0, 10).replace(/-/g, '')}-${transaction.id.slice(0, 8)}`;
  const amount = Number(transaction.amount) || 0;
  const quantity = transaction.quantity ?? 1;
  const unitPrice = quantity > 0 ? amount / quantity : amount;
  const currency = transaction.currency || 'XOF';

  const productRow =
    transaction.product ?
      `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Produit</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${escapeHtml(transaction.product)}</td>
    </tr>`
    : '';
  const quantityRow =
    quantity != null && quantity > 0 ?
      `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Quantité</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${quantity}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Prix unitaire</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatAmount(unitPrice, currency)}</td>
    </tr>`
    : '';
  const descriptionRow =
    transaction.description ?
      `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Description</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${escapeHtml(transaction.description)}</td>
    </tr>`
    : '';
  const creditMention =
    isCreditSale ?
      `
    <p style="margin-top: 12px; padding: 8px; background: #fef2f2; border-radius: 6px; font-size: 12px; color: #b91c1c;">
      Vente à crédit — À payer
    </p>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; font-size: 14px; color: #1f2937; }
    .header { text-align: center; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 700; color: #111827; }
    .doc-type { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .invoice-num { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .total-row { font-size: 16px; font-weight: 700; margin-top: 16px; padding-top: 12px; border-top: 2px solid #111827; }
    .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${escapeHtml(businessName)}</div>
    <div class="doc-type">${docType}</div>
    <div class="invoice-num">${invoiceNumber}</div>
  </div>
  <table>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Date</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatDate(transaction.createdAt)}</td>
    </tr>
    ${productRow}
    ${quantityRow}
    ${descriptionRow}
    <tr class="total-row">
      <td style="padding: 12px 0 0 0;">TOTAL</td>
      <td style="padding: 12px 0 0 0; text-align: right;">${formatAmount(amount, currency)}</td>
    </tr>
  </table>
  ${creditMention}
  <p class="footer">Généré par MonPetitBiz</p>
</body>
</html>`;
}

export async function generateTransactionInvoicePdf(
  transaction: Transaction,
  businessName: string,
): Promise<string> {
  const html = buildInvoiceHtml(transaction, businessName);
  const {uri} = await Print.printToFileAsync({
    html,
    base64: false,
  });
  return uri;
}

export async function shareTransactionInvoice(
  transaction: Transaction,
  businessName: string,
): Promise<void> {
  const uri = await generateTransactionInvoicePdf(transaction, businessName);
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Le partage n\'est pas disponible sur cet appareil');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Partager la facture',
  });
}
