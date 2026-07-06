/**
 * Subset of types matching the Egyptian Tax Authority e-invoicing JSON spec
 * (https://sdk.preprod.invoicing.eta.gov.eg).
 * We intentionally model only what we use in this MVP.
 */

export interface EtaAddress {
  country: string;
  governate: string;
  regionCity: string;
  street: string;
  buildingNumber: string;
  postalCode?: string;
  floor?: string;
  room?: string;
  landmark?: string;
  additionalInformation?: string;
}

export interface EtaIssuer {
  type: 'B' | 'P';
  id: string;       // RIN or national ID
  name: string;
  address: EtaAddress;
}

export interface EtaReceiver {
  type: 'B' | 'P' | 'F';
  id?: string;
  name: string;
  address?: Partial<EtaAddress>;
}

export interface EtaAmount {
  currencySold: string;
  amountEGP: number;
  amountSold?: number;
  currencyExchangeRate?: number;
}

export interface EtaTaxableItem {
  taxType: string;          // e.g. "T1" (VAT)
  amount: number;
  subType: string;          // e.g. "V009"
  rate: number;             // %
}

export interface EtaInvoiceLine {
  description: string;
  itemType: 'GS1' | 'EGS';
  itemCode: string;
  unitType: string;
  quantity: number;
  internalCode?: string;
  salesTotal: number;
  total: number;
  valueDifference?: number;
  totalTaxableFees?: number;
  netTotal: number;
  itemsDiscount?: number;
  unitValue: { currencySold: string; amountEGP: number };
  discount: { rate: number; amount: number };
  taxableItems: EtaTaxableItem[];
}

/**
 * Digital signature attached to a document before submission.
 *
 * The value is a Base64-encoded CAdES-BES signature produced by the Desktop
 * Agent (which reads the eSeal certificate from the USB Token / HSM).
 * At minimum one Issuer (`I`) signature is required by ETA; ServiceProvider
 * (`S`) signatures are optional and only used by certified integrators.
 *
 * Spec: https://sdk.preprod.invoicing.eta.gov.eg/documents/invoice-v1-0/
 */
export interface EtaSignature {
  signatureType: 'I' | 'S';
  value: string;
}

export interface EtaDocument {
  issuer: EtaIssuer;
  receiver: EtaReceiver;
  documentType: 'i' | 'c' | 'd' | 'r';
  documentTypeVersion: string;     // "1.0"
  dateTimeIssued: string;          // ISO
  taxpayerActivityCode: string;
  internalID: string;
  invoiceLines: EtaInvoiceLine[];
  totalDiscountAmount: number;
  totalSalesAmount: number;
  netAmount: number;
  taxTotals: { taxType: string; amount: number }[];
  totalAmount: number;
  extraDiscountAmount: number;
  totalItemsDiscountAmount: number;
  signatures?: EtaSignature[];
}

export interface EtaSubmitResponse {
  submissionId?: string;
  acceptedDocuments?: Array<{ uuid: string; longId: string; internalId: string; hashKey: string }>;
  rejectedDocuments?: Array<{ internalId: string; error: { code: string; message: string } }>;
}
