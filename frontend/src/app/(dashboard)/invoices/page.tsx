'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Download, Filter } from 'lucide-react';
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

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  status: InvoiceStatus;
  total: number;
  currency: string;
  etaUuid?: string;
  customer?: { id: string; name: string };
  branch?: { id: string; name: string };
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export default function InvoicesPage() {
  const t = useT();
  const { formatCurrency, formatDate } = useFormatters();
  const statusLabel = useStatusLabel();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [branchId, setBranchId] = useState<string>('all');

  const branches = useQuery({
    queryKey: ['branches-options'],
    queryFn: async () => (await api.get<{ data: BranchOption[] }>('/branches')).data.data,
  });

  const query = useQuery({
    queryKey: ['invoices', search, status, branchId],
    queryFn: async () =>
      (
        await api.get('/invoices', {
          params: {
            type: 'i',
            search: search || undefined,
            status: status === 'all' ? undefined : status,
            branchId: branchId === 'all' ? undefined : branchId,
            limit: 50,
          },
        })
      ).data,
  });

  const exportExcel = async () => {
    try {
      const res = await api.get('/invoices/export/excel', {
        params: {
          type: 'i',
          search: search || undefined,
          status: status === 'all' ? undefined : status,
          branchId: branchId === 'all' ? undefined : branchId,
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-${Date.now()}.xlsx`;
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
          <h1 className="text-2xl font-bold">{t('invoices.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('invoices.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <Download className="me-2 h-4 w-4" /> {t('invoices.excel')}
          </Button>
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="me-2 h-4 w-4" /> {t('invoices.new')}
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
                placeholder={t('invoices.searchPh')}
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
            {(branches.data?.length ?? 0) > 0 && (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('invoices.allBranches')}</SelectItem>
                  {branches.data?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoices.col.number')}</TableHead>
                <TableHead>{t('invoices.col.customer')}</TableHead>
                {(branches.data?.length ?? 0) > 0 && (
                  <TableHead>{t('invoices.col.branch')}</TableHead>
                )}
                <TableHead>{t('invoices.col.date')}</TableHead>
                <TableHead>{t('invoices.col.status')}</TableHead>
                <TableHead className="text-end">{t('invoices.col.total')}</TableHead>
                <TableHead>{t('invoices.col.uuid')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: (branches.data?.length ?? 0) > 0 ? 7 : 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {query.data?.items?.map((inv: InvoiceRow) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.customer?.name}</TableCell>
                  {(branches.data?.length ?? 0) > 0 && (
                    <TableCell className="text-muted-foreground">
                      {inv.branch?.name ?? '—'}
                    </TableCell>
                  )}
                  <TableCell>{formatDate(inv.issueDate)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[inv.status]}>{statusLabel(inv.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    {formatCurrency(inv.total, inv.currency)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {inv.etaUuid ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!query.isLoading && (query.data?.items?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={(branches.data?.length ?? 0) > 0 ? 7 : 6} className="py-10 text-center text-muted-foreground">
                    {t('invoices.empty')}
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
