export const QUEUE_NAMES = {
  INVOICE_SUBMIT: 'invoice-submit',
  INVOICE_SYNC: 'invoice-sync',
  PDF_GENERATE: 'pdf-generate',
  EXCEL_EXPORT: 'excel-export',
  WHATSAPP_SEND: 'whatsapp-send',
  RECURRING_TICK: 'recurring-tick',
  REMINDERS_TICK: 'reminders-tick',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
