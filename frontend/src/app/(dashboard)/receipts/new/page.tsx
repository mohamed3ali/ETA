import { redirect } from 'next/navigation';

/**
 * Receipts share the invoice flow under the hood — the only difference is
 * `type=r` which the new-invoice page reads from the query string. Keeping
 * a redirect here makes the URL discoverable and the sidebar nav consistent.
 */
export default function NewReceiptRedirect() {
  redirect('/invoices/new?type=r');
}
