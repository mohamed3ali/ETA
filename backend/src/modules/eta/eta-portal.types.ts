/** ETA Search Documents API — https://sdk.invoicing.eta.gov.eg/einvoicingapi/16-search-documents/ */

export type EtaPortalDirection = 'Sent' | 'Received';

export type EtaPortalDocumentStatus =
  | 'Valid'
  | 'Invalid'
  | 'Rejected'
  | 'Cancelled'
  | 'Submitted';

export interface EtaDocumentSummary {
  uuid: string;
  submissionUUID?: string;
  longId?: string;
  publicUrl?: string;
  internalId: string;
  typeName: string;
  typeVersionName?: string;
  issuerId: string;
  issuerName: string;
  issuerType: string;
  receiverId?: string;
  receiverName?: string;
  receiverType?: string;
  dateTimeIssued: string;
  dateTimeReceived?: string;
  totalSales: number;
  totalDiscount: number;
  netAmount: number;
  total: number;
  status: EtaPortalDocumentStatus;
  documentStatusReason?: string;
}

export interface EtaSearchDocumentsResponse {
  result: EtaDocumentSummary[];
  metadata: {
    continuationToken?: string;
    totalPages?: number;
    totalCount?: number;
  };
}

export interface PortalSearchParams {
  direction?: EtaPortalDirection;
  issueDateFrom: string;
  issueDateTo: string;
  status?: EtaPortalDocumentStatus;
  documentType?: string;
  uuid?: string;
  internalID?: string;
  issuerId?: string;
  receiverId?: string;
  continuationToken?: string;
  pageSize?: number;
  /** Client-side filter on issuer/receiver/internalId (applied after fetch). */
  search?: string;
}

export interface PortalSearchResult {
  documents: EtaDocumentSummary[];
  continuationToken: string | null;
  mock: boolean;
  message?: string;
}
