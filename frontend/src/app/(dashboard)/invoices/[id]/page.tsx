'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  Download,
  Send,
  RefreshCw,
  CheckCircle2,
  ArrowLeft,
  Trash2,
  Repeat,
  MessageCircle,
  Link as LinkIcon,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useFormatters, useStatusLabel, useT, STATUS_BADGE } from '@/lib/i18n';
import type { InvoiceStatus } from '@/lib/status';
import { RecordPaymentDialog } from '@/components/payments/record-payment-dialog';
import {
  requestAgentSignature,
  useEtaAgent,
  ETA_AGENT_DOWNLOAD_URL,
  type EtaAgentSignature,
} from '@/lib/eta-agent';
import { cn } from '@/lib/utils';

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  status: InvoiceStatus;
  total: number;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  amountPaid: number;
  currency: string;
  etaUuid?: string;
  etaSubmissionId?: string;
  etaErrors?: string;
  notes?: string;
  customer?: { id: string; name: string; phone?: string; taxRegistrationNumber?: string };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
    taxAmount: number;
    lineTotal: number;
  }>;
}

interface WhatsappMessage {
  id: string;
  template: string;
  toPhone: string;
  status: string;
  body?: string | null;
  errorMessage?: string | null;
  mock: boolean;
  createdAt: string;
  sentAt?: string | null;
}

interface PaymentLink {
  id: string;
  token: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  provider: string;
  checkoutUrl?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: string;
  reference?: string;
  notes?: string;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const { formatCurrency, formatDate } = useFormatters();
  const statusLabel = useStatusLabel();

