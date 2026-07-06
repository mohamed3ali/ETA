export type InvoiceStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export { STATUS_BADGE, useStatusLabel } from './i18n';
