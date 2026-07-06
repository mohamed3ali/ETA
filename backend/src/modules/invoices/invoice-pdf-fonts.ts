import fs from 'fs';
import path from 'path';
import type PDFDocument from 'pdfkit';

/** Resolve once at module load — avoids brittle __dirname-relative paths. */
const AMIRI_FILE = path.resolve(
  path.dirname(require.resolve('naqqash')),
  '../fonts/Amiri-Regular.ttf',
);

let cachedFont: Buffer | undefined;

const loadArabicFont = (): Buffer => {
  if (!cachedFont) {
    cachedFont = fs.readFileSync(AMIRI_FILE);
  }
  return cachedFont;
};

export const registerInvoicePdfFonts = (doc: InstanceType<typeof PDFDocument>): void => {
  const font = loadArabicFont();
  doc.registerFont('Cairo', font);
  doc.registerFont('Cairo-Bold', font);
  doc.registerFont('Arabic', font);
  doc.registerFont('Arabic-Bold', font);
};
