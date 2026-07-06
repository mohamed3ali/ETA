import ExcelJS from 'exceljs';
import { vatService } from './vat.service';

export const vatExcelService = {
  async exportReturn(companyId: string, year: number, month: number): Promise<Buffer> {
    const { return: vatReturn, purchases } = await vatService.getReturn(companyId, year, month);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ETA SaaS';
    const sheet = wb.addWorksheet('إقرار ض.ق.م', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });

    sheet.columns = [
      { header: 'اسم المورد', key: 'supplierName', width: 28 },
      { header: 'الرقم الضريبي', key: 'supplierTaxId', width: 18 },
      { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 16 },
      { header: 'تاريخ الفاتورة', key: 'invoiceDate', width: 14 },
      { header: 'صافي المبلغ', key: 'netAmount', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'ض.ق.م المشتريات', key: 'vatAmount', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'الإجمالي', key: 'grossAmount', width: 14, style: { numFmt: '#,##0.00' } },
    ];
    sheet.getRow(1).font = { bold: true };

    purchases.forEach((p) =>
      sheet.addRow({
        supplierName: p.supplierName,
        supplierTaxId: p.supplierTaxId ?? '',
        invoiceNumber: p.invoiceNumber ?? '',
        invoiceDate: p.invoiceDate ?? '',
        netAmount: Number(p.netAmount),
        vatAmount: Number(p.vatAmount),
        grossAmount: Number(p.grossAmount),
      }),
    );

    const summary = wb.addWorksheet('ملخص', { views: [{ rightToLeft: true }] });
    summary.addRow(['الفترة', `${month}/${year}`]);
    summary.addRow(['ض.ق.م المبيعات (مخرجات)', Number(vatReturn.outputVat)]);
    summary.addRow(['ض.ق.م المشتريات (مدخلات)', Number(vatReturn.inputVat)]);
    summary.addRow(['صافي المستحق', Number(vatReturn.netVat)]);
    summary.addRow(['إجمالي المبيعات', Number(vatReturn.salesTotal)]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  },
};
