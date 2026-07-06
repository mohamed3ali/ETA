'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft } from 'lucide-react';

import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type CalendarStatus = 'filed' | 'due_soon' | 'overdue' | 'upcoming';

interface TaxCalendarItem {
  id: string;
  type: 'vat' | 'form41';
  title: string;
  periodLabel: string;
  deadline: string;
  status: CalendarStatus;
  href: string;
}

const statusClass: Record<CalendarStatus, string> = {
  filed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  due_soon: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  overdue: 'bg-destructive/15 text-destructive',
  upcoming: 'bg-muted text-muted-foreground',
};

export function TaxCalendarWidget({ className }: { className?: string }) {
  const t = useT();
  const query = useQuery({
    queryKey: ['tax-calendar'],
    queryFn: async () =>
      (await api.get<{ data: TaxCalendarItem[] }>('/tax-calendar')).data.data,
    refetchInterval: 300_000,
  });

  const items = query.data ?? [];

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b bg-muted/30 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="h-4 w-4" />
          </div>
          {t('taxCalendar.title')}
        </CardTitle>
        <CardDescription>{t('taxCalendar.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
        {query.isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />)}
        {!query.isLoading && items.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">{t('taxCalendar.empty')}</p>
        )}
        {items.slice(0, 6).map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex items-center justify-between gap-2 rounded-xl border bg-card/50 p-3 transition-all hover:border-primary/30 hover:bg-accent/40 hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.periodLabel}</div>
              <div className="mt-0.5 text-xs font-medium text-primary/80">
                {t('taxCalendar.deadline')}: {item.deadline}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge className={statusClass[item.status]} variant="outline">
                {t(`taxCalendar.status.${item.status}`)}
              </Badge>
              <ChevronLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-[-2px] rtl:rotate-180 rtl:group-hover:translate-x-[2px]" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
