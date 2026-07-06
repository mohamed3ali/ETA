'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, Info, Bell, CheckCheck, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatters, useT } from '@/lib/i18n';

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message?: string;
  invoiceId?: string;
  payload?: { href?: string };
  readAt?: string | null;
  createdAt: string;
}

const severityIcon = (s: Alert['severity']) =>
  s === 'critical' ? (
    <AlertCircle className="h-4 w-4 text-destructive" />
  ) : s === 'warning' ? (
    <AlertTriangle className="h-4 w-4 text-amber-500" />
  ) : (
    <Info className="h-4 w-4 text-blue-500" />
  );

const severityVariant = (s: Alert['severity']) =>
  s === 'critical' ? 'destructive' : s === 'warning' ? 'warning' : 'default';

export default function AlertsPage() {
  const t = useT();
  const qc = useQueryClient();
  const { formatDate } = useFormatters();

  const query = useQuery({
    queryKey: ['alerts'],
    queryFn: async () =>
      (await api.get<{ data: Alert[] }>('/alerts', { params: { limit: 100 } })).data.data,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => (await api.post(`/alerts/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const dismiss = useMutation({
    mutationFn: async (id: string) => (await api.post(`/alerts/${id}/dismiss`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const markAll = useMutation({
    mutationFn: async () => (await api.post('/alerts/read-all')).data,
    onSuccess: () => {
      toast.success(t('alerts.allRead'));
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alerts-unread'] });
    },
  });
  const evaluate = useMutation({
    mutationFn: async () => (await api.post('/alerts/evaluate')).data,
    onSuccess: (res) => {
      toast.success(t('alerts.evaluated', { count: res?.data?.touched ?? 0 }));
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alerts-unread'] });
    },
  });

  const alerts = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('alerts.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('alerts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => evaluate.mutate()} disabled={evaluate.isPending}>
            <RefreshCw className="me-2 h-4 w-4" /> {t('alerts.reevaluate')}
          </Button>
          <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck className="me-2 h-4 w-4" /> {t('alerts.markAll')}
          </Button>
        </div>
      </div>

      {query.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!query.isLoading && alerts.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
            {t('alerts.empty')}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {alerts.map((a) => (
          <Card key={a.id} className={a.readAt ? 'opacity-60' : ''}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{severityIcon(a.severity)}</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <Badge variant={severityVariant(a.severity) as any}>{t(`alerts.severity.${a.severity}`)}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                  </div>
                  {a.message && (
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                  )}
                  {a.invoiceId && (
                    <Link
                      href={`/invoices/${a.invoiceId}`}
                      className="inline-block text-xs text-primary hover:underline"
                    >
                      {t('alerts.openInvoice')} →
                    </Link>
                  )}
                  {!a.invoiceId && a.payload?.href && (
                    <Link
                      href={a.payload.href}
                      className="inline-block text-xs text-primary hover:underline"
                    >
                      {t('alerts.openModule')} →
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {!a.readAt && (
                  <Button variant="ghost" size="icon" onClick={() => markRead.mutate(a.id)}>
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => dismiss.mutate(a.id)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
