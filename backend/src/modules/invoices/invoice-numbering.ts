import { EntityManager } from 'typeorm';
import { Invoice, InvoiceType } from './invoice.entity';
import dayjs from 'dayjs';

const PREFIX_BY_TYPE: Record<InvoiceType, string> = {
  [InvoiceType.INVOICE]: 'INV',
  [InvoiceType.CREDIT_NOTE]: 'CN',
  [InvoiceType.DEBIT_NOTE]: 'DN',
  [InvoiceType.RECEIPT]: 'RCT',
};

/**
 * Generates the next per-company document number of the form PREFIX-YYYYMM-#####.
 *   - Invoices  → INV-YYYYMM-#####
 *   - Receipts  → RCT-YYYYMM-#####
 *   - Credit n. → CN-YYYYMM-#####
 *   - Debit n.  → DN-YYYYMM-#####
 *
 * Uses a SELECT … FOR UPDATE inside the transaction to be safe under concurrency.
 * The sequence is *separate per document type*, so receipts and invoices each
 * have their own monthly counter — matching how Egyptian accountants book them.
 */
export const generateInvoiceNumber = async (
  manager: EntityManager,
  companyId: string,
  issueDate: string,
  type: InvoiceType = InvoiceType.INVOICE,
): Promise<string> => {
  const month = dayjs(issueDate).format('YYYYMM');
  const prefixBase = PREFIX_BY_TYPE[type] ?? 'INV';
  const prefix = `${prefixBase}-${month}-`;

  const last = await manager
    .getRepository(Invoice)
    .createQueryBuilder('i')
    .setLock('pessimistic_write')
    .where('i.companyId = :companyId', { companyId })
    .andWhere('i.type = :type', { type })
    .andWhere('i.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
    .orderBy('i.invoiceNumber', 'DESC')
    .getOne();

  let nextSeq = 1;
  if (last) {
    const tail = last.invoiceNumber.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }
  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
};
