'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Pencil, Trash2, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs from 'dayjs';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatters, useT } from '@/lib/i18n';

type FilingStatus = 'draft' | 'ready_to_file' | 'filed';

interface VatPurchase {
  id: string;
  supplierName: string;
  supplierTaxId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  notes?: string;
}

interface VatReturnData {
  return: { id: string; status: FilingStatus; year: number; month: number };
  purchases: VatPurchase[];
  summary: {
    outputVat: number;
    inputVat: number;
    netVat: number;
    salesTotal: number;
    purchasesCount: number;
  };
}

const purchaseSchema = z.object({
  supplierName: z.string().min(1),
  supplierTaxId: z.string().optional().or(z.literal('')),
  invoiceNumber: z.string().optional().or(z.literal('')),
  invoiceDate: z.string().optional().or(z.literal('')),
  netAmount: z.coerce.number().nonnegative(),
  vatAmount: z.coerce.number().nonnegative(),
  notes: z.string().optional().or(z.literal('')),
});

type PurchaseForm = z.infer<typeof purchaseSchema>;

const STATUS_VARIANT: Record<FilingStatus, 'secondary' | 'warning' | 'default'> = {
  draft: 'secondary',
  ready_to_file: 'warning',
  filed: 'default',
};

export default function VatReturnPage() {
  const t = useT();
  const { formatCurrency } = useFormatters();
  const qc = useQueryClient();
  const now = dayjs();
  const [year, setYear] = useState(now.year());
  const [month, setMonth] = useState(now.month() + 1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VatPurchase | null>(null);

  const queryKey = ['vat-return', year, month];

  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await api.get<{ data: VatReturnData }>('/vat-return', {
          params: { year, month },
        })
      ).data.data,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseSchema),
  });

  const openCreate = () => {
    setEditing(null);
    reset({});
    setOpen(true);
  };

  const openEdit = (p: VatPurchase) => {
    setEditing(p);
    reset({
      supplierName: p.supplierName,
      supplierTaxId: p.supplierTaxId ?? '',
      invoiceNumber: p.invoiceNumber ?? '',
      invoiceDate: p.invoiceDate ?? '',
      netAmount: p.netAmount,
      vatAmount: p.vatAmount,
      notes: p.notes ?? '',
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (values: PurchaseForm) => {
      const payload: Record<string, unknown> = { ...values, year, month };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      if (editing) {
        return (await api.put(`/vat-return/purchase/${editing.id}`, payload)).data;
      }
      return (await api.post('/vat-return/purchase', payload)).data;
    },
    onSuccess: () => {
      toast.success(t('vat.saved'));
      setOpen(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error(t('vat.error')),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/vat-return/purchase/${id}`)).data,
    onSuccess: () => {
      toast.success(t('vat.deleted'));
      qc.invalidateQueries({ queryKey });
    },
  });

  const markReady = useMutation({
    mutationFn: async () =>
      (
        await api.patch('/vat-return/status', {
          year,
          month,
          status: 'ready_to_file',
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const markFiled = useMutation({
    mutationFn: async () =>
      (await api.post('/vat-return/mark-filed', { year, month })).data,
    onSuccess: () => {
      toast.success(t('vat.filed'));
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['tax-calendar'] });
    },
  });

  const exportExcel = async (format: 'excel' | 'pdf') => {
    const res = await api.get('/vat-return/export', {
      params: { year, month, format },
      responseType: 'blob',
    });
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-return-${year}-${month}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const data = query.data;
  const status = data?.return.status ?? 'draft';
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: dayjs().month(i).locale('ar').format('MMMM'),
      })),
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('vat.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('vat.subtitle')}</p>
        </div>
        <Badge variant={STATUS_VARIANT[status]}>{t(`vat.status.${status}`)}</Badge>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>{t('vat.period.month')}</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('vat.period.year')}</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => exportExcel('excel')}>
            <Download className="me-2 h-4 w-4" />
            {t('vat.exportExcel')}
          </Button>
          <Button variant="outline" onClick={() => exportExcel('pdf')}>
            <Download className="me-2 h-4 w-4" />
            {t('vat.exportPdf')}
          </Button>
          {status === 'draft' && (
            <Button variant="secondary" onClick={() => markReady.mutate()}>
              {t('vat.markReady')}
            </Button>
          )}
          {status !== 'filed' && (
            <Button onClick={() => markFiled.mutate()} disabled={markFiled.isPending}>
              <FileCheck className="me-2 h-4 w-4" />
              {t('vat.markFiled')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: t('vat.summary.output'), value: data?.summary.outputVat },
          { label: t('vat.summary.input'), value: data?.summary.inputVat },
          { label: t('vat.summary.net'), value: data?.summary.netVat },
          { label: t('vat.summary.sales'), value: data?.summary.salesTotal },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <p className="text-2xl font-bold">{formatCurrency(card.value ?? 0)}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('vat.purchasesTitle')}</CardTitle>
          <Button size="sm" onClick={openCreate} disabled={status === 'filed'}>
            <Plus className="me-2 h-4 w-4" />
            {t('vat.addPurchase')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('vat.col.supplier')}</TableHead>
                <TableHead>{t('vat.col.taxId')}</TableHead>
                <TableHead>{t('vat.col.invoice')}</TableHead>
                <TableHead>{t('vat.col.date')}</TableHead>
                <TableHead className="text-end">{t('vat.col.net')}</TableHead>
                <TableHead className="text-end">{t('vat.col.vat')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {data?.purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.supplierName}</TableCell>
                  <TableCell>{p.supplierTaxId ?? '—'}</TableCell>
                  <TableCell>{p.invoiceNumber ?? '—'}</TableCell>
                  <TableCell>{p.invoiceDate ?? '—'}</TableCell>
                  <TableCell className="text-end">{formatCurrency(p.netAmount)}</TableCell>
                  <TableCell className="text-end">{formatCurrency(p.vatAmount)}</TableCell>
                  <TableCell className="text-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                      disabled={status === 'filed'}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(p.id)}
                      disabled={status === 'filed'}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('vat.editPurchase') : t('vat.addPurchase')}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            <div>
              <Label>{t('vat.col.supplier')}</Label>
              <Input {...register('supplierName')} />
              {errors.supplierName && (
                <p className="text-xs text-destructive">{errors.supplierName.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('vat.col.taxId')}</Label>
                <Input {...register('supplierTaxId')} />
              </div>
              <div>
                <Label>{t('vat.col.invoice')}</Label>
                <Input {...register('invoiceNumber')} />
              </div>
            </div>
            <div>
              <Label>{t('vat.col.date')}</Label>
              <Input type="date" {...register('invoiceDate')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('vat.col.net')}</Label>
                <Input type="number" step="0.01" {...register('netAmount')} />
              </div>
              <div>
                <Label>{t('vat.col.vat')}</Label>
                <Input type="number" step="0.01" {...register('vatAmount')} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
