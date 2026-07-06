import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { shapeArabicText } from 'naqqash';
import { Invoice, InvoiceStatus, InvoiceType } from './invoice.entity';
import { Company } from '../companies/company.entity';
import { CustomerType } from '../customers/customer.entity';
import { buildEtaQrPayload } from '../eta/eta-verification-url';
import { registerInvoicePdfFonts } from './invoice-pdf-fonts';

/* -------------------------------------------------------------------------- */
/* Geometry                                                                   */
/* -------------------------------------------------------------------------- */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 28;
const W = PAGE_W - M * 2;
const PAGE_BOTTOM = PAGE_H - M;

/* -------------------------------------------------------------------------- */
/* Colours                                                                    */
/* -------------------------------------------------------------------------- */

const C = {
  text: '#111827',
  muted: '#6b7280',
  sectionBar: '#4b5563',
  sectionBarText: '#ffffff',
  tableHeader: '#e5e7eb',
  rowAlt: '#f9fafb',
  border: '#cbd5e1',
  borderStrong: '#9ca3af',
  watermark: '#e2e8f0',
  totalHighlight: '#f3f4f6',
} as const;

/* -------------------------------------------------------------------------- */
/* Localisation helpers                                                       */
/* -------------------------------------------------------------------------- */

const HAS_ARABIC_LETTERS = /[\u0621-\u064A\u0671-\u06D5\u0750-\u077F\u08A0-\u08FF]/;
const HAS_AR_DIGITS = /[\u0660-\u0669]/;
/** Left-to-right isolate for Western numbers/dates embedded in Arabic strings. */
const LRI = '\u2066';
const PDI = '\u2069';
const ltr = (s: string): string => `${LRI}${s}${PDI}`;

/**
 * Apply Arabic joining forms only. PDF viewers run the Unicode bidi algorithm
 * on the shaped logical-order string — do not pre-reorder (that double-flips text).
 */
const ar = (text: string): string =>
  HAS_ARABIC_LETTERS.test(text) ? shapeArabicText(text) : text;

