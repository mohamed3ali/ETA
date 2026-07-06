import ExcelJS from 'exceljs';
import { AppDataSource } from '../../database/data-source';
import { Invoice, InvoiceStatus } from './invoice.entity';
import { ListInvoiceQuery } from './invoice.dto';
import { Brackets } from 'typeorm';

const STATUS_AR: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: 'مسودة',
  [InvoiceStatus.SUBMITTED]: 'مُرسلة',
  [InvoiceStatus.ACCEPTED]: 'مقبولة',
  [InvoiceStatus.REJECTED]: 'مرفوضة',
  [InvoiceStatus.PAID]: 'مدفوعة',
  [InvoiceStatus.OVERDUE]: 'متأخرة',
  [InvoiceStatus.CANCELLED]: 'ملغاة',
};

export const invoiceExcelService = {
  async exportFiltered(companyId: string, q: ListInvoiceQuery): Promise<Buffer> {
    const qb = AppDataSource.getRepository(Invoice)
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.customer', 'customer')
      .leftJoinAndSelect('i.branch', 'branch')
      .where('i.companyId = :companyId', { companyId });

    if (q.status) qb.andWhere('i.status = :status', { status: q.status });
    if (q.type) qb.andWhere('i.type = :type', { type: q.type });
    if (q.customerId) qb.andWhere('i.customerId = :customerId', { customerId: q.customerId });
    if (q.branchId) qb.andWhere('i.branchId = :branchId', { branchId: q.branchId });
    if (q.from) qb.andWhere('i.issueDate >= :from', { from: q.from });
    if (q.to) qb.andWhere('i.issueDate <= :to', { to: q.to });
    if (q.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('i.invoiceNumber LIKE :s', { s: `%${q.search}%` })
            .orWhere('i.etaUuid LIKE :s', { s: `%${q.search}%` })
            .orWhere('customer.name LIKE :s', { s: `%${q.search}%` });
        }),
      );
    }
    qb.orderBy('i.issueDate', 'DESC').limit(10000);

    const invoices = await qb.getMany();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ETA SaaS';
    wb.created = new Date();

    const sheet = wb.addWorksheet('الفواتير', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = [
      { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 22 },
      { header: 'تاريخ الإصدار', key: 'issueDate', width: 12 },
      { header: 'تاريخ الاستحقاق', key: 'dueDate', width: 12 },
      { header: 'العميل', key: 'customer', width: 28 },
      { header: 'الرقم الضريبي', key: 'taxReg', width: 18 },
      { header: 'الفرع', key: 'branch', width: 18 },
      { header: 'الحالة', key: 'status', width: 14 },
      { header: 'المجموع الفرعي', key: 'subtotal', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'الخصم', key: 'discount', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'ضريبة القيمة المضافة', key: 'vat', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'الإجمالي', key: 'total', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'العملة', key: 'currency', width: 10 },
      { header: 'UUID المصلحة', key: 'etaUuid', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    };

    invoices.forEach((inv) =>
      sheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate ?? '',
        customer: inv.customer?.name ?? '',
        taxReg: inv.customer?.taxRegistrationNumber ?? '',
        branch: inv.branch?.name ?? '',
        status: STATUS_AR[inv.status] ?? inv.status,
        subtotal: Number(inv.subtotal),
        discount: Number(inv.totalDiscount),
        vat: Number(inv.totalTax),
        total: Number(inv.total),
        currency: inv.currency,
        etaUuid: inv.etaUuid ?? '',
      }),
    );

    // Totals row
    const lastRow = sheet.rowCount + 1;
    sheet.getCell(`G${lastRow}`).value = 'الإجمالي';
    sheet.getCell(`G${lastRow}`).font = { bold: true };
    ['H', 'I', 'J', 'K'].forEach((col) => {
      sheet.getCell(`${col}${lastRow}`).value = {
        formula: `SUM(${col}2:${col}${lastRow - 1})`,
      } as any;
      sheet.getCell(`${col}${lastRow}`).font = { bold: true };
      sheet.getCell(`${col}${lastRow}`).numFmt = '#,##0.00';
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  },
};
