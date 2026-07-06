import PDFDocument from 'pdfkit';
import { form41Service } from './form41.service';
import { WITHHOLDING_RATES } from './tax.utils';
import { AppDataSource } from '../../database/data-source';
import { Company } from '../companies/company.entity';

const fmt = (n: number) =>
  Number(n).toLocaleString('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pct = (rate: number) => `${(rate * 100).toFixed(2)}%`;

export const form41PdfService = {
  async render(companyId: string, year: number, quarter: string): Promise<Buffer> {
    const company = await AppDataSource.getRepository(Company).findOneOrFail({
      where: { id: companyId },
    });
    const { form41, entries, summary } = await form41Service.getForm(
      companyId,
      year,
      quarter,
    );

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).fillColor('#0f172a').text(company.name);
      doc.fontSize(10).fillColor('#64748b').text(`Tax Reg: ${company.taxRegistrationNumber}`);
      doc.moveDown(0.5);
      doc.fontSize(16).fillColor('#0f172a').text(`Form 41 — Withholding Tax`);
      doc.fontSize(11).fillColor('#64748b').text(`Period: ${quarter} / ${year}`);
      doc.fontSize(10).text(`Status: ${form41.status}`);
      if (form41.filedAt) {
        doc.text(`Filed at: ${form41.filedAt.toISOString().slice(0, 10)}`);
      }
      doc.moveDown(0.8);

      doc.fontSize(12).fillColor('#0f172a').text('Summary');
      doc.fontSize(10).fillColor('#334155');
      doc.text(`Total gross paid:     ${fmt(summary.totalGross)} EGP`);
      doc.text(`Total withheld tax:   ${fmt(summary.totalWithheld)} EGP`);
      doc.text(`Entries:              ${summary.entriesCount}`);
      doc.moveDown(0.8);

      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.5);

      // Entries table header
      const cols = [
        { x: 40, w: 25, label: '#', align: 'left' as const },
        { x: 65, w: 150, label: 'Payee', align: 'left' as const },
        { x: 215, w: 90, label: 'National/Tax ID', align: 'left' as const },
        { x: 305, w: 90, label: 'Payment type', align: 'left' as const },
        { x: 395, w: 60, label: 'Gross', align: 'right' as const },
        { x: 455, w: 45, label: 'Rate', align: 'right' as const },
        { x: 500, w: 55, label: 'Withheld', align: 'right' as const },
      ];

      doc.fontSize(10).fillColor('#0f172a');
      const headerY = doc.y;
      cols.forEach((c) =>
        doc.text(c.label, c.x, headerY, { width: c.w, align: c.align }),
      );
      doc
        .moveTo(40, headerY + 14)
        .lineTo(555, headerY + 14)
        .strokeColor('#e2e8f0')
        .stroke();

      let y = headerY + 20;
      doc.fillColor('#334155').fontSize(9);
      entries.forEach((e, i) => {
        if (y > 770) {
          doc.addPage();
          y = 60;
        }
        doc.text(String(i + 1), cols[0].x, y, { width: cols[0].w });
        doc.text(e.payeeName, cols[1].x, y, { width: cols[1].w });
        doc.text(e.payeeId ?? '—', cols[2].x, y, { width: cols[2].w });
        doc.text(
          WITHHOLDING_RATES[e.paymentType]?.labelAr ?? e.paymentType,
          cols[3].x,
          y,
          { width: cols[3].w },
        );
        doc.text(fmt(Number(e.grossAmount)), cols[4].x, y, {
          width: cols[4].w,
          align: 'right',
        });
        doc.text(pct(Number(e.withholdingRate)), cols[5].x, y, {
          width: cols[5].w,
          align: 'right',
        });
        doc.text(fmt(Number(e.withheldAmount)), cols[6].x, y, {
          width: cols[6].w,
          align: 'right',
        });
        y += 16;
      });

      doc.moveTo(40, y + 2).lineTo(555, y + 2).strokeColor('#e2e8f0').stroke();
      y += 10;

      doc.fontSize(11).fillColor('#0f172a');
      doc.text('Total withheld', 305, y, { width: 150, align: 'right' });
      doc.fontSize(12).text(`${fmt(summary.totalWithheld)} EGP`, 455, y, {
        width: 100,
        align: 'right',
      });

      doc.end();
    });
  },
};
