import PDFDocument from 'pdfkit';
import { vatService } from './vat.service';
import { AppDataSource } from '../../database/data-source';
import { Company } from '../companies/company.entity';

const fmt = (n: number) =>
  Number(n).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const vatPdfService = {
  async render(companyId: string, year: number, month: number): Promise<Buffer> {
    const company = await AppDataSource.getRepository(Company).findOneOrFail({
      where: { id: companyId },
    });
    const { return: vatReturn, purchases, summary } = await vatService.getReturn(
      companyId,
      year,
      month,
    );

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text(company.name);
      doc.fontSize(10).text(`الرقم الضريبي: ${company.taxRegistrationNumber ?? '—'}`);
      doc.moveDown();
      doc.fontSize(16).text(`إقرار ضريبة القيمة المضافة — ${month}/${year}`);
      doc.fontSize(10).text(`الحالة: ${vatReturn.status}`);
      doc.moveDown();

      doc.fontSize(12).text('ملخص الإقرار');
      doc.fontSize(10);
      doc.text(`ض.ق.م المبيعات: ${fmt(summary.outputVat)} جنيه`);
      doc.text(`ض.ق.م المشتريات: ${fmt(summary.inputVat)} جنيه`);
      doc.text(`صافي المستحق: ${fmt(summary.netVat)} جنيه`);
      doc.moveDown();

      doc.fontSize(12).text('المشتريات اليدوية');
      purchases.slice(0, 30).forEach((p, i) => {
        doc
          .fontSize(9)
          .text(
            `${i + 1}. ${p.supplierName} — ض.ق.م ${fmt(Number(p.vatAmount))} — ${p.invoiceDate ?? ''}`,
          );
      });

      doc.end();
    });
  },
};
