'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCheck,
} from 'lucide-react';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n';

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message?: string;
  invoiceId?: string;
  payload?: { href?: string };
  readAt?: string | null;
}

const icon = (s: Alert['severity']) =>
  s === 'critical' ? (
    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
  ) : s === 'warning' ? (
    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
  ) : (
    <Info className="h-4 w-4 shrink-0 text-blue-500" />
  );

export function NotificationsBell() {
  const router = useRouter();
  const t = useT();
  const qc = useQueryClient();

  // Poll every 60s so the badge stays roughly fresh without aggressive load.
  const unread = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: async () =>
      (await api.get<{ data: { count: number } }>('/alerts/unread-count')).data.data.count,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const top = useQuery({
    queryKey: ['alerts-top'],
    queryFn: async () =>
      (await api.get<{ data: Alert[] }>('/alerts', { params: { onlyUnread: true, limit: 6 } }))
        .data.data,
    refetchInterval: 60_000,
  });

  const markAll = useMutation({
    mutationFn: async () => (await api.post('/alerts/read-all')).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts-unread'] });
      qc.invalidateQueries({ queryKey: ['alerts-top'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const count = unread.data ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -end-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('alerts.title')}</span>
          {count > 0 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                markAll.mutate();
              }}
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="inline h-3 w-3" /> {t('alerts.markAll')}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {top.isLoading && (
          <DropdownMenuItem className="text-sm text-muted-foreground" disabled>
            {t('common.loading')}
          </DropdownMenuItem>
        )}
        {!top.isLoading && (top.data?.length ?? 0) === 0 && (
          <DropdownMenuItem disabled className="py-6 text-center text-sm text-muted-foreground">
            {t('alerts.allCaughtUp')}
          </DropdownMenuItem>
        )}
        {top.data?.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onSelect={() => {
              if (a.invoiceId) router.push(`/invoices/${a.invoiceId}`);
              else if (a.payload?.href) router.push(a.payload.href);
              else router.push('/alerts');
            }}
            className="flex cursor-pointer items-start gap-2 py-2"
          >
            {icon(a.severity)}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{a.title}</div>
              {a.message && (
                <div className="line-clamp-2 text-xs text-muted-foreground">{a.message}</div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/alerts')} className="justify-center">
          {t('alerts.viewAll')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
