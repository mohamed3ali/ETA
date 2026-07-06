import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import bidiFactory from 'bidi-js';
import { shapeArabicText } from 'naqqash';

const font = fs.readFileSync(
  path.resolve(path.dirname(require.resolve('naqqash')), '../fonts/Amiri-Regular.ttf'),
);
const bidi = bidiFactory();
const LRM = '\u200E';
const HAS_ARABIC = (t: string) => /[\u0621-\u064A]/.test(t);
const HAS_AR_DIGITS = (t: string) => /[\u0660-\u0669]/.test(t);

const samples = [
  'فاتورة',
  'الحالة : صحيح',
  'تاريخ التقديم',
  'PM ٠٤:٢٧:٥٨ ٢٠٢٦/٠٥/٠٣ ( PM UTC ٠١:٢٧:٥٨ ٢٠٢٦/٠٥/٠٣ )',
  'للمزيد من المعلومات، فضلًا',
  '٢,١٦٢,٠٠',
];

function toVisual(text: string): string {
  const shaped = HAS_ARABIC(text) ? shapeArabicText(text) : text;
  const levels = bidi.getEmbeddingLevels(shaped, 'rtl');
  return bidi.getReorderedString(shaped, levels);
}

function prep(name: string, fn: (t: string) => string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const out = path.resolve(process.cwd(), `compare-${name}.pdf`);
    const stream = fs.createWriteStream(out);
    doc.pipe(stream);
    doc.registerFont('Ar', font);
    doc.font('Ar').fontSize(12);
    doc.text(`Method: ${name}`, 40, 30);
    let y = 55;
    for (const s of samples) {
      doc.text(fn(s), 40, y, { width: 520, align: 'right' });
      y += 22;
    }
    doc.end();
    stream.on('finish', () => {
      console.log('Wrote', out);
      resolve();
    });
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

async function main() {
  await prep('shaped', shapeArabicText);
  await prep('bidi', toVisual);
  await prep('bidi-lrm', (t) => LRM + toVisual(t));
  await prep('smart', (t) => {
    if (!HAS_ARABIC(t) && !HAS_AR_DIGITS(t)) return t;
    return LRM + toVisual(t);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