/** Format a number as "2,162.00" — Western digits for reliable PDF rendering. */
const fmtNum = (n: number | string): string => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** Format a YYYY-MM-DD date as "2026/05/03". */
const fmtDate = (iso: string | Date | undefined | null): string => {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

/** Format a Date as "PM 04:27:58 2026/05/03 ( PM UTC 01:27:58 2026/05/03 )". */
const fmtDateTimeBoth = (d: Date): string => {
  const fmtTime = (date: Date, opts: { utc: boolean }) => {
    const h24 = opts.utc ? date.getUTCHours() : date.getHours();
    const m = opts.utc ? date.getUTCMinutes() : date.getMinutes();
    const s = opts.utc ? date.getUTCSeconds() : date.getSeconds();
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = ((h24 + 11) % 12) + 1;
    const time =
      `${String(h12).padStart(2, '0')}:` +
      `${String(m).padStart(2, '0')}:` +
      `${String(s).padStart(2, '0')}`;
    const yyyy = opts.utc ? date.getUTCFullYear() : date.getFullYear();
    const mm = String((opts.utc ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
    const dd = String(opts.utc ? date.getUTCDate() : date.getDate()).padStart(2, '0');
    return { ampm, time, date: `${yyyy}/${mm}/${dd}` };
  };
  const local = fmtTime(d, { utc: false });
  const utc = fmtTime(d, { utc: true });
  return `${local.ampm} ${local.time} ${local.date} ( ${utc.ampm} UTC ${utc.time} ${utc.date} )`;
};

const fmtIssueDateTime = (iso: string | Date | undefined | null): string => {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return fmtDateTimeBoth(d);
};

/* -------------------------------------------------------------------------- */
/* Static labels                                                              */
/* -------------------------------------------------------------------------- */

const DOC_TYPE_AR: Record<InvoiceType, string> = {
  [InvoiceType.INVOICE]: 'فاتورة',
  [InvoiceType.CREDIT_NOTE]: 'إشعار دائن',
  [InvoiceType.DEBIT_NOTE]: 'إشعار مدين',
  [InvoiceType.RECEIPT]: 'إيصال',
};

const STATUS_AR: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: 'مسودة',
  [InvoiceStatus.SUBMITTED]: 'قيد المراجعة',
  [InvoiceStatus.ACCEPTED]: 'صحيح',
  [InvoiceStatus.REJECTED]: 'مرفوضة',
  [InvoiceStatus.PAID]: 'مدفوعة',
  [InvoiceStatus.OVERDUE]: 'متأخرة',
  [InvoiceStatus.CANCELLED]: 'ملغاة',
};

const RECEIVER_TYPE_AR: Record<CustomerType, string> = {
  [CustomerType.BUSINESS]: 'شركة',
  [CustomerType.PERSON]: 'شخص',
  [CustomerType.FOREIGNER]: 'أجنبي',
};

/* -------------------------------------------------------------------------- */
/* Drawing primitives                                                         */
/* -------------------------------------------------------------------------- */

interface RenderCtx {
  doc: InstanceType<typeof PDFDocument>;
  y: number;
}

const arabicText = (
  ctx: RenderCtx,
  value: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions & { bold?: boolean; size?: number; color?: string } = {},
) => {
  ctx.doc
    .font(opts.bold ? 'Cairo-Bold' : 'Cairo')
    .fontSize(opts.size ?? 9)
    .fillColor(opts.color ?? C.text);
  const { bold, size, color, ...textOpts } = opts;
  void bold;
  void size;
  void color;
  const align = textOpts.align ?? 'right';
  ctx.doc.text(ar(value), x, y, { ...textOpts, align });
};

const latinText = (
  ctx: RenderCtx,
  value: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions & { bold?: boolean; size?: number; color?: string } = {},
) => {
  ctx.doc
    .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.size ?? 9)
    .fillColor(opts.color ?? C.text);
  const { bold, size, color, ...textOpts } = opts;
  void bold;
  void size;
  void color;
  ctx.doc.text(value, x, y, { align: 'right', ...textOpts });
};

/** Render a mixed-content value: Arabic/Cairo for RTL text & digits, else Helvetica. */
const valueText = (
  ctx: RenderCtx,
  value: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions & { bold?: boolean; size?: number; color?: string } = {},
) => {
  if (HAS_ARABIC_LETTERS.test(value)) {
    arabicText(ctx, value, x, y, opts);
  } else if (HAS_AR_DIGITS.test(value)) {
    arabicText(ctx, value, x, y, opts);
  } else {
    latinText(ctx, value, x, y, opts);
  }
};

const sectionBar = (ctx: RenderCtx, title: string) => {
  const h = 18;
  ctx.doc.rect(M, ctx.y, W, h).fill(C.sectionBar);
  arabicText(ctx, title, M + 10, ctx.y + 4, {
    width: W - 20,
    align: 'right',
    bold: true,
    size: 10,
    color: C.sectionBarText,
  });
  ctx.y += h;
};

const fieldRow = (
  ctx: RenderCtx,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  opts: { labelW?: number; bold?: boolean } = {},
) => {
  const labelWidth = opts.labelW ?? Math.min(120, width * 0.45);
  const colonW = 8;
  arabicText(ctx, label, x + width - labelWidth, y, {
    width: labelWidth,
    align: 'right',
    size: 8.5,
    color: C.muted,
  });
  ctx.doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(C.muted)
    .text(':', x + width - labelWidth - colonW, y + 1, { width: colonW, align: 'right' });
  const valueW = width - labelWidth - colonW - 2;
  if (value) {
    valueText(ctx, value, x, y, {
      width: valueW,
      align: 'right',
      size: 8.5,
      bold: opts.bold,
      color: C.text,
    });
  }
};

const ensureSpace = (ctx: RenderCtx, needed: number) => {
  if (ctx.y + needed > PAGE_BOTTOM) {
    ctx.doc.addPage();
    ctx.y = M;
  }
};

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

const drawHeader = (
  ctx: RenderCtx,
  invoice: Invoice,
  qrBase64: string | undefined,
  generatedAt: Date,
) => {
  const docType = DOC_TYPE_AR[invoice.type] ?? DOC_TYPE_AR[InvoiceType.INVOICE];
  const status = STATUS_AR[invoice.status] ?? STATUS_AR[InvoiceStatus.DRAFT];
  const submissionAt = invoice.etaSubmittedAt ? new Date(invoice.etaSubmittedAt) : null;

  const startY = ctx.y;

  // Right column: title + status + dates
  const rightX = M + 200;
  const rightW = W - 200;

  arabicText(ctx, docType, rightX, startY, {
    width: rightW,
    align: 'right',
    bold: true,
    size: 26,
  });

  let ry = startY + 38;
  fieldRow(ctx, 'الحالة', status, rightX, ry, rightW, { labelW: 60 });
  ry += 14;
  if (submissionAt) {
    fieldRow(ctx, 'تاريخ التقديم', fmtIssueDateTime(submissionAt), rightX, ry, rightW, {
      labelW: 90,
    });
    ry += 14;
  }
  fieldRow(
    ctx,
    'تاريخ الإصدار',
    ltr(fmtIssueDateTime(invoice.issueDate)) + ' القاهرة',
    rightX,
    ry,
    rightW,
    { labelW: 90 },
  );
  ry += 14;

  // Left column: scan instructions + QR
  const leftX = M;
  if (qrBase64) {
    arabicText(ctx, 'للمزيد من المعلومات، فضلًا', leftX, startY + 2, {
      width: 160,
      align: 'right',
      size: 7.5,
      color: C.muted,
    });
    arabicText(ctx, 'قم بمسح هذا الباركود', leftX, startY + 12, {
      width: 160,
      align: 'right',
      size: 7.5,
      color: C.muted,
    });
    ctx.doc.image(Buffer.from(qrBase64, 'base64'), leftX, startY + 28, {
      width: 96,
      height: 96,
    });
  } else {
    arabicText(ctx, 'مستند غير مسجل لدى مصلحة الضرائب', leftX, startY + 12, {
      width: 160,
      align: 'right',
      size: 8,
      color: '#b45309',
      bold: true,
    });
  }

  const headerHeight = Math.max(ry, startY + (qrBase64 ? 128 : 60)) - startY;
  ctx.y = startY + headerHeight + 8;

  // Subtle divider line.
  ctx.doc.moveTo(M, ctx.y).lineTo(M + W, ctx.y).strokeColor(C.border).lineWidth(0.6).stroke();
  ctx.y += 10;

  // Used by footer to mirror the original "تاريخ انشاء الملف".
  void generatedAt;
};

/* -------------------------------------------------------------------------- */
/* Seller / Buyer sections                                                    */
/* -------------------------------------------------------------------------- */

interface PartyField {
  label: string;
  value: string;
  bold?: boolean;
}

const drawPartyBlock = (ctx: RenderCtx, title: string, rightCol: PartyField[], leftCol: PartyField[]) => {
  sectionBar(ctx, title);
  const startY = ctx.y + 8;

  const colGap = 20;
  const colW = (W - colGap) / 2;
  const rightX = M + colW + colGap;
  const leftX = M;

  const rowH = 14;
  const maxRows = Math.max(rightCol.length, leftCol.length);

  rightCol.forEach((f, i) => {
    fieldRow(ctx, f.label, f.value, rightX, startY + i * rowH, colW, { bold: f.bold });
  });
  leftCol.forEach((f, i) => {
    fieldRow(ctx, f.label, f.value, leftX, startY + i * rowH, colW, { bold: f.bold });
  });

  ctx.y = startY + maxRows * rowH + 8;

  // Thin divider under the block.
  ctx.doc.moveTo(M, ctx.y).lineTo(M + W, ctx.y).strokeColor(C.border).lineWidth(0.4).stroke();
  ctx.y += 8;
};

const drawSeller = (ctx: RenderCtx, invoice: Invoice, company: Company) => {
  drawPartyBlock(
    ctx,
    'البائع',
    [
      { label: 'الاسم', value: company.name, bold: true },
      { label: 'رقم التسجيل', value: `#${company.taxRegistrationNumber}`, bold: true },
      { label: 'العنوان', value: company.address ?? '' },
    ],
    [
      { label: 'كود النشاط الضريبي', value: '' },
      { label: 'الرقم الالكتروني', value: invoice.etaUuid ?? '' },
      { label: 'رقم الفاتورة المبدئية للتصدير', value: '' },
      { label: 'مرجع طلب الشراء', value: '' },
      { label: 'مرجع طلب المبيعات', value: '' },
    ],
  );
};

const drawBuyer = (ctx: RenderCtx, invoice: Invoice) => {
  const customer = invoice.customer;
  const receiverId = customer.taxRegistrationNumber || customer.nationalId || '';
  const cityLine = [customer.city, customer.governorate, customer.country]
    .filter(Boolean)
    .join('، ');

  drawPartyBlock(
    ctx,
    'المشتري',
    [
      { label: 'الاسم', value: customer.name, bold: true },
      { label: 'رقم التسجيل', value: receiverId ? `#${receiverId}` : '', bold: true },
      { label: 'العنوان', value: customer.address ?? '' },
      { label: 'المدينة', value: cityLine },
    ],
    [
      { label: 'النوع', value: RECEIVER_TYPE_AR[customer.type] ?? '' },
      { label: 'البريد الإلكتروني', value: customer.email ?? '' },
      { label: 'الهاتف', value: customer.phone ?? '' },
    ],
  );
};

/* -------------------------------------------------------------------------- */
/* Items table                                                                */
/* -------------------------------------------------------------------------- */

interface Col {
  /** RTL position from the right margin (right edge of column). */
  right: number;
  width: number;
  title: string;
}

const buildCols = (): Col[] => {
  // Right-to-left column order matching the ETA original.
  const rightEdge = M + W;
  const widths = [
    { key: 'codeName', w: 90, title: 'اسم الكود' },
    { key: 'itemCode', w: 95, title: 'كود الصنف' },
    { key: 'description', w: 110, title: 'الوصف' },
    { key: 'qtyUnit', w: 60, title: 'الكمية / نوع الوحدة' },
    { key: 'unitPrice', w: 90, title: 'سعر الوحدة (ج.م)' },
    { key: 'lineTotal', w: W - 90 - 95 - 110 - 60 - 90, title: 'قيمة المبيعات (ج.م)' },
  ];

  const cols: Col[] = [];
  let cursor = rightEdge;
  for (const c of widths) {
    cols.push({ right: cursor, width: c.w, title: c.title });
    cursor -= c.w;
  }
  return cols;
};

const drawTableHeader = (ctx: RenderCtx, cols: Col[]) => {
  const h = 28;
  ctx.doc.rect(M, ctx.y, W, h).fill(C.tableHeader);
  ctx.doc.rect(M, ctx.y, W, h).strokeColor(C.borderStrong).lineWidth(0.6).stroke();
  cols.forEach((c) => {
    const x = c.right - c.width;
    arabicText(ctx, c.title, x + 3, ctx.y + 7, {
      width: c.width - 6,
      align: 'center',
      bold: true,
      size: 8,
      color: '#374151',
    });
    // Vertical separator on the left edge of the column.
    if (x > M + 0.5) {
      ctx.doc
        .moveTo(x, ctx.y)
        .lineTo(x, ctx.y + h)
        .strokeColor(C.border)
        .lineWidth(0.4)
        .stroke();
    }
  });
  ctx.y += h;
};

const drawWatermark = (
  ctx: RenderCtx,
  text: string,
  topY: number,
  bottomY: number,
) => {
  const cx = M + W / 2;
  const cy = (topY + bottomY) / 2;
  ctx.doc.save();
  ctx.doc.translate(cx, cy);
  ctx.doc.rotate(-25);
  ctx.doc
    .font('Cairo-Bold')
    .fontSize(110)
    .fillColor(C.watermark)
    .opacity(0.55)
    .text(ar(text), -250, -55, { width: 500, align: 'center', lineBreak: false });
  ctx.doc.opacity(1);
  ctx.doc.restore();
};

const drawItemsTable = (ctx: RenderCtx, invoice: Invoice) => {
  const cols = buildCols();
  const tableTop = ctx.y;
  drawTableHeader(ctx, cols);

  const drawRow = (item: Invoice['items'][number], index: number) => {
    ensureSpace(ctx, 32);
    const rowTop = ctx.y;
    const lineH = 32;

    if (index % 2 === 1) {
      ctx.doc.rect(M, rowTop, W, lineH).fill(C.rowAlt);
    }

    // Vertical column separators on the row.
    cols.forEach((c) => {
      const x = c.right - c.width;
      if (x > M + 0.5) {
        ctx.doc
          .moveTo(x, rowTop)
          .lineTo(x, rowTop + lineH)
          .strokeColor(C.border)
          .lineWidth(0.3)
          .stroke();
      }
    });

    const cells: Record<string, string> = {
      codeName: item.product?.name ?? item.description,
      itemCode: item.etaItemCode ?? '',
      description: item.description,
      qtyUnit: `/ ${fmtNum(Number(item.quantity))}\n${item.unitType}`,
      unitPrice: fmtNum(Number(item.unitPrice)),
      lineTotal: fmtNum(Number(item.lineTotal)),
    };

    cols.forEach((c, idx) => {
      const x = c.right - c.width + 4;
      const w = c.width - 8;
      const align = idx <= 2 ? 'right' : 'center';
      const value = cells[Object.keys(cells)[idx]];
      if (idx === 3) {
        // Qty / Unit – two lines, vertically centred.
        const parts = value.split('\n');
        valueText(ctx, parts[0], x, rowTop + 7, { width: w, align: 'center', size: 8 });
        latinText(ctx, parts[1] ?? '', x, rowTop + 18, {
          width: w,
          align: 'center',
          size: 8,
          color: C.muted,
        });
      } else {
        const vy = rowTop + 11;
        valueText(ctx, value, x, vy, { width: w, align, size: 8.5 });
      }
    });

    ctx.y = rowTop + lineH;
  };

  invoice.items.forEach((item, idx) => drawRow(item, idx));

  // Bottom border of the table.
  const tableBottom = ctx.y;
  ctx.doc
    .rect(M, tableTop, W, tableBottom - tableTop)
    .strokeColor(C.borderStrong)
    .lineWidth(0.6)
    .stroke();

  // Diagonal "صحيح" watermark behind the body of the table, only for valid docs.
  if (invoice.status === InvoiceStatus.ACCEPTED) {
    drawWatermark(ctx, 'صحيح', tableTop + 30, tableBottom);
  }

  ctx.y = tableBottom + 12;
};

/* -------------------------------------------------------------------------- */
/* Totals                                                                     */
/* -------------------------------------------------------------------------- */

const drawTotals = (ctx: RenderCtx, invoice: Invoice) => {
  ensureSpace(ctx, 130);

  const rowH = 18;
  const rows: Array<{ label: string; value: number; bold?: boolean; highlight?: boolean }> = [
    { label: 'إجمالي المبيعات (ج.م)', value: Number(invoice.subtotal) },
    { label: 'إجمالي الخصم (ج.م)', value: Number(invoice.totalDiscount) },
    { label: 'إجمالي خصم الصنف (ج.م)', value: 0 },
    { label: 'ضريبة القيمة المضافة (ج.م)', value: Number(invoice.totalTax) },
    { label: 'خصم الفاتورة الاضافي (ج.م)', value: 0 },
    { label: 'إجمالي المبلغ (ج.م)', value: Number(invoice.total), bold: true, highlight: true },
  ];

  const tableW = W;
  const labelW = 220;
  const valueW = tableW - labelW;
  const x = M;
  const startY = ctx.y;

  rows.forEach((r, i) => {
    const y = startY + i * rowH;
    if (r.highlight) {
      ctx.doc.rect(x, y, tableW, rowH).fill(C.totalHighlight);
    } else if (i % 2 === 0) {
      ctx.doc.rect(x, y, tableW, rowH).fill(C.rowAlt);
    }
    ctx.doc
      .rect(x, y, tableW, rowH)
      .strokeColor(C.border)
      .lineWidth(0.4)
      .stroke();
    // Vertical separator between value and label.
    ctx.doc
      .moveTo(x + valueW, y)
      .lineTo(x + valueW, y + rowH)
      .strokeColor(C.border)
      .lineWidth(0.4)
      .stroke();

    arabicText(ctx, r.label, x + valueW + 6, y + 5, {
      width: labelW - 12,
      align: 'right',
      bold: r.bold,
      size: 9,
    });
    valueText(ctx, fmtNum(r.value), x + 6, y + 5, {
      width: valueW - 12,
      align: 'center',
      bold: r.bold,
      size: 9,
    });
  });

  ctx.y = startY + rows.length * rowH + 10;
};

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

const drawFooter = (
  ctx: RenderCtx,
  invoice: Invoice,
  company: Company,
  generatedAt: Date,
) => {
  ensureSpace(ctx, 70);

  // Internal number — right-aligned.
  arabicText(ctx, `الرقم الداخلي : ${ltr(invoice.invoiceNumber)}`, M, ctx.y, {
    width: W,
    align: 'right',
    size: 9,
    bold: true,
  });
  ctx.y += 22;

  // Two-column footer: left = file creation date, right = signature/brand.
  const halfW = W / 2 - 6;
  arabicText(ctx, `توقيع : ${ltr(company.name)}`, M + halfW + 12, ctx.y, {
    width: halfW,
    align: 'right',
    size: 8.5,
  });
  arabicText(
    ctx,
    `تاريخ انشاء الملف : ${ltr(fmtIssueDateTime(generatedAt))} التوقيت العالمي ${ltr('+02:00')}`,
    M,
    ctx.y,
    {
      width: halfW,
      align: 'right',
      size: 7.5,
      color: C.muted,
    },
  );
  ctx.y += 26;

  // Disclaimer.
  arabicText(
    ctx,
    'تم إنشاء هذه الفاتورة عبر بوابة الفوترة الإلكترونية الخاصة بالهيئة المصرية للضرائب (ETA) وأنت ملزم بالشروط والأحكام الخاصة بهذه البوابة. لا تتحمل الهيئة المصرية للضرائب أي مسؤولية عن دقة المعلومات المعروضة هنا.',
    M,
    ctx.y,
    {
      width: W,
      align: 'right',
      size: 7.5,
      color: C.muted,
    },
  );
};

/* -------------------------------------------------------------------------- */
/* Public renderer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Renders an Arabic, ETA-style A4 invoice that visually mirrors the official
 * printout returned by the ETA portal. Used for drafts and as the local
 * fallback when the official printout API is unavailable.
 */
export const renderEtaStyleInvoicePdf = async (
  invoice: Invoice & { customer: Invoice['customer']; items: Invoice['items'] },
  company: Company,
): Promise<Buffer> => {
  let qrBase64: string | undefined;
  if (invoice.etaUuid) {
    const qrPayload = buildEtaQrPayload({
      etaUuid: invoice.etaUuid,
      etaLongId: invoice.etaLongId,
      etaEnvironment: company.etaEnvironment,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      currency: invoice.currency,
    });
    const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 0, width: 200 });
    qrBase64 = dataUrl.split(',')[1];
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    registerInvoicePdfFonts(doc);

    const ctx: RenderCtx = { doc, y: M };
    const generatedAt = new Date();

    drawHeader(ctx, invoice, qrBase64, generatedAt);
    drawSeller(ctx, invoice, company);
    drawBuyer(ctx, invoice);
    drawItemsTable(ctx, invoice);
    drawTotals(ctx, invoice);
    drawFooter(ctx, invoice, company, generatedAt);

    doc.end();
  });
};
