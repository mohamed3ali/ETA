'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useT } from '@/lib/i18n';

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'card',
  'cheque',
  'wallet',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface PayableInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  amountPaid: number;
  currency: string;
  customer?: { id: string; name: string };
}

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lock the dialog to a specific invoice (used from the invoice detail page). */
  lockedInvoice?: {
    id: string;
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    currency: string;
  };
  /** Called after a payment is successfully recorded. */
  onRecorded?: () => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  lockedInvoice,
  onRecorded,
}: RecordPaymentDialogProps) {
  const t = useT();
  const qc = useQueryClient();

  const [invoiceId, setInvoiceId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('EGP');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidAt, setPaidAt] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const payableInvoices = useQuery({
    enabled: open && !lockedInvoice,
    queryKey: ['payable-invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices', { params: { limit: 200 } });
      return (res.data.items as PayableInvoice[]).filter(
        (inv) =>
          inv.status !== 'draft' &&
          inv.status !== 'paid' &&
          inv.status !== 'cancelled' &&
          Number(inv.amountPaid) < Number(inv.total),
      );
    },
  });

  const pickedInvoice = useMemo<PayableInvoice | undefined>(() => {
    if (lockedInvoice) {
      return {
        id: lockedInvoice.id,
        invoiceNumber: lockedInvoice.invoiceNumber,
        status: '',
        total: lockedInvoice.total,
        amountPaid: lockedInvoice.amountPaid,
        currency: lockedInvoice.currency,
      };
    }
    return payableInvoices.data?.find((i) => i.id === invoiceId);
  }, [lockedInvoice, invoiceId, payableInvoices.data]);

  useEffect(() => {
    if (!open) return;
    if (lockedInvoice) {
      setInvoiceId(lockedInvoice.id);
      setCurrency(lockedInvoice.currency || 'EGP');
      const outstanding = Math.max(0, lockedInvoice.total - lockedInvoice.amountPaid);
      setAmount(outstanding.toFixed(2));
    } else {
      setInvoiceId('');
      setCurrency('EGP');
      setAmount('');
    }
    setMethod('cash');
    setPaidAt(dayjs().format('YYYY-MM-DD'));
    setReference('');
    setNotes('');
  }, [open, lockedInvoice]);

  useEffect(() => {
    if (lockedInvoice) return;
    const inv = pickedInvoice;
    if (!inv) return;
    setCurrency(inv.currency || 'EGP');
    const outstanding = Math.max(0, Number(inv.total) - Number(inv.amountPaid));
    setAmount(outstanding.toFixed(2));
  }, [invoiceId, pickedInvoice, lockedInvoice]);

  const save = useMutation({
    mutationFn: async () =>
      (
        await api.post('/payments', {
          invoiceId,
          amount: Number(amount),
          currency,
          method,
          paidAt,
          reference: reference || undefined,
          notes: notes || undefined,
        })
      ).data,
    onSuccess: () => {
      toast.success(t('payments.recorded'));
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['payments-summary'] });
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      onRecorded?.();
      onOpenChange(false);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('payments.failed')),
  });

  const outstanding = pickedInvoice
    ? Math.max(0, Number(pickedInvoice.total) - Number(pickedInvoice.amountPaid))
    : 0;
  const overAmount = pickedInvoice && Number(amount) > outstanding + 0.01;
  const canSubmit = invoiceId && Number(amount) > 0 && paidAt && !save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('payments.recordTitle')}</DialogTitle>
          <DialogDescription>{t('payments.recordDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>{t('payments.invoice')}</Label>
            {lockedInvoice ? (
              <Input value={lockedInvoice.invoiceNumber} disabled />
            ) : (
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('payments.invoicePh')} />
                </SelectTrigger>
                <SelectContent>
                  {payableInvoices.data?.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoiceNumber}
                      {inv.customer?.name ? ` — ${inv.customer.name}` : ''}
                    </SelectItem>
                  ))}
                  {payableInvoices.data?.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {t('payments.noPayable')}
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
            {pickedInvoice && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('payments.outstanding')}:{' '}
                <span className="font-medium">
                  {new Intl.NumberFormat('en-EG', {
                    style: 'currency',
                    currency: pickedInvoice.currency || 'EGP',
                  }).format(outstanding)}
                </span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('payments.amount')}</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {overAmount && (
                <p className="mt-1 text-xs text-amber-600">{t('payments.overWarning')}</p>
              )}
            </div>
            <div>
              <Label>{t('payments.currency')}</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
            <div>
              <Label>{t('payments.method')}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`payments.method.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('payments.paidAt')}</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{t('payments.reference')}</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('payments.referencePh')}
            />
          </div>

          <div>
            <Label>{t('payments.notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSubmit}>
            {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('payments.record')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
