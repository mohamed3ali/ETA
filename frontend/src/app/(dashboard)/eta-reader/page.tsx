'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollText, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { useFormatters, useT } from '@/lib/i18n';

interface SyncLog {
  id: string;
  direction: 'outbound' | 'inbound';
  status: 'pending' | 'success' | 'failed';
  action: string;
  errorMessage?: string;
  createdAt: string;
  invoiceId?: string;
}

export default function EtaReaderPage() {
  const t = useT();
  const { formatDate } = useFormatters();
  const logs = useQuery({
    queryKey: ['eta-logs'],
    queryFn: async () => (await api.get('/eta/logs')).data.data as SyncLog[],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('eta.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('eta.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => logs.refetch()}>
          <RefreshCw className="me-2 h-4 w-4" /> {t('common.refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('eta.activityTitle')}</CardTitle>
          <CardDescription>{t('eta.activityDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('eta.col.when')}</TableHead>
                <TableHead>{t('eta.col.direction')}</TableHead>
                <TableHead>{t('eta.col.action')}</TableHead>
                <TableHead>{t('eta.col.status')}</TableHead>
                <TableHead>{t('eta.col.error')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {logs.data?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{formatDate(l.createdAt)}</TableCell>
                  <TableCell>{t(`eta.dir.${l.direction}`)}</TableCell>
                  <TableCell>{l.action}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        l.status === 'success'
                          ? 'success'
                          : l.status === 'failed'
                            ? 'destructive'
                            : 'muted'
                      }
                    >
                      {t(`eta.status.${l.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate text-xs text-muted-foreground">
                    {l.errorMessage ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!logs.isLoading && (logs.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t('eta.empty')}
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