  const query = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () =>
      (await api.get<{ data: InvoiceDetail }>(`/invoices/${id}`)).data.data,
  });
  const messages = useQuery({
    queryKey: ['invoice-whatsapp', id],
    queryFn: async () =>
      (
        await api.get<{ data: WhatsappMessage[] }>(
          `/notifications/whatsapp/by-invoice/${id}`,
        )
      ).data.data,
    enabled: !!id,
  });
  const links = useQuery({
    queryKey: ['invoice-payment-links', id],
    queryFn: async () =>
      (
        await api.get<{ data: PaymentLink[] }>(`/payment-links/by-invoice/${id}`)
      ).data.data,
    enabled: !!id,
  });
  const payments = useQuery({
    queryKey: ['invoice-payments', id],
    queryFn: async () =>
      (await api.get<{ data: PaymentRow[] }>(`/payments/by-invoice/${id}`)).data.data,
    enabled: !!id,
  });

  const inv = query.data;
  const agent = useEtaAgent();

  /**
   * Submit via the legacy queued path. Used as a fallback when the Desktop
   * Agent is not running — convenient for local development against the
   * backend's mock mode where no real eSeal is needed.
   */
  const submit = useMutation({
    mutationFn: async () => (await api.post(`/invoices/${id}/submit`)).data,
    onSuccess: () => {
      toast.success(t('invoice.submitted'));
      qc.invalidateQueries({ queryKey: ['invoice', id] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? t('invoice.failed')),
  });

  /**
   * Three-step signed submission:
   *   1. fetch the canonical ETA payload from the API
   *   2. send it to the Desktop Agent for CAdES-BES signing
   *   3. post the signatures back to the API for real ETA submission
   */
  const signAndSubmit = useMutation({
    mutationFn: async () => {
      type PayloadResp = {
        data: {
          document: Record<string, unknown>;
          canonical: string;
          hashHex: string;
          issuer: { rin: string; name: string };
        };
      };
      const payload = (await api.get<PayloadResp>(`/invoices/${id}/eta-payload`))
        .data.data;

      toast.info(t('agent.signing'));
      const signed = await requestAgentSignature({
        document: payload.document,
        canonical: payload.canonical,
        hashHex: payload.hashHex,
        issuerRin: payload.issuer.rin,
      });

      toast.info(t('agent.signedSubmitting'));
      const signatures: EtaAgentSignature[] = signed.signatures;
      return (
        await api.post(`/invoices/${id}/submit-signed`, { signatures })
      ).data;
    },
    onSuccess: () => {
      toast.success(t('invoice.submitted'));
      qc.invalidateQueries({ queryKey: ['invoice', id] });
    },
    onError: (err: any) => {
      const apiMessage = err?.response?.data?.error?.message;
      toast.error(apiMessage ?? err?.message ?? t('agent.signFailed'));
    },
  });

  const submitting = submit.isPending || signAndSubmit.isPending;
  const onSubmitClick = () => {
    if (agent.available && agent.tokenConnected) signAndSubmit.mutate();
    else submit.mutate();
  };

  const retry = useMutation({
    mutationFn: async () => (await api.post(`/eta/retry/${id}`)).data,
    onSuccess: () => {
      toast.success(t('invoice.requeued'));
      qc.invalidateQueries({ queryKey: ['invoice', id] });
    },
  });

  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);

  const del = useMutation({
    mutationFn: async () => (await api.delete(`/invoices/${id}`)).data,
    onSuccess: () => {
      toast.success(t('invoice.deleted'));
      router.push('/invoices');
    },
  });

  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringPeriod, setRecurringPeriod] = useState<
    'weekly' | 'monthly' | 'quarterly' | 'yearly'
  >('monthly');
  const [recurringNextRun, setRecurringNextRun] = useState(
    dayjs().add(1, 'month').format('YYYY-MM-DD'),
  );
  const [recurringName, setRecurringName] = useState('');
  const [recurringAutoSubmit, setRecurringAutoSubmit] = useState(false);

  const makeRecurring = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/recurring-invoices/from-invoice/${id}`, {
          name: recurringName || undefined,
          period: recurringPeriod,
          nextRunDate: recurringNextRun,
          autoSubmit: recurringAutoSubmit,
        })
      ).data.data,
    onSuccess: () => {
      toast.success(t('recurring.created'));
      setRecurringOpen(false);
      router.push('/invoices/recurring');
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('recurring.failed')),
  });

  // ── WhatsApp send ──────────────────────────────────────────────────────
  const [waOpen, setWaOpen] = useState(false);
  const [waTemplate, setWaTemplate] = useState<
    'invoice_sent' | 'payment_reminder' | 'overdue' | 'payment_received'
  >('payment_reminder');

  const sendWhatsapp = useMutation({
    mutationFn: async () =>
      (
        await api.post('/notifications/whatsapp/send', {
          invoiceId: id,
          template: waTemplate,
        })
      ).data,
    onSuccess: (res) => {
      const r = res?.data;
      if (r?.queued) {
        toast.success(t('whatsapp.queued'));
      } else if (r?.reason === 'no_customer_phone') {
        toast.error(t('whatsapp.noPhone'));
      } else if (r?.reason === 'whatsapp_disabled') {
        toast.error(t('whatsapp.disabled'));
      } else {
        toast.error(t('whatsapp.failed'));
      }
      setWaOpen(false);
      qc.invalidateQueries({ queryKey: ['invoice-whatsapp', id] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('whatsapp.failed')),
  });

  // ── Payment link ───────────────────────────────────────────────────────
  const [plOpen, setPlOpen] = useState(false);
  const [plAmount, setPlAmount] = useState<string>('');
  const [plExpiry, setPlExpiry] = useState<number>(14);
  const [plSendWa, setPlSendWa] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const createLink = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ data: PaymentLink }>('/payment-links', {
          invoiceId: id,
          amount: plAmount ? Number(plAmount) : undefined,
          expiresInDays: plExpiry,
          sendWhatsapp: plSendWa,
        })
      ).data.data,
    onSuccess: () => {
      toast.success(t('paymentLink.created'));
      setPlOpen(false);
      qc.invalidateQueries({ queryKey: ['invoice-payment-links', id] });
      qc.invalidateQueries({ queryKey: ['invoice-whatsapp', id] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('paymentLink.failed')),
  });
  const cancelLink = useMutation({
    mutationFn: async (linkId: string) =>
      (await api.post(`/payment-links/${linkId}/cancel`)).data,
    onSuccess: () => {
      toast.success(t('paymentLink.cancelled'));
      qc.invalidateQueries({ queryKey: ['invoice-payment-links', id] });
    },
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
      toast.success(t('paymentLink.copied'));
    } catch {
      toast.error(t('paymentLink.copyFailed'));
    }
  };

  const downloadPdf = async () => {
    const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank');
  };

  if (query.isLoading || !inv) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {inv.status === 'draft' && agent.checked && !agent.tokenConnected && (
        <EtaAgentInstallCard available={agent.available} />
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/invoices')}>
            <ArrowLeft className="h-4 w-4 rtl-flip" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{inv.invoiceNumber}</h1>
              <Badge variant={STATUS_BADGE[inv.status]}>{statusLabel(inv.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('invoice.issued', { date: formatDate(inv.issueDate) })}
              {inv.dueDate ? ` • ${t('invoice.due', { date: formatDate(inv.dueDate) })}` : ''}
              {inv.etaUuid ? ` • ${t('invoice.uuid', { value: inv.etaUuid })}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadPdf}>
            <Download className="me-2 h-4 w-4" /> {t('invoice.pdf')}
          </Button>
          <Button variant="outline" onClick={() => setWaOpen(true)}>
            <MessageCircle className="me-2 h-4 w-4" /> {t('invoice.sendWhatsapp')}
          </Button>
          {inv.status !== 'paid' && inv.status !== 'draft' && (
            <Button variant="outline" onClick={() => setPlOpen(true)}>
              <LinkIcon className="me-2 h-4 w-4" /> {t('invoice.paymentLink')}
            </Button>
          )}
          <Button variant="outline" onClick={() => setRecurringOpen(true)}>
            <Repeat className="me-2 h-4 w-4" /> {t('invoice.makeRecurring')}
          </Button>
          {inv.status === 'draft' && (
            <>
              <EtaAgentStatusBadge
                checked={agent.checked}
                available={agent.available}
                tokenConnected={agent.tokenConnected}
              />
              <Button onClick={onSubmitClick} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="me-2 h-4 w-4 rtl-flip" />
                )}
                {agent.available && agent.tokenConnected
                  ? t('invoice.submitSigned')
                  : t('invoice.submit')}
              </Button>
            </>
          )}
          {inv.status === 'rejected' && (
            <>
              <EtaAgentStatusBadge
                checked={agent.checked}
                available={agent.available}
                tokenConnected={agent.tokenConnected}
              />
              <Button
                onClick={() =>
                  agent.available && agent.tokenConnected
                    ? signAndSubmit.mutate()
                    : retry.mutate()
                }
                disabled={submitting || retry.isPending || signAndSubmit.isPending}
              >
                {(submitting || retry.isPending || signAndSubmit.isPending) ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="me-2 h-4 w-4" />
                )}
                {agent.available && agent.tokenConnected
                  ? t('invoice.submitSigned')
                  : t('invoice.retry')}
              </Button>
            </>
          )}
          {inv.status !== 'draft' &&
            inv.status !== 'paid' &&
            inv.status !== 'cancelled' && (
              <Button variant="outline" onClick={() => setRecordPaymentOpen(true)}>
                <CheckCircle2 className="me-2 h-4 w-4" /> {t('invoice.recordPayment')}
              </Button>
            )}
          {inv.status === 'draft' && (
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm(t('invoice.deleteConfirm'))) del.mutate();
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {inv.etaErrors && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <div className="font-medium text-destructive">{t('invoice.rejection')}</div>
          <pre className="mt-1 whitespace-pre-wrap text-xs">{inv.etaErrors}</pre>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('invoice.items')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoice.col.description')}</TableHead>
                  <TableHead className="text-end">{t('invoice.col.qty')}</TableHead>
                  <TableHead className="text-end">{t('invoice.col.unit')}</TableHead>
                  <TableHead className="text-end">{t('invoice.col.vat')}</TableHead>
                  <TableHead className="text-end">{t('invoice.col.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inv.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell className="text-end">{Number(it.quantity)}</TableCell>
                    <TableCell className="text-end">
                      {formatCurrency(it.unitPrice, inv.currency)}
                    </TableCell>
                    <TableCell className="text-end">{Number(it.taxRate)}%</TableCell>
                    <TableCell className="text-end font-medium">
                      {formatCurrency(it.lineTotal, inv.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {inv.notes && (
              <p className="mt-4 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                {inv.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('invoice.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label={t('invoice.subtotal')} value={formatCurrency(inv.subtotal, inv.currency)} />
              <Row
                label={t('invoice.discount')}
                value={`-${formatCurrency(inv.totalDiscount, inv.currency)}`}
              />
              <Row label={t('invoice.vat')} value={formatCurrency(inv.totalTax, inv.currency)} />
              <div className="border-t pt-2">
                <Row
                  label={<span className="font-semibold">{t('invoice.total')}</span>}
                  value={
                    <span className="font-semibold">{formatCurrency(inv.total, inv.currency)}</span>
                  }
                />
              </div>
              <Row label={t('invoice.paid')} value={formatCurrency(inv.amountPaid, inv.currency)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('invoice.customer')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{inv.customer?.name}</p>
              {inv.customer?.taxRegistrationNumber && (
                <p className="text-muted-foreground">
                  {t('invoice.taxReg')}: {inv.customer.taxRegistrationNumber}
                </p>
              )}
              {inv.customer?.phone && (
                <p className="text-muted-foreground">{inv.customer.phone}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payments history */}
      {(payments.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invoice.paymentsHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payments.col.date')}</TableHead>
                  <TableHead>{t('payments.col.method')}</TableHead>
                  <TableHead>{t('payments.col.reference')}</TableHead>
                  <TableHead className="text-end">{t('payments.col.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.data?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paidAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`payments.method.${p.method}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.reference ?? t('common.dash')}
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {formatCurrency(p.amount, p.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payment links */}
      {(links.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invoice.paymentLinks')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {links.data?.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        l.status === 'paid'
                          ? 'success'
                          : l.status === 'pending'
                            ? 'default'
                            : 'muted'
                      }
                    >
                      {t(`paymentLink.status.${l.status}`)}
                    </Badge>
                    <span className="font-medium">
                      {formatCurrency(l.amount, l.currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('paymentLink.via', { provider: l.provider })}
                    </span>
                  </div>
                  {l.checkoutUrl && (
                    <div className="flex items-center gap-2">
                      <a
                        href={l.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs text-primary hover:underline"
                      >
                        {l.checkoutUrl}
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {l.checkoutUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copy(l.checkoutUrl!)}
                      title={t('paymentLink.copy')}
                    >
                      {copied === l.checkoutUrl ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {l.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelLink.mutate(l.id)}
                    >
                      {t('paymentLink.cancel')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* WhatsApp history */}
      {(messages.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4" /> {t('invoice.whatsappHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {messages.data?.map((m) => (
              <div key={m.id} className="rounded-md border p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Badge
                    variant={
                      m.status === 'sent'
                        ? 'success'
                        : m.status === 'failed'
                          ? 'destructive'
                          : 'muted'
                    }
                  >
                    {t(`whatsapp.status.${m.status}`)}
                  </Badge>
                  <span className="font-medium">{t(`whatsapp.template.${m.template}`)}</span>
                  {m.mock && (
                    <Badge variant="outline" className="text-xs">
                      mock
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{m.toPhone}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {dayjs(m.sentAt ?? m.createdAt).format('YYYY-MM-DD HH:mm')}
                  </span>
                </div>
                {m.body && <p className="text-muted-foreground">{m.body}</p>}
                {m.errorMessage && (
                  <p className="text-xs text-destructive">{m.errorMessage}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recurring dialog */}
      <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invoice.makeRecurring')}</DialogTitle>
            <DialogDescription>{t('recurring.fromInvoiceDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('recurring.name')}</Label>
              <Input
                value={recurringName}
                onChange={(e) => setRecurringName(e.target.value)}
                placeholder={inv.invoiceNumber}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('recurring.period.label')}</Label>
                <Select
                  value={recurringPeriod}
                  onValueChange={(v) => setRecurringPeriod(v as typeof recurringPeriod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{t('recurring.period.weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('recurring.period.monthly')}</SelectItem>
                    <SelectItem value="quarterly">{t('recurring.period.quarterly')}</SelectItem>
                    <SelectItem value="yearly">{t('recurring.period.yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('recurring.nextRun')}</Label>
                <Input
                  type="date"
                  value={recurringNextRun}
                  onChange={(e) => setRecurringNextRun(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={recurringAutoSubmit}
                onChange={(e) => setRecurringAutoSubmit(e.target.checked)}
              />
              {t('recurring.autoSubmit')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => makeRecurring.mutate()}
              disabled={makeRecurring.isPending || !recurringNextRun}
            >
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp send dialog */}
      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invoice.sendWhatsapp')}</DialogTitle>
            <DialogDescription>
              {inv.customer?.phone
                ? t('whatsapp.willSendTo', { phone: inv.customer.phone })
                : t('whatsapp.noPhoneDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('whatsapp.template.label')}</Label>
              <Select value={waTemplate} onValueChange={(v) => setWaTemplate(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice_sent">{t('whatsapp.template.invoice_sent')}</SelectItem>
                  <SelectItem value="payment_reminder">
                    {t('whatsapp.template.payment_reminder')}
                  </SelectItem>
                  <SelectItem value="overdue">{t('whatsapp.template.overdue')}</SelectItem>
                  <SelectItem value="payment_received">
                    {t('whatsapp.template.payment_received')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => sendWhatsapp.mutate()}
              disabled={sendWhatsapp.isPending || !inv.customer?.phone}
            >
              <Send className="me-2 h-4 w-4 rtl-flip" />
              {t('whatsapp.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment link dialog */}
      <Dialog open={plOpen} onOpenChange={setPlOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('paymentLink.title')}</DialogTitle>
            <DialogDescription>{t('paymentLink.desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('paymentLink.amount')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={plAmount}
                  onChange={(e) => setPlAmount(e.target.value)}
                  placeholder={String(Math.max(0, inv.total - inv.amountPaid).toFixed(2))}
                />
              </div>
              <div>
                <Label>{t('paymentLink.expiresInDays')}</Label>
                <Input
                  type="number"
                  value={plExpiry}
                  onChange={(e) => setPlExpiry(Number(e.target.value))}
                  min={1}
                  max={90}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={plSendWa}
                onChange={(e) => setPlSendWa(e.target.checked)}
              />
              {t('paymentLink.sendWhatsapp')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => createLink.mutate()} disabled={createLink.isPending}>
              <LinkIcon className="me-2 h-4 w-4" /> {t('paymentLink.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <RecordPaymentDialog
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        lockedInvoice={{
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          total: Number(inv.total),
          amountPaid: Number(inv.amountPaid),
          currency: inv.currency,
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * "Extension-style" one-click install card. When the agent isn't running we
 * show a single, prominent Download button that fetches the self-contained
 * EtaSigner.exe. After the user runs it once the tray app self-installs to
 * %LOCALAPPDATA% and registers for auto-start, so subsequent page loads
 * immediately get a green "token connected" badge.
 */
function EtaAgentInstallCard({ available }: { available: boolean }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/0 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold">{t('agent.installTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {available ? t('agent.tokenDisconnected') : t('agent.installPrompt')}
            </p>
          </div>
          {!available && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => {
                  window.location.assign(ETA_AGENT_DOWNLOAD_URL);
                }}
              >
                <Download className="me-2 h-4 w-4" />
                {t('agent.download')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t('agent.installHint')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact pill near the Submit button that lets the user see whether the
 * eSeal Desktop Agent is up and whether their USB Token is plugged in. We
 * render nothing until the first probe completes so the UI doesn't flash a
 * misleading "agent missing" message on page load.
 */
function EtaAgentStatusBadge({
  checked,
  available,
  tokenConnected,
}: {
  checked: boolean;
  available: boolean;
  tokenConnected: boolean;
}) {
  const t = useT();
  if (!checked) return null;
  const ok = available && tokenConnected;
  const Icon = ok ? ShieldCheck : ShieldAlert;
  const label = ok
    ? t('agent.detected')
    : available
      ? t('agent.tokenDisconnected')
      : t('agent.notDetected');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
        ok
          ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
