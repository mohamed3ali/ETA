'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Wallet } from 'lucide-react';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useFormatters, useT } from '@/lib/i18n';
import {
  PAYMENT_METHODS,
  RecordPaymentDialog,
} from '@/components/payments/record-payment-dialog';

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: string;
  reference?: string;
  notes?: string;
  invoiceId: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    customer?: { id: string; name: string };
  };
}

const METHOD_BADGE: Record<string, 'default' | 'secondary' | 'success' | 'muted' | 'outline'> = {
  cash: 'success',
  bank_transfer: 'default',
  card: 'secondary',
  cheque: 'outline',
  wallet: 'default',
  other: 'muted',
};

export default function PaymentsPage() {
  const t = useT();
  const { formatCurrency, formatDate } = useFormatters();
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);

  const queryParams = {
    search: search || undefined,
    method: method === 'all' ? undefined : method,
    from: from || undefined,
    to: to || undefined,
    limit: 50,
  };

  const list = useQuery({
    queryKey: ['payments', queryParams],
    queryFn: async () =>
      (await api.get('/payments', { params: queryParams })).data,
  });

  const summary = useQuery({
    queryKey: ['payments-summary', queryParams],
    queryFn: async () => (await api.get('/payments/summary', { params: queryParams })).data.data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('payments.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('payments.subtitle')}</p>
        </div>
        <Button onClick={() => setRecordOpen(true)}>
          <Plus className="me-2 h-4 w-4" /> {t('payments.record')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('payments.kpi.total')}</p>
            <p className="text-2xl font-semibold">
              {summary.isLoading ? '—' : formatCurrency(summary.data?.total ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('payments.kpi.count')}</p>
            <p className="text-2xl font-semibold">
              {summary.isLoading ? '—' : (summary.data?.count ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('payments.kpi.scope')}</p>
              <p className="text-sm font-medium">
                {from || to
                  ? `${from || '…'} → ${to || '…'}`
                  : t('payments.kpi.allTime')}
              </p>
            </div>
          </CardContent>
        </Card>
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
                placeholder={t('payments.searchPh')}
              />
            </div>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('payments.allMethods')}</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`payments.method.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-40"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={t('payments.from')}
              aria-label={t('payments.from')}
            />
            <Input
              type="date"
              className="w-40"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={t('payments.to')}
              aria-label={t('payments.to')}
            />
            {(search || method !== 'all' || from || to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setMethod('all');
                  setFrom('');
                  setTo('');
                }}
              >
                {t('common.clear')}
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payments.col.date')}</TableHead>
                <TableHead>{t('payments.col.invoice')}</TableHead>
                <TableHead>{t('payments.col.customer')}</TableHead>
                <TableHead>{t('payments.col.method')}</TableHead>
                <TableHead className="text-end">{t('payments.col.amount')}</TableHead>
                <TableHead>{t('payments.col.reference')}</TableHead>
                <TableHead>{t('payments.col.notes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {list.data?.items?.map((p: PaymentRow) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.paidAt)}</TableCell>
                  <TableCell>
                    {p.invoice ? (
                      <Link
                        href={`/invoices/${p.invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.invoice.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.invoice?.customer?.name ?? (
                      <span className="text-muted-foreground">{t('common.dash')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={METHOD_BADGE[p.method] ?? 'muted'}>
                      {t(`payments.method.${p.method}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    {formatCurrency(p.amount, p.currency)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.reference ?? t('common.dash')}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
                    {p.notes ?? ''}
                  </TableCell>
                </TableRow>
              ))}

              {!list.isLoading && (list.data?.items?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {t('payments.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </div>
  );
}
