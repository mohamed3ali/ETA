import { InvoiceItem } from './invoice-item.entity';

export interface CalculatedLine {
  description: string;
  productId?: string | null;
  etaItemCode?: string;
  etaCodeType: 'GS1' | 'EGS';
  unitType: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface CalculatedTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  total: number;
  lines: CalculatedLine[];
}

const round = (n: number, d = 4) => {
  const f = Math.pow(10, d);
  return Math.round((n + Number.EPSILON) * f) / f;
};

export const calculateInvoiceTotals = (
  items: Array<{
    description: string;
    productId?: string | null;
    etaItemCode?: string;
    etaCodeType?: 'GS1' | 'EGS';
    unitType?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
  }>,
): CalculatedTotals => {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const lines: CalculatedLine[] = items.map((it) => {
    const quantity = Number(it.quantity);
    const unitPrice = Number(it.unitPrice);
    const discount = Number(it.discount ?? 0);
    const taxRate = Number(it.taxRate ?? 14);

    const gross = round(quantity * unitPrice);
    const net = round(gross - discount);
    const taxAmount = round((net * taxRate) / 100);
    const lineTotal = round(net + taxAmount);

    subtotal = round(subtotal + gross);
    totalDiscount = round(totalDiscount + discount);
    totalTax = round(totalTax + taxAmount);

    return {
      description: it.description,
      productId: it.productId ?? null,
      etaItemCode: it.etaItemCode,
      etaCodeType: it.etaCodeType ?? 'GS1',
      unitType: it.unitType ?? 'EA',
      quantity,
      unitPrice,
      discount,
      taxRate,
      taxAmount,
      lineTotal,
    };
  });

  const total = round(subtotal - totalDiscount + totalTax);
  return { subtotal, totalDiscount, totalTax, total, lines };
};

export const buildInvoiceItemEntities = (
  invoiceId: string,
  totals: CalculatedTotals,
): Partial<InvoiceItem>[] =>
  totals.lines.map((l) => ({
    invoiceId,
    productId: l.productId ?? undefined,
    description: l.description,
    etaItemCode: l.etaItemCode,
    etaCodeType: l.etaCodeType,
    unitType: l.unitType,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: l.discount,
    taxRate: l.taxRate,
    taxAmount: l.taxAmount,
    lineTotal: l.lineTotal,
  }));
