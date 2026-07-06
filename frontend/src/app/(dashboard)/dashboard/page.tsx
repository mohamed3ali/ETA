'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Receipt,
  ReceiptText,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatters, useStatusLabel, useT, STATUS_BADGE } from '@/lib/i18n';
import type { InvoiceStatus } from '@/lib/status';
import { useAuthStore } from '@/store/auth-store';
import { TaxCalendarWidget } from '@/components/dashboard/tax-calendar-widget';
import { cn } from '@/lib/utils';

interface Metrics {
  counts: { total: number; accepted: number; rejected: number; paid: number; overdue: number };
  thisMonth: { revenue: number; vat: number };
  yearToDate: { revenue: number; vat: number };
}

interface Trend {
  month: string;
  revenue: number;
  vat: number;
  count: number;
}

interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  status: InvoiceStatus;
  total: number;
  currency: string;
  customer?: { id: string; name: string };
}

const KPI_THEMES = [
  {
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    accent: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    ring: 'ring-emerald-500/20',
  },
  {
    iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    accent: 'from-violet-500/20 via-violet-500/5 to-transparent',
    ring: 'ring-violet-500/20',
  },
  {
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    accent: 'from-blue-500/20 via-blue-500/5 to-transparent',
    ring: 'ring-blue-500/20',
  },
  {
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    accent: 'from-amber-500/20 via-amber-500/5 to-transparent',
    ring: 'ring-amber-500/20',
  },
] as const;

const STATUS_ITEMS = [
  { key: 'accepted' as const, icon: CheckCircle2, bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'rejected' as const, icon: XCircle, bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { key: 'paid' as const, icon: Wallet, bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { key: 'overdue' as const, icon: Clock, bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
];

export default function DashboardPage() {
  const t = useT();
  const { formatCurrency, formatDate } = useFormatters();
  const statusLabel = useStatusLabel();
  const user = useAuthStore((s) => s.user);

  const metrics = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => (await api.get<{ data: Metrics }>('/dashboard/metrics')).data.data,
  });

  const trend = useQuery({
    queryKey: ['dashboard-trend'],
    queryFn: async () =>
      (await api.get<{ data: Trend[] }>('/dashboard/revenue-by-month?months=12')).data.data,
  });

  const recent = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: async () =>
      (await api.get<{ data: RecentInvoice[] }>('/dashboard/recent-invoices?limit=8')).data.data,
  });

  const m = metrics.data;
  const displayName = user?.firstName ?? t('common.profile');

  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute -top-6 start-1/2 h-64 w-[480px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl rtl:translate-x-1/2" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{t('dashboard.title')}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            {t('dashboard.welcome').replace('{name}', displayName)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="shadow-md shadow-primary/20">
            <Link href="/invoices/new">
              <Plus className="me-2 h-4 w-4" />
              {t('dashboard.action.newInvoice')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/vat-return">
              <Receipt className="me-2 h-4 w-4" />
              {t('dashboard.action.vatReturn')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/reports">
              <BarChart3 className="me-2 h-4 w-4" />
              {t('dashboard.action.reports')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t('dashboard.kpi.monthRevenue')}
          value={m ? formatCurrency(m.thisMonth.revenue) : null}
          icon={TrendingUp}
          theme={KPI_THEMES[0]}
          loading={metrics.isLoading}
        />
        <KpiCard
          title={t('dashboard.kpi.monthVat')}
          value={m ? formatCurrency(m.thisMonth.vat) : null}
          icon={Wallet}
          theme={KPI_THEMES[1]}
          loading={metrics.isLoading}
        />
        <KpiCard
          title={t('dashboard.kpi.ytdRevenue')}
          value={m ? formatCurrency(m.yearToDate.revenue) : null}
          icon={ReceiptText}
          theme={KPI_THEMES[2]}
          loading={metrics.isLoading}
        />
        <KpiCard
          title={t('dashboard.kpi.totalInvoices')}
          value={m ? String(m.counts.total) : null}
          icon={FileText}
          theme={KPI_THEMES[3]}
          loading={metrics.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatusOverviewCard
          counts={m?.counts}
          loading={metrics.isLoading}
          label={t('dashboard.statusOverview')}
          t={t}
        />
        <TaxCalendarWidget className="lg:col-span-2" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
            <div>
              <CardTitle>{t('dashboard.chart.title')}</CardTitle>
              <CardDescription>{t('dashboard.chart.desc')}</CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                {t('dashboard.chart.revenue')}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                {t('dashboard.chart.vat')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-80 pb-6">
            {trend.isLoading ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend.data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                  <XAxis
                    dataKey="month"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={48}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg">
                          <p className="mb-1 font-medium">{label}</p>
                          {payload.map((entry) => (
                            <p key={entry.dataKey} className="text-muted-foreground">
                              <span
                                className="me-2 inline-block h-2 w-2 rounded-full"
                                style={{ background: entry.color }}
                              />
                              {entry.dataKey === 'revenue'
                                ? t('dashboard.chart.revenue')
                                : t('dashboard.chart.vat')}
                              :{' '}
                              <span className="font-medium text-foreground">
                                {formatCurrency(Number(entry.value))}
                              </span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#revenueGradient)"
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="vat"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    fill="transparent"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">{t('dashboard.recent.title')}</CardTitle>
              <CardDescription>{t('dashboard.recent.desc')}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs">
              <Link href="/invoices">
                {t('dashboard.viewAll')}
                <ArrowUpRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 p-4 pt-0">
            {recent.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
              ))}
            {!recent.isLoading && !recent.data?.length && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
                <FileText className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t('dashboard.emptyRecent')}</p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href="/invoices/new">{t('dashboard.action.newInvoice')}</Link>
                </Button>
              </div>
            )}
            {recent.data?.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="group flex items-center gap-3 rounded-xl border bg-card/50 p-3 transition-all hover:border-primary/30 hover:bg-accent/40 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{inv.invoiceNumber}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {inv.customer?.name ?? '—'} · {formatDate(inv.issueDate)}
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <div className="text-sm font-semibold">{formatCurrency(inv.total, inv.currency)}</div>
                  <Badge variant={STATUS_BADGE[inv.status]} className="mt-1 text-[10px]">
                    {statusLabel(inv.status)}
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  theme,
  loading,
}: {
  title: string;
  value: string | null;
  icon: LucideIcon;
  theme: (typeof KPI_THEMES)[number];
  loading?: boolean;
}) {
  return (
    <Card className={cn('group relative overflow-hidden ring-1 ring-inset transition-shadow hover:shadow-md', theme.ring)}>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80 transition-opacity group-hover:opacity-100',
          theme.accent,
        )}
      />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn('rounded-xl p-2.5', theme.iconBg)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
          {loading ? <Skeleton className="h-8 w-36" /> : value ?? '—'}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusOverviewCard({
  counts,
  loading,
  label,
  t,
}: {
  counts?: Metrics['counts'];
  loading?: boolean;
  label: string;
  t: (key: string) => string;
}) {
  const total = counts?.total ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        {!loading &&
          STATUS_ITEMS.map(({ key, icon: Icon, bar, text }) => {
            const count = counts?.[key] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', text)} />
                    <span className="text-sm text-muted-foreground">{t(`dashboard.stat.${key}`)}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
