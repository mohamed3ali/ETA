import dayjs from 'dayjs';
import { AppDataSource } from '../../database/data-source';
import { HttpError } from '../../common/errors/HttpError';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { VatReturn } from './vat-return.entity';
import { VatPurchaseManual } from './vat-purchase-manual.entity';
import { TaxFilingStatus } from './tax.utils';
import { seedVatMockIfEmpty } from './tax.seed';

const vatRepo = () => AppDataSource.getRepository(VatReturn);
const purchaseRepo = () => AppDataSource.getRepository(VatPurchaseManual);

async function syncSalesTotals(companyId: string, year: number, month: number) {
  const start = dayjs(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
  const end = dayjs(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');

  const agg = await AppDataSource.getRepository(Invoice)
    .createQueryBuilder('i')
    .select('COALESCE(SUM(i.totalTax), 0)', 'outputVat')
    .addSelect('COALESCE(SUM(i.total), 0)', 'salesTotal')
    .where('i.companyId = :companyId', { companyId })
    .andWhere('i.issueDate BETWEEN :start AND :end', { start, end })
    .andWhere('i.status IN (:...statuses)', {
      statuses: [InvoiceStatus.ACCEPTED, InvoiceStatus.PAID, InvoiceStatus.SUBMITTED],
    })
    .getRawOne<{ outputVat: string; salesTotal: string }>();

  return {
    outputVat: Number(agg?.outputVat ?? 0),
    salesTotal: Number(agg?.salesTotal ?? 0),
  };
}

async function syncInputVat(vatReturnId: string, companyId: string) {
  const agg = await purchaseRepo()
    .createQueryBuilder('p')
    .select('COALESCE(SUM(p.vatAmount), 0)', 'inputVat')
    .where('p.companyId = :companyId', { companyId })
    .andWhere('p.vatReturnId = :vatReturnId', { vatReturnId })
    .getRawOne<{ inputVat: string }>();
  return Number(agg?.inputVat ?? 0);
}

async function getOrCreateReturn(companyId: string, year: number, month: number) {
  let row = await vatRepo().findOne({ where: { companyId, year, month } });
  if (!row) {
    row = await vatRepo().save(vatRepo().create({ companyId, year, month }));
  }
  const sales = await syncSalesTotals(companyId, year, month);
  row.outputVat = sales.outputVat;
  row.salesTotal = sales.salesTotal;
  row.inputVat = await syncInputVat(row.id, companyId);
  row.netVat = Math.max(0, row.outputVat - row.inputVat);
  await vatRepo().save(row);
  await seedVatMockIfEmpty(companyId, row);
  row.inputVat = await syncInputVat(row.id, companyId);
  row.netVat = Math.max(0, row.outputVat - row.inputVat);
  await vatRepo().save(row);
  return row;
}

export const vatService = {
  async getReturn(companyId: string, year: number, month: number) {
    const vatReturn = await getOrCreateReturn(companyId, year, month);
    const purchases = await purchaseRepo().find({
      where: { companyId, vatReturnId: vatReturn.id },
      order: { invoiceDate: 'DESC', createdAt: 'DESC' },
    });
    return {
      return: vatReturn,
      purchases,
      summary: {
        outputVat: Number(vatReturn.outputVat),
        inputVat: Number(vatReturn.inputVat),
        netVat: Number(vatReturn.netVat),
        salesTotal: Number(vatReturn.salesTotal),
        purchasesCount: purchases.length,
      },
    };
  },

  async createPurchase(
    companyId: string,
    body: {
      year: number;
      month: number;
      supplierName: string;
      supplierTaxId?: string;
      invoiceNumber?: string;
      invoiceDate?: string;
      netAmount: number;
      vatAmount: number;
      grossAmount?: number;
      notes?: string;
    },
  ) {
    const vatReturn = await getOrCreateReturn(companyId, body.year, body.month);
    if (vatReturn.status === TaxFilingStatus.FILED) {
      throw HttpError.badRequest('لا يمكن تعديل إقرار تم تقديمه');
    }
    const gross =
      body.grossAmount ?? Math.round((body.netAmount + body.vatAmount) * 100) / 100;
    const purchase = await purchaseRepo().save(
      purchaseRepo().create({
        companyId,
        vatReturnId: vatReturn.id,
        supplierName: body.supplierName,
        supplierTaxId: body.supplierTaxId ?? null,
        invoiceNumber: body.invoiceNumber ?? null,
        invoiceDate: body.invoiceDate ?? null,
        netAmount: body.netAmount,
        vatAmount: body.vatAmount,
        grossAmount: gross,
        notes: body.notes ?? null,
      }),
    );
    await getOrCreateReturn(companyId, body.year, body.month);
    return purchase;
  },

  async updatePurchase(
    companyId: string,
    id: string,
    body: Partial<{
      supplierName: string;
      supplierTaxId?: string;
      invoiceNumber?: string;
      invoiceDate?: string;
      netAmount: number;
      vatAmount: number;
      grossAmount?: number;
      notes?: string;
    }>,
  ) {
    const purchase = await purchaseRepo().findOne({ where: { id, companyId } });
    if (!purchase) throw HttpError.notFound('سجل المشتريات غير موجود');
    const vatReturn = await vatRepo().findOne({
      where: { id: purchase.vatReturnId, companyId },
    });
    if (!vatReturn) throw HttpError.notFound('إقرار ضريبة القيمة المضافة غير موجود');
    if (vatReturn.status === TaxFilingStatus.FILED) {
      throw HttpError.badRequest('لا يمكن تعديل إقرار تم تقديمه');
    }
    Object.assign(purchase, body);
    if (body.netAmount != null || body.vatAmount != null) {
      purchase.grossAmount =
        body.grossAmount ??
        Math.round((Number(purchase.netAmount) + Number(purchase.vatAmount)) * 100) / 100;
    }
    await purchaseRepo().save(purchase);
    await getOrCreateReturn(companyId, vatReturn.year, vatReturn.month);
    return purchase;
  },

  async deletePurchase(companyId: string, id: string) {
    const purchase = await purchaseRepo().findOne({ where: { id, companyId } });
    if (!purchase) throw HttpError.notFound('سجل المشتريات غير موجود');
    const vatReturn = await vatRepo().findOne({
      where: { id: purchase.vatReturnId, companyId },
    });
    if (vatReturn?.status === TaxFilingStatus.FILED) {
      throw HttpError.badRequest('لا يمكن تعديل إقرار تم تقديمه');
    }
    await purchaseRepo().softRemove(purchase);
    if (vatReturn) await getOrCreateReturn(companyId, vatReturn.year, vatReturn.month);
    return { ok: true };
  },

  async updateStatus(
    companyId: string,
    year: number,
    month: number,
    status: TaxFilingStatus,
  ) {
    const row = await getOrCreateReturn(companyId, year, month);
    row.status = status;
    if (status === TaxFilingStatus.FILED) row.filedAt = new Date();
    return vatRepo().save(row);
  },

  async markFiled(companyId: string, year: number, month: number) {
    return this.updateStatus(companyId, year, month, TaxFilingStatus.FILED);
  },
};
