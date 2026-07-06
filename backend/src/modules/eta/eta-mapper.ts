import { Invoice } from '../invoices/invoice.entity';
import { Company } from '../companies/company.entity';
import { Customer, CustomerType } from '../customers/customer.entity';
import { EtaAddress, EtaDocument, EtaInvoiceLine, EtaReceiver } from './eta.types';

const round = (n: number, d = 5): number => {
  const f = Math.pow(10, d);
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};

const buildAddress = (full?: string | null): EtaAddress => ({
  country: 'EG',
  governate: 'Cairo',
  regionCity: 'Cairo',
  street: full || 'N/A',
  buildingNumber: '1',
});

const mapReceiverType = (t: CustomerType): EtaReceiver['type'] => {
  if (t === CustomerType.BUSINESS) return 'B';
  if (t === CustomerType.FOREIGNER) return 'F';
  return 'P';
};

export const mapInvoiceToEta = (
  invoice: Invoice & { items: Invoice['items']; customer: Customer; company?: Company },
  company: Company,
): EtaDocument => {
  const lines: EtaInvoiceLine[] = invoice.items.map((item) => {
    const salesTotal = round(Number(item.quantity) * Number(item.unitPrice));
    const netTotal = round(salesTotal - Number(item.discount ?? 0));
    const taxAmount = round(Number(item.taxAmount));
    return {
      description: item.description,
      itemType: item.etaCodeType,
      itemCode: item.etaItemCode ?? 'EG-000000',
      unitType: item.unitType,
      quantity: Number(item.quantity),
      internalCode: item.id,
      salesTotal,
      total: round(netTotal + taxAmount),
      netTotal,
      itemsDiscount: 0,
      unitValue: {
        currencySold: invoice.currency,
        amountEGP: Number(item.unitPrice),
      },
      discount: {
        rate: 0,
        amount: Number(item.discount ?? 0),
      },
      taxableItems: [
        {
          taxType: 'T1',
          subType: 'V009',
          rate: Number(item.taxRate),
          amount: taxAmount,
        },
      ],
    };
  });

  return {
    issuer: {
      type: 'B',
      id: company.taxRegistrationNumber,
      name: company.name,
      address: buildAddress(company.address),
    },
    receiver: {
      type: mapReceiverType(invoice.customer.type),
      id: invoice.customer.taxRegistrationNumber || invoice.customer.nationalId,
      name: invoice.customer.name,
      address: buildAddress(invoice.customer.address),
    },
    documentType: invoice.type,
    documentTypeVersion: '1.0',
    dateTimeIssued: new Date(`${invoice.issueDate}T00:00:00Z`).toISOString(),
    taxpayerActivityCode: '4711', // default — should be configurable per company
    internalID: invoice.invoiceNumber,
    invoiceLines: lines,
    totalDiscountAmount: round(Number(invoice.totalDiscount)),
    totalSalesAmount: round(Number(invoice.subtotal)),
    netAmount: round(Number(invoice.subtotal) - Number(invoice.totalDiscount)),
    taxTotals: [{ taxType: 'T1', amount: round(Number(invoice.totalTax)) }],
    totalAmount: round(Number(invoice.total)),
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
  };
};
