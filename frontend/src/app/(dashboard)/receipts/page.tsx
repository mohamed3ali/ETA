'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Download, Filter, Receipt as ReceiptIcon } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFormatters, useStatusLabel, useT, STATUS_BADGE, STATUS_KEYS } from '@/lib/i18n';
import type { InvoiceStatus } from '@/lib/status';

interface ReceiptRow {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  status: InvoiceStatus;
  total: number;
  currency: string;
  etaUuid?: string;
  customer?: { id: string; name: string };
}

export default function ReceiptsPage() {
  const t = useT();
  const { formatCurrency, formatDate } = useFormatters();
  const statusLabel = useStatusLabel();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');

  const query = useQuery({
    queryKey: ['receipts', search, status],
    queryFn: async () =>
      (
        await api.get('/invoices', {
          params: {
            type: 'r',
            search: search || undefined,
            status: status === 'all' ? undefined : status,
            limit: 50,
          },
        })
      ).data,
  });

  const exportExcel = async () => {
    try {
      const res = await api.get('/invoices/export/excel', {
        params: {
          type: 'r',
          search: search || undefined,
          status: status === 'all' ? undefined : status,
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipts-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('invoices.exportFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptIcon className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('receipts.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('receipts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <Download className="me-2 h-4 w-4" /> {t('invoices.excel')}
          </Button>
          <Button asChild>
            <Link href="/receipts/new">
              <Plus className="me-2 h-4 w-4" /> {t('receipts.new')}
            </Link>
          </Button>
        </div>
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
                placeholder={t('receipts.searchPh')}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <Filter className="me-1.5 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('invoices.allStatuses')}</SelectItem>
                {STATUS_KEYS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('receipts.col.number')}</TableHead>
                <TableHead>{t('receipts.col.customer')}</TableHead>
                <TableHead>{t('receipts.col.date')}</TableHead>
                <TableHead>{t('receipts.col.status')}</TableHead>
                <TableHead className="text-end">{t('receipts.col.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {query.data?.items?.map((r: ReceiptRow) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{r.customer?.name ?? '—'}</TableCell>
                  <TableCell>{formatDate(r.issueDate)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[r.status]}>{statusLabel(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    {formatCurrency(r.total, r.currency)}
                  </TableCell>
                </TableRow>
              ))}
              {!query.isLoading && (query.data?.items?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t('receipts.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
