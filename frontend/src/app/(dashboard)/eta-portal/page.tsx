'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Inbox,
  Send,
  RefreshCw,
  Search as SearchIcon,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT, useFormatters } from '@/lib/i18n';

type Direction = 'Sent' | 'Received';
type Status = 'Valid' | 'Invalid' | 'Rejected' | 'Cancelled' | 'Submitted';

interface PortalDoc {
  id: string;
  uuid: string;
  direction: Direction;
  internalId?: string;
  issuerId: string;
  issuerName: string;
  receiverId?: string;
  receiverName?: string;
  dateTimeIssued: string;
  total: string;
  status: Status;
  documentStatusReason?: string;
}

interface ListResponse {
  items: PortalDoc[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const statusVariant = (s: Status): 'default' | 'destructive' | 'secondary' | 'outline' => {
  switch (s) {
    case 'Valid':
      return 'default';
    case 'Rejected':
    case 'Invalid':
      return 'destructive';
    case 'Cancelled':
      return 'secondary';
    default:
      return 'outline';
  }
};

const StatusIcon = ({ s }: { s: Status }) => {
  if (s === 'Valid') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (s === 'Rejected' || s === 'Invalid') return <XCircle className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

export default function EtaPortalPage() {
  const t = useT();
  const { formatDate, formatCurrency } = useFormatters();
  const qc = useQueryClient();

  const [direction, setDirection] = useState<Direction>('Sent');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [syncOpen, setSyncOpen] = useState(false);

  const list = useQuery({
    queryKey: ['eta-portal-list', direction, status, search, from, to],
    queryFn: async () =>
      (
        await api.get<{ items: PortalDoc[]; meta: ListResponse['meta'] }>('/eta-portal/documents', {
          params: {
            direction,
            status: status === 'all' ? undefined : status,
            search: search || undefined,
            from,
            to,
            limit: 50,
          },
        })
      ).data,
  });

  const summary = useQuery({
    queryKey: ['eta-portal-summary', from, to],
    queryFn: async () =>
      (
        await api.get<{
          data: { direction: string; status: string; count: number; totalAmount: number }[];
        }>('/eta-portal/summary', { params: { from, to } })
      ).data.data,
  });

  const sync = useMutation({
    mutationFn: async (payload: { direction: Direction; from: string; to: string }) =>
      (
        await api.post('/eta-portal/sync', {
          direction: payload.direction,
          issueDateFrom: payload.from,
          issueDateTo: payload.to,
        })
      ).data.data,
    onSuccess: (data) => {
      toast.success(
        t('etaPortal.syncDone', {
          count: String(data.upserted ?? data.fetched ?? 0),
        }),
      );
      if (data.mock) toast.message(t('etaPortal.mockNotice'));
      setSyncOpen(false);
      qc.invalidateQueries({ queryKey: ['eta-portal-list'] });
      qc.invalidateQueries({ queryKey: ['eta-portal-summary'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const totals = useMemo(() => {
    const data = summary.data ?? [];
    const reduce = (dir: Direction) =>
      data
        .filter((r) => r.direction === dir)
        .reduce(
          (acc, r) => {
            acc.count += r.count;
            acc.amount += r.totalAmount;
            return acc;
          },
          { count: 0, amount: 0 },
        );
    return { sent: reduce('Sent'), received: reduce('Received') };
  }, [summary.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('etaPortal.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('etaPortal.subtitle')}</p>
        </div>
        <Button onClick={() => setSyncOpen(true)}>
          <RefreshCw className="me-2 h-4 w-4" /> {t('etaPortal.sync')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Send className="h-4 w-4" /> {t('etaPortal.sentTitle')}
              </div>
              <p className="mt-1 text-2xl font-bold">{totals.sent.count}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totals.sent.amount)}
              </p>
            </div>
            <Send className="h-8 w-8 text-primary/30" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Inbox className="h-4 w-4" /> {t('etaPortal.receivedTitle')}
              </div>
              <p className="mt-1 text-2xl font-bold">{totals.received.count}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totals.received.amount)}
              </p>
            </div>
            <Inbox className="h-8 w-8 text-primary/30" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex-1">{t('etaPortal.documents')}</CardTitle>
            <div className="inline-flex rounded-md border p-0.5">
              <Button
                variant={direction === 'Sent' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDirection('Sent')}
              >
                <Send className="me-2 h-3.5 w-3.5" /> {t('etaPortal.sent')}
              </Button>
              <Button
                variant={direction === 'Received' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDirection('Received')}
              >
                <Inbox className="me-2 h-3.5 w-3.5" /> {t('etaPortal.received')}
              </Button>
            </div>
          </div>
          <CardDescription>{t('etaPortal.documentsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>{t('etaPortal.from')}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>{t('etaPortal.to')}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label>{t('etaPortal.status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="Valid">Valid</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="Invalid">Invalid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('common.search')}</Label>
              <div className="relative">
                <SearchIcon className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="ps-8"
                  placeholder="UUID / Internal ID / Name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('etaPortal.col.date')}</TableHead>
                <TableHead>{t('etaPortal.col.internalId')}</TableHead>
                <TableHead>
                  {direction === 'Sent' ? t('etaPortal.col.receiver') : t('etaPortal.col.issuer')}
                </TableHead>
                <TableHead>{t('etaPortal.col.total')}</TableHead>
                <TableHead>{t('etaPortal.col.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!list.isLoading && (list.data?.items?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t('etaPortal.empty')}
                  </TableCell>
                </TableRow>
              )}
              {list.data?.items?.map((d) => {
                const counterparty =
                  direction === 'Sent'
                    ? `${d.receiverName ?? '—'} (${d.receiverId ?? '—'})`
                    : `${d.issuerName} (${d.issuerId})`;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(d.dateTimeIssued)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.internalId ?? '—'}</TableCell>
                    <TableCell>{counterparty}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(Number(d.total))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(d.status)} className="gap-1">
                        <StatusIcon s={d.status} />
                        {d.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('etaPortal.syncTitle')}</DialogTitle>
            <DialogDescription>{t('etaPortal.syncDesc')}</DialogDescription>
          </DialogHeader>
          <SyncForm
            initial={{ direction, from, to }}
            running={sync.isPending}
            onSubmit={(p) => sync.mutate(p)}
            onCancel={() => setSyncOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SyncForm({
  initial,
  running,
  onSubmit,
  onCancel,
}: {
  initial: { direction: Direction; from: string; to: string };
  running: boolean;
  onSubmit: (p: { direction: Direction; from: string; to: string }) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [direction, setDirection] = useState<Direction>(initial.direction);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  return (
    <>
      <div className="space-y-3">
        <div>
          <Label>{t('etaPortal.direction')}</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sent">{t('etaPortal.sent')}</SelectItem>
              <SelectItem value="Received">{t('etaPortal.received')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('etaPortal.from')}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{t('etaPortal.to')}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={running} onClick={() => onSubmit({ direction, from, to })}>
          {running ? t('common.loading') : t('etaPortal.runSync')}
        </Button>
      </DialogFooter>
    </>
  );
}
