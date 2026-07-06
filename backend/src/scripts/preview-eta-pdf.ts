import fs from 'fs';
import path from 'path';
import { renderEtaStyleInvoicePdf } from '../modules/invoices/invoice-pdf-eta-layout';
import { Invoice, InvoiceStatus, InvoiceType } from '../modules/invoices/invoice.entity';
import { Company } from '../modules/companies/company.entity';
import { CustomerType } from '../modules/customers/customer.entity';

const company = {
  id: 'cmp-1',
  taxRegistrationNumber: '416030866',
  name: 'براند للتوريدات العمومية',
  defaultCurrency: 'EGP',
  etaEnvironment: 'preprod',
  address: 'المحور المركزي، 6 أكتوبر، الجيزة، EG',
  status: 'active',
} as unknown as Company;

const customer = {
  id: 'cus-1',
  name: 'اوريجن سيستمز ميدل ايست للمقاولات الهندسية',
  type: CustomerType.BUSINESS,
  taxRegistrationNumber: '511255659',
  address: '٢٩٥ ش، الأرضي ١٠',
  city: 'المعادي',
  governorate: 'القاهرة',
  country: 'EG',
};

const items = [
  {
    description: 'Ram 2GB DDR',
    etaItemCode: 'EG-416030866-11',
    unitType: 'EA',
    quantity: 3,
    unitPrice: 165,
    discount: 0,
    taxRate: 14,
    taxAmount: 69.3,
    lineTotal: 495,
    product: { name: 'لوازم ورش ومصانع' },
  },
  {
    description: 'Ram 4GB DDR',
    etaItemCode: 'EG-416030866-11',
    unitType: 'EA',
    quantity: 3,
    unitPrice: 385,
    discount: 0,
    taxRate: 14,
    taxAmount: 161.7,
    lineTotal: 1155,
    product: { name: 'لوازم ورش ومصانع' },
  },
  {
    description: 'Pully timing aluminum GT2 36T',
    etaItemCode: 'EG-416030866-11',
    unitType: 'EA',
    quantity: 4,
    unitPrice: 83,
    discount: 0,
    taxRate: 14,
    taxAmount: 46.48,
    lineTotal: 332,
    product: { name: 'لوازم ورش ومصانع' },
  },
  {
    description: 'EG-416030866-11',
    etaItemCode: 'EG-416030866-11',
    unitType: 'EA',
    quantity: 4,
    unitPrice: 45,
    discount: 0,
    taxRate: 14,
    taxAmount: 25.2,
    lineTotal: 180,
    product: { name: 'لوازم ورش ومصانع' },
  },
];

const invoice = {
  id: 'inv-1',
  invoiceNumber: '1295',
  type: InvoiceType.INVOICE,
  status: InvoiceStatus.ACCEPTED,
  issueDate: '2026-05-03',
  currency: 'EGP',
  subtotal: 2162,
  totalDiscount: 0,
  totalTax: 302.68,
  total: 2464.68,
  etaUuid: 'ZD4SR3GC2WFM5NANXQEC0QQK10',
  etaLongId: undefined,
  etaSubmittedAt: new Date('2026-05-03T13:27:58Z'),
  customer,
  items,
} as unknown as Invoice;

async function main() {
  const buf = await renderEtaStyleInvoicePdf(invoice, company);
  const out = path.resolve(__dirname, '../../../preview-eta-pdf.pdf');
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
