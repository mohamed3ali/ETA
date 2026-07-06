/**
 * Official ETA document verification URL embedded in invoice QR codes.
 *
 * @see https://sdk.preprod.invoicing.eta.gov.eg/documents/invoice-v1-0/
 */
const PORTAL_BASE: Record<'preprod' | 'production', string> = {
  production: 'https://invoicing.eta.gov.eg',
  preprod: 'https://preprod.invoicing.eta.gov.eg',
};

export interface EtaQrPayloadInput {
  etaUuid: string;
  etaLongId?: string | null;
  etaEnvironment: 'preprod' | 'production';
  /** Used only when longId is absent (legacy / in-flight sync). */
  invoiceNumber: string;
  total: number | string;
  currency: string;
}

/**
 * Returns the string to encode in the invoice QR code.
 * Prefers the official ETA share URL when `etaLongId` is available.
 */
export const buildEtaQrPayload = (input: EtaQrPayloadInput): string => {
  if (input.etaLongId?.trim()) {
    const base = PORTAL_BASE[input.etaEnvironment] ?? PORTAL_BASE.preprod;
    return `${base}/documents/${input.etaUuid}/share/${input.etaLongId.trim()}`;
  }
  return `${input.etaUuid}|${input.invoiceNumber}|${input.total}|${input.currency}`;
};
