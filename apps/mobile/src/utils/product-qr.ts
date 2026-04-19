/**
 * Product QR code format for MonPetitBiz.
 * Format: monpetitbiz://product/{businessId}/{productId}
 * - Reconnaissable uniquement par notre solution (préfixe monpetitbiz://)
 * - Associé par entreprise (businessId)
 */

const SCHEME = 'monpetitbiz';

export function buildProductQrPayload(
  businessId: string,
  productId: string,
): string {
  return `${SCHEME}://product/${businessId}/${productId}`;
}

export type ProductQrPayload = {
  businessId: string;
  productId: string;
};

export function parseProductQrPayload(data: string): ProductQrPayload | null {
  if (!data || typeof data !== 'string') return null;
  const trimmed = data.trim();
  if (!trimmed.startsWith(`${SCHEME}://`)) return null;
  const path = trimmed.slice(SCHEME.length + 3);
  if (!path.startsWith('product/')) return null;
  const parts = path.slice(8).split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [businessId, productId] = parts;
  if (!businessId || !productId) return null;
  return { businessId, productId };
}

export function isMonPetitBizProductQr(data: string): boolean {
  return parseProductQrPayload(data) !== null;
}
