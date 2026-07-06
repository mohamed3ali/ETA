'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useFormatters, useT } from '@/lib/i18n';

interface Item {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  etaItemCode?: string;
  unitType?: string;
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
interface Branch {
  id: string;
  name: string;
  code: string;
}

const blankItem: Item = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 14,
};

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const { formatCurrency } = useFormatters();
  const docType =
    searchParams.get('type') === 'r' ? 'r' : ('i' as 'i' | 'r');
  const isReceipt = docType === 'r';
  const [customerId, setCustomerId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [issueDate, setIssueDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([{ ...blankItem }]);

  const customers = useQuery({
    queryKey: ['customers-all'],
    queryFn: async () =>
      (await api.get('/customers', { params: { limit: 200 } })).data
        .items as Customer[],
  });
  const products = useQuery({
    queryKey: ['products-all'],
    queryFn: async () =>
      (await api.get('/products', { params: { limit: 200 } })).data
        .items as Product[],
  });
  const branches = useQuery({
    queryKey: ['branches-options'],
    queryFn: async () => (await api.get<{ data: Branch[] }>('/branches')).data.data,
  });

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
    return {
      subtotal,
      totalDiscount,
      totalTax,
      total: subtotal - totalDiscount + totalTax,
    };
  }, [items]);

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const onPickProduct = (i: number, productId: string) => {
    const p = products.data?.find((x) => x.id === productId);
    if (!p) return;
    setItem(i, {
      productId,
      description: p.name,
      unitPrice: Number(p.unitPrice),
      taxRate: Number(p.taxRate),
      etaItemCode: p.etaItemCode,
      unitType: p.unitType ?? 'EA',
    });
  };

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        type: docType,
        customerId,
        branchId: branchId || undefined,
        issueDate,
        dueDate: isReceipt ? undefined : dueDate || undefined,
        notes: notes || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
          unitType: it.unitType ?? 'EA',
          etaItemCode: it.etaItemCode,
        })),
      };
      return (await api.post('/invoices', payload)).data.data;
    },
    onSuccess: (inv) => {
      toast.success(isReceipt ? t('newReceipt.created') : t('newInvoice.created'));
      router.push(`/invoices/${inv.id}`);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('newInvoice.failed')),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {isReceipt ? t('newReceipt.title') : t('newInvoice.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isReceipt ? t('newReceipt.subtitle') : t('newInvoice.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('newInvoice.lineItems')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="grid gap-2 rounded-md border p-3 md:grid-cols-12">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('newInvoice.details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{t('newInvoice.customer')}</Label>
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
            {(branches.data?.length ?? 0) > 0 && (
              <div>
                <Label>{t('newInvoice.branch')}</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('newInvoice.branchPh')} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.data?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={isReceipt ? '' : 'grid grid-cols-2 gap-2'}>
              <div>
                <Label>{t('newInvoice.issueDate')}</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              {!isReceipt && (
                <div>
                  <Label>{t('newInvoice.dueDate')}</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>{t('newInvoice.notes')}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>

            <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('newInvoice.subtotal')}</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('newInvoice.discount')}</span>
                <span>-{formatCurrency(totals.totalDiscount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('newInvoice.totalVat')}</span>
                <span>{formatCurrency(totals.totalTax)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                <span>{t('newInvoice.total')}</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!customerId || items.length === 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {isReceipt ? t('newReceipt.saveDraft') : t('newInvoice.saveDraft')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
