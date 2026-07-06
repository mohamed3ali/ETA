'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Play,
  Pause,
  Trash2,
  Loader2,
  Repeat,
  Pencil,
} from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useFormatters, useT } from '@/lib/i18n';

type Period = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface RecurringItem {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  unitType?: string;
  etaItemCode?: string | null;
  etaCodeType?: 'GS1' | 'EGS';
}

interface RecurringInvoice {
  id: string;
  name?: string | null;
  customerId: string;
  customer?: { id: string; name: string };
  period: Period;
  nextRunDate: string;
  lastRunAt?: string | null;
  isActive: boolean;
  autoSubmit: boolean;
  currency: string;
  notes?: string | null;
  generatedCount: number;
  items: RecurringItem[];
}

interface Customer {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  taxRate: number;
  etaItemCode?: string;
  unitType?: string;
}

const PERIOD_KEYS: Period[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

const blankItem: RecurringItem = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 14,
  unitType: 'EA',
  etaCodeType: 'GS1',
};

export default function RecurringInvoicesPage() {
  const t = useT();
  const qc = useQueryClient();
  const { formatCurrency, formatDate } = useFormatters();
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<string>('all');
  const [active, setActive] = useState<string>('all');
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: ['recurring', search, period, active],
    queryFn: async () =>
      (
        await api.get('/recurring-invoices', {
          params: {
            search: search || undefined,
            period: period === 'all' ? undefined : period,
            isActive: active === 'all' ? undefined : active,
            limit: 50,
          },
        })
      ).data,
  });

  const toggle = useMutation({
    mutationFn: async (r: RecurringInvoice) =>
      (await api.post(`/recurring-invoices/${r.id}/active`, { isActive: !r.isActive })).data,
    onSuccess: () => {
      toast.success(t('recurring.toggled'));
      qc.invalidateQueries({ queryKey: ['recurring'] });
    },
  });

  const runNow = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/recurring-invoices/${id}/run`)).data,
    onSuccess: (res: any) => {
      const invoiceId = res?.data?.invoiceId;
      toast.success(invoiceId ? t('recurring.ran') : t('recurring.runSkipped'));
      qc.invalidateQueries({ queryKey: ['recurring'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('recurring.failed')),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/recurring-invoices/${id}`)).data,
    onSuccess: () => {
      toast.success(t('recurring.deleted'));
      qc.invalidateQueries({ queryKey: ['recurring'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('recurring.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('recurring.subtitle')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="me-2 h-4 w-4" /> {t('recurring.new')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-72 max-w-full">
              <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
                placeholder={t('recurring.searchPh')}
              />
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('recurring.allPeriods')}</SelectItem>
                {PERIOD_KEYS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`recurring.period.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={active} onValueChange={setActive}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('recurring.anyState')}</SelectItem>
                <SelectItem value="true">{t('recurring.active')}</SelectItem>
                <SelectItem value="false">{t('recurring.paused')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('recurring.col.name')}</TableHead>
                <TableHead>{t('recurring.col.customer')}</TableHead>
                <TableHead>{t('recurring.col.period')}</TableHead>
                <TableHead>{t('recurring.col.next')}</TableHead>
                <TableHead>{t('recurring.col.state')}</TableHead>
                <TableHead className="text-end">{t('recurring.col.generated')}</TableHead>
                <TableHead className="text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {list.data?.items?.map((r: RecurringInvoice) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="text-start hover:underline"
                      onClick={() => setEditing(r)}
                    >
                      {r.name ?? t('common.dash')}
                    </button>
                  </TableCell>
                  <TableCell>{r.customer?.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(`recurring.period.${r.period}`)}</Badge>
                    {r.autoSubmit && (
                      <Badge variant="default" className="ms-1.5">
                        {t('recurring.autoSubmit')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(r.nextRunDate)}</TableCell>
                  <TableCell>
                    {r.isActive ? (
                      <Badge variant="success">{t('recurring.active')}</Badge>
                    ) : (
                      <Badge variant="muted">{t('recurring.paused')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end">{r.generatedCount}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('recurring.runNow')}
                        onClick={() => runNow.mutate(r.id)}
                        disabled={runNow.isPending}
                      >
                        <Repeat className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={r.isActive ? t('recurring.pause') : t('recurring.resume')}
                        onClick={() => toggle.mutate(r)}
                      >
                        {r.isActive ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4 rtl-flip" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('common.edit')}
                        onClick={() => setEditing(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('common.delete')}
                        onClick={() => {
                          if (confirm(t('recurring.deleteConfirm'))) del.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!list.isLoading && (list.data?.items?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {t('recurring.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecurringEditor
        open={creating || !!editing}
        initial={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          qc.invalidateQueries({ queryKey: ['recurring'] });
        }}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}

function RecurringEditor({
  open,
  initial,
  onClose,
  onSaved,
  formatCurrency,
}: {
  open: boolean;
  initial: RecurringInvoice | null;
  onClose: () => void;
  onSaved: () => void;
  formatCurrency: (n: number, c?: string) => string;
}) {
  const t = useT();

  const customers = useQuery({
    enabled: open,
    queryKey: ['customers-all'],
    queryFn: async () =>
      (await api.get('/customers', { params: { limit: 200 } })).data.items as Customer[],
  });
  const products = useQuery({
    enabled: open,
    queryKey: ['products-all'],
    queryFn: async () =>
      (await api.get('/products', { params: { limit: 200 } })).data.items as Product[],
  });

  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');
  const [nextRunDate, setNextRunDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [isActive, setIsActive] = useState(true);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [currency, setCurrency] = useState('EGP');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<RecurringItem[]>([{ ...blankItem }]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name ?? '');
      setCustomerId(initial.customerId);
      setPeriod(initial.period);
      setNextRunDate(initial.nextRunDate);
      setIsActive(initial.isActive);
      setAutoSubmit(initial.autoSubmit);
      setCurrency(initial.currency);
      setNotes(initial.notes ?? '');
      setItems(
        (initial.items ?? []).map((it) => ({
          productId: it.productId ?? null,
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount ?? 0),
          taxRate: Number(it.taxRate ?? 14),
          unitType: it.unitType ?? 'EA',
          etaItemCode: it.etaItemCode ?? null,
          etaCodeType: it.etaCodeType ?? 'GS1',
        })),
      );
    } else {
      setName('');
      setCustomerId('');
      setPeriod('monthly');
      setNextRunDate(dayjs().add(1, 'day').format('YYYY-MM-DD'));
      setIsActive(true);
      setAutoSubmit(false);
      setCurrency('EGP');
      setNotes('');
      setItems([{ ...blankItem }]);
    }
  }, [initial, open]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    items.forEach((it) => {
      const gross = Number(it.quantity) * Number(it.unitPrice);
      const net = gross - Number(it.discount || 0);
      const tax = (net * Number(it.taxRate || 0)) / 100;
      subtotal += gross;
      totalDiscount += Number(it.discount || 0);
      totalTax += tax;
    });
    return { subtotal, totalDiscount, totalTax, total: subtotal - totalDiscount + totalTax };
  }, [items]);

  const setItem = (i: number, patch: Partial<RecurringItem>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const onPickProduct = (i: number, productId: string) => {
    const p = products.data?.find((x) => x.id === productId);
    if (!p) return;
    setItem(i, {
      productId,
      description: p.name,
      unitPrice: Number(p.unitPrice),
      taxRate: Number(p.taxRate),
      etaItemCode: p.etaItemCode ?? null,
      unitType: p.unitType ?? 'EA',
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name || undefined,
        customerId,
        period,
        nextRunDate,
        isActive,
        autoSubmit,
        currency,
        notes: notes || undefined,
        items: items.map((it) => ({
          productId: it.productId ?? undefined,
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
          unitType: it.unitType ?? 'EA',
          etaItemCode: it.etaItemCode ?? undefined,
          etaCodeType: it.etaCodeType ?? 'GS1',
        })),
      };
      if (initial) {
        return (await api.patch(`/recurring-invoices/${initial.id}`, payload)).data.data;
      }
      return (await api.post('/recurring-invoices', payload)).data.data;
    },
    onSuccess: () => {
      toast.success(initial ? t('recurring.updated') : t('recurring.created'));
      onSaved();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('recurring.failed')),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? t('recurring.editTitle') : t('recurring.new')}</DialogTitle>
          <DialogDescription>{t('recurring.dialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>{t('recurring.name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('recurring.namePh')}
              />
            </div>
            <div>
              <Label>{t('recurring.customer')}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('newInvoice.customerPh')} />
                </SelectTrigger>
                <SelectContent>
                  {customers.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('recurring.period.label')}</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_KEYS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`recurring.period.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('recurring.nextRun')}</Label>
              <Input
                type="date"
                value={nextRunDate}
                onChange={(e) => setNextRunDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('recurring.currency')}</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                {t('recurring.active')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={autoSubmit}
                  onChange={(e) => setAutoSubmit(e.target.checked)}
                />
                {t('recurring.autoSubmit')}
              </label>
            </div>
          </div>

          <div className="rounded-md border">
            <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
              {t('newInvoice.lineItems')}
            </div>
            <div className="space-y-2 p-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border p-2 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <Label className="text-xs">{t('newInvoice.product')}</Label>
                    <Select
                      value={it.productId ?? ''}
                      onValueChange={(v) => onPickProduct(idx, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('newInvoice.productPh')} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.data?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-4">
                    <Label className="text-xs">{t('newInvoice.description')}</Label>
                    <Input
                      value={it.description}
                      onChange={(e) => setItem(idx, { description: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-xs">{t('newInvoice.qty')}</Label>
                    <Input
                      type="number"
                      value={it.quantity}
                      onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-xs">{t('newInvoice.price')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={it.unitPrice}
                      onChange={(e) => setItem(idx, { unitPrice: Number(e.target.value) })}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-xs">{t('newInvoice.vat')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={it.taxRate}
                      onChange={(e) => setItem(idx, { taxRate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-end md:col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setItems([...items, { ...blankItem }])}>
                <Plus className="me-2 h-4 w-4" /> {t('newInvoice.addLine')}
              </Button>
            </div>
          </div>

          <div>
            <Label>{t('newInvoice.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="text-muted-foreground">{t('newInvoice.subtotal')}</div>
            <div className="text-end">{formatCurrency(totals.subtotal, currency)}</div>
            <div className="text-muted-foreground">{t('newInvoice.totalVat')}</div>
            <div className="text-end">{formatCurrency(totals.totalTax, currency)}</div>
            <div className="font-semibold">{t('newInvoice.total')}</div>
            <div className="text-end font-semibold">
              {formatCurrency(totals.total, currency)}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!customerId || items.length === 0 || save.isPending}
          >
            {save.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {initial ? t('common.saveChanges') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
