'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useSearchParams } from 'next/navigation';

type FilingStatus = 'draft' | 'ready_to_file' | 'filed';
type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

interface WithholdingEntry {
  id: string;
  payeeName: string;
  payeeId?: string;
  paymentType: string;
  grossAmount: number;
  withholdingRate: number;
  withheldAmount: number;
  paymentDate?: string;
}

interface Form41Data {
  form41: { id: string; status: FilingStatus; year: number; quarter: string };
  entries: WithholdingEntry[];
  paymentTypes: Record<string, { rate: number; labelAr: string }>;
  summary: { totalGross: number; totalWithheld: number; entriesCount: number };
}

const entrySchema = z.object({
  payeeName: z.string().min(1),
  payeeId: z.string().optional().or(z.literal('')),
  paymentType: z.string().min(1),
  grossAmount: z.coerce.number().positive(),
  paymentDate: z.string().optional().or(z.literal('')),
});

type EntryForm = z.infer<typeof entrySchema>;

const STATUS_VARIANT: Record<FilingStatus, 'secondary' | 'warning' | 'default'> = {
  draft: 'secondary',
  ready_to_file: 'warning',
  filed: 'default',
};

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function Form41Page() {
  const t = useT();
  const { formatCurrency } = useFormatters();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [year, setYear] = useState(dayjs().year());
  const [quarter, setQuarter] = useState<Quarter>('Q1');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WithholdingEntry | null>(null);

  useEffect(() => {
    const q = searchParams.get('quarter') as Quarter | null;
    const y = searchParams.get('year');
    if (q && QUARTERS.includes(q)) setQuarter(q);
    if (y) setYear(Number(y));
  }, [searchParams]);

  const queryKey = ['form41', year, quarter];

  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await api.get<{ data: Form41Data }>('/form41', {
          params: { year, quarter },
        })
      ).data.data,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<EntryForm>({
      resolver: zodResolver(entrySchema),
      defaultValues: { paymentType: 'professional_services' },
    });

  const paymentType = watch('paymentType');
  const grossPreview = watch('grossAmount');
  const rates = query.data?.paymentTypes ?? {};
  const previewWithheld = useMemo(() => {
    const rate = rates[paymentType]?.rate ?? 0.05;
    const gross = Number(grossPreview) || 0;
    return Math.round(gross * rate * 100) / 100;
  }, [paymentType, grossPreview, rates]);

  const openCreate = () => {
    setEditing(null);
    reset({ paymentType: 'professional_services' });
    setOpen(true);
  };

  const openEdit = (e: WithholdingEntry) => {
    setEditing(e);
    reset({
      payeeName: e.payeeName,
      payeeId: e.payeeId ?? '',
      paymentType: e.paymentType,
      grossAmount: e.grossAmount,
      paymentDate: e.paymentDate ?? '',
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (values: EntryForm) => {
      const payload: Record<string, unknown> = { ...values, year, quarter };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      if (editing) {
        return (await api.put(`/form41/entry/${editing.id}`, payload)).data;
      }
      return (await api.post('/form41/entry', payload)).data;
    },
    onSuccess: () => {
      toast.success(t('form41.saved'));
      setOpen(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error(t('form41.error')),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/form41/entry/${id}`)).data,
    onSuccess: () => {
      toast.success(t('form41.deleted'));
      qc.invalidateQueries({ queryKey });
    },
  });

  const markReady = useMutation({
    mutationFn: async () =>
      (
        await api.patch('/form41/status', {
          year,
          quarter,
          status: 'ready_to_file',
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const markFiled = useMutation({
    mutationFn: async () =>
      (await api.post('/form41/mark-filed', { year, quarter })).data,
    onSuccess: () => {
      toast.success(t('form41.filed'));
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['tax-calendar'] });
    },
  });

  const downloadExport = async (format: 'excel' | 'pdf') => {
    const res = await api.get('/form41/export', {
      params: { year, quarter, format },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form41-${quarter}-${year}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const data = query.data;
  const status = data?.form41.status ?? 'draft';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('form41.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('form41.subtitle')}</p>
        </div>
        <Badge variant={STATUS_VARIANT[status]}>{t(`form41.status.${status}`)}</Badge>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>{t('form41.quarter')}</Label>
          <Select value={quarter} onValueChange={(v) => setQuarter(v as Quarter)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q) => (
                <SelectItem key={q} value={q}>
                  {t(`form41.quarter.${q}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('form41.year')}</Label>
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
          <Button variant="outline" onClick={() => downloadExport('excel')}>
            <Download className="me-2 h-4 w-4" />
            {t('form41.exportExcel')}
          </Button>
          <Button variant="outline" onClick={() => downloadExport('pdf')}>
            <Download className="me-2 h-4 w-4" />
            {t('form41.exportPdf')}
          </Button>
          {status === 'draft' && (
            <Button variant="secondary" onClick={() => markReady.mutate()}>
              {t('form41.markReady')}
            </Button>
          )}
          {status !== 'filed' && (
            <Button onClick={() => markFiled.mutate()} disabled={markFiled.isPending}>
              <FileCheck className="me-2 h-4 w-4" />
              {t('form41.markFiled')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: t('form41.summary.gross'), value: data?.summary.totalGross },
          { label: t('form41.summary.withheld'), value: data?.summary.totalWithheld },
          { label: t('form41.summary.count'), value: data?.summary.entriesCount, isCount: true },
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
                <p className="text-2xl font-bold">
                  {card.isCount
                    ? String(card.value ?? 0)
                    : formatCurrency(card.value ?? 0)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('form41.entriesTitle')}</CardTitle>
          <Button size="sm" onClick={openCreate} disabled={status === 'filed'}>
            <Plus className="me-2 h-4 w-4" />
            {t('form41.addEntry')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('form41.col.payee')}</TableHead>
                <TableHead>{t('form41.col.id')}</TableHead>
                <TableHead>{t('form41.col.type')}</TableHead>
                <TableHead>{t('form41.col.date')}</TableHead>
                <TableHead className="text-end">{t('form41.col.gross')}</TableHead>
                <TableHead className="text-end">{t('form41.col.withheld')}</TableHead>
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
              {data?.entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.payeeName}</TableCell>
                  <TableCell>{e.payeeId ?? '—'}</TableCell>
                  <TableCell>
                    {rates[e.paymentType]?.labelAr ?? e.paymentType}
                  </TableCell>
                  <TableCell>{e.paymentDate ?? '—'}</TableCell>
                  <TableCell className="text-end">{formatCurrency(e.grossAmount)}</TableCell>
                  <TableCell className="text-end">{formatCurrency(e.withheldAmount)}</TableCell>
                  <TableCell className="text-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(e)}
                      disabled={status === 'filed'}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove.mutate(e.id)}
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
            <DialogTitle>{editing ? t('form41.editEntry') : t('form41.addEntry')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
            <div>
              <Label>{t('form41.col.payee')}</Label>
              <Input {...register('payeeName')} />
            </div>
            <div>
              <Label>{t('form41.col.id')}</Label>
              <Input {...register('payeeId')} />
            </div>
            <div>
              <Label>{t('form41.col.type')}</Label>
              <Select
                value={paymentType}
                onValueChange={(v) => setValue('paymentType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rates).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.labelAr} ({(meta.rate * 100).toFixed(0)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('form41.col.gross')}</Label>
              <Input type="number" step="0.01" {...register('grossAmount')} />
              {errors.grossAmount && (
                <p className="text-xs text-destructive">{errors.grossAmount.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {t('form41.withholdingPreview')}: {formatCurrency(previewWithheld)}
              </p>
            </div>
            <div>
              <Label>{t('form41.col.date')}</Label>
              <Input type="date" {...register('paymentDate')} />
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
