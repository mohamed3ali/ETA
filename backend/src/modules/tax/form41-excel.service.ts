import ExcelJS from 'exceljs';
import { form41Service } from './form41.service';
import { WITHHOLDING_RATES } from './tax.utils';

export const form41ExcelService = {
  async exportForm(companyId: string, year: number, quarter: string): Promise<Buffer> {
    const { form41, entries, summary } = await form41Service.getForm(companyId, year, quarter);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ETA SaaS';
    const sheet = wb.addWorksheet('نموذج 41', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'اسم المستفيد', key: 'payeeName', width: 28 },
      { header: 'الرقم القومي / الضريبي', key: 'payeeId', width: 20 },
      { header: 'نوع الدفعة', key: 'paymentType', width: 22 },
      { header: 'تاريخ الدفع', key: 'paymentDate', width: 14 },
      { header: 'المبلغ الإجمالي', key: 'grossAmount', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'نسبة الخصم', key: 'withholdingRate', width: 12 },
      { header: 'المبلغ المخصوم', key: 'withheldAmount', width: 16, style: { numFmt: '#,##0.00' } },
    ];
    sheet.getRow(1).font = { bold: true };

    entries.forEach((e) =>
      sheet.addRow({
        payeeName: e.payeeName,
        payeeId: e.payeeId ?? '',
        paymentType: WITHHOLDING_RATES[e.paymentType]?.labelAr ?? e.paymentType,
        paymentDate: e.paymentDate ?? '',
        grossAmount: Number(e.grossAmount),
        withholdingRate: Number(e.withholdingRate),
        withheldAmount: Number(e.withheldAmount),
      }),
    );

    const summarySheet = wb.addWorksheet('ملخص', { views: [{ rightToLeft: true }] });
    summarySheet.addRow(['الفترة', `${quarter} / ${year}`]);
    summarySheet.addRow(['إجمالي المبالغ', summary.totalGross]);
    summarySheet.addRow(['إجمالي المخصوم', summary.totalWithheld]);
    summarySheet.addRow(['عدد البنود', summary.entriesCount]);
    summarySheet.addRow(['الحالة', form41.status]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  },
};
