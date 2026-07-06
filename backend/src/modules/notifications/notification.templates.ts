import type { WhatsappTemplate } from './whatsapp-message.entity';

/**
 * Default per-template message bodies. Variables in `{braces}` are
 * interpolated by `formatTemplate` below. Tenants can override any body
 * via `NotificationSettings.templates`.
 */
export const DEFAULT_TEMPLATES: Record<WhatsappTemplate | string, string> = {
  invoice_sent:
    'مرحبًا {customer}، تم إصدار الفاتورة رقم {number} بمبلغ {amount} {currency}.' +
    ' يمكنك مراجعتها هنا: {link}',
  payment_reminder:
    'تذكير لطيف بمستحقات الفاتورة {number} بمبلغ {amount} {currency} والمستحقة في {due}.',
  overdue:
    'الفاتورة {number} بمبلغ {amount} {currency} تجاوزت تاريخ الاستحقاق ({due}). يرجى السداد في أقرب وقت.',
  payment_received:
    'تم استلام دفعتك بمبلغ {amount} {currency} على الفاتورة {number}. شكرًا لتعاملك معنا!',
  payment_link:
    'يمكنك سداد الفاتورة {number} ({amount} {currency}) مباشرة عبر هذا الرابط الآمن: {link}',
};

export const formatTemplate = (
  template: string,
  vars: Record<string, string | number | undefined>,
  override?: string | null,
): string => {
  const tpl = override ?? DEFAULT_TEMPLATES[template] ?? '';
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? `{${key}}` : String(v);
  });
};
