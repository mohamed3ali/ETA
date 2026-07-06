'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  TrendingUp,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useFormatters, useT } from '@/lib/i18n';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

type FilingStatus = 'draft' | 'ready_to_file' | 'filed';
type Role = 'owner' | 'admin' | 'accountant' | 'employee';

interface FirmCompanyRow {
  companyId: string;
  companyName: string;
  taxRegistrationNumber: string;
  status: string;
  role: Role;
  monthRevenue: number;
  monthVat: number;
  monthInvoices: number;
  overdueCount: number;
  submittedCount: number;
  rejectedCount: number;
  vatStatus: FilingStatus;
  vatNet: number;
  form41Status: FilingStatus;
}

interface FirmOverview {
  period: { year: number; month: number; quarter: string; from: string; to: string };
  companies: FirmCompanyRow[];
  totals: {
    companies: number;
    monthRevenue: number;
    monthVat: number;
    monthInvoices: number;
    overdueCount: number;
    submittedCount: number;
    rejectedCount: number;
    vatNotFiled: number;
    form41NotFiled: number;
  };
}

const filingBadge = (
  s: FilingStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'filed') return 'default';
  if (s === 'ready_to_file') return 'secondary';
  return 'outline';
};

const filingIcon = (s: FilingStatus) => {
  if (s === 'filed') return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

export default function FirmOverviewPage() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const { formatCurrency } = useFormatters();
  const setSession = useAuthStore((s) => s.setSession);
  const activeCompany = useAuthStore((s) => s.company);

  const overview = useQuery({
    queryKey: ['firm-overview'],
    queryFn: async () =>
      (await api.get<{ data: FirmOverview }>('/dashboard/firm-overview')).data.data,
  });

  const switchTo = useMutation({
    mutationFn: async (companyId: string) =>
      (await api.post('/auth/switch-company', { companyId })).data.data,
    onSuccess: (data, companyId) => {
      setSession({
        tokens: data.tokens,
        user: data.user,
        company: data.company,
      });
      qc.invalidateQueries();
      toast.success(t('companySwitcher.switched', { name: data.company.name }));
      if (companyId !== activeCompany?.id) {
        router.push('/dashboard');
      }
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const totals = overview.data?.totals;
  const period = overview.data?.period;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('firm.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {period
              ? t('firm.subtitle', {
                  month: String(period.month),
                  year: String(period.year),
                  quarter: period.quarter,
                })
              : t('firm.subtitleShort')}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Building2}
          label={t('firm.kpi.companies')}
          value={String(totals?.companies ?? 0)}
          loading={overview.isLoading}
        />
        <KpiCard
          icon={TrendingUp}
          label={t('firm.kpi.monthRevenue')}
          value={formatCurrency(totals?.monthRevenue ?? 0)}
          loading={overview.isLoading}
        />
        <KpiCard
          icon={Receipt}
          label={t('firm.kpi.monthVat')}
          value={formatCurrency(totals?.monthVat ?? 0)}
          loading={overview.isLoading}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t('firm.kpi.overdue')}
          value={String(totals?.overdueCount ?? 0)}
          tone={
            totals?.overdueCount && totals.overdueCount > 0 ? 'bad' : 'neutral'
          }
          loading={overview.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('firm.tableTitle')}</CardTitle>
          <CardDescription>{t('firm.tableDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('firm.col.company')}</TableHead>
                <TableHead className="text-end">{t('firm.col.revenue')}</TableHead>
                <TableHead className="text-end">{t('firm.col.vat')}</TableHead>
                <TableHead className="text-center">{t('firm.col.overdue')}</TableHead>
                <TableHead className="text-center">{t('firm.col.rejected')}</TableHead>
                <TableHead>{t('firm.col.vatReturn')}</TableHead>
                <TableHead>{t('firm.col.form41')}</TableHead>
                <TableHead className="w-32 text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!overview.isLoading && (overview.data?.companies ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {t('firm.empty')}
                  </TableCell>
                </TableRow>
              )}
              {overview.data?.companies.map((c) => {
                const isActive = c.companyId === activeCompany?.id;
                return (
                  <TableRow key={c.companyId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{c.companyName}</span>
                        <span className="text-xs text-muted-foreground">
                          {t('topbar.tin', { value: c.taxRegistrationNumber })} ·{' '}
                          {t(`companies.role.${c.role}`)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {formatCurrency(c.monthRevenue)}
                    </TableCell>
                    <TableCell className="text-end">
                      {formatCurrency(c.monthVat)}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.overdueCount > 0 ? (
                        <Badge variant="destructive">{c.overdueCount}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.rejectedCount > 0 ? (
                        <Badge variant="destructive">{c.rejectedCount}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={filingBadge(c.vatStatus)} className="gap-1">
                        {filingIcon(c.vatStatus)}
                        {t(`firm.filing.${c.vatStatus}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={filingBadge(c.form41Status)} className="gap-1">
                        {filingIcon(c.form41Status)}
                        {t(`firm.filing.${c.form41Status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant={isActive ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => switchTo.mutate(c.companyId)}
                        disabled={switchTo.isPending}
                      >
                        {isActive ? (
                          <>
                            <ArrowRight className="me-1 h-3.5 w-3.5" />
                            {t('firm.openCurrent')}
                          </>
                        ) : (
                          <>
                            <ArrowRight className="me-1 h-3.5 w-3.5" />
                            {t('firm.open')}
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-500" />
              {t('firm.taxAlerts')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <AlertRow
              label={t('firm.vatNotFiled')}
              value={totals?.vatNotFiled ?? 0}
            />
            <AlertRow
              label={t('firm.form41NotFiled')}
              value={totals?.form41NotFiled ?? 0}
            />
            <AlertRow
              label={t('firm.kpi.submitted')}
              value={totals?.submittedCount ?? 0}
              neutral
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-primary" />
              {t('firm.quickLinks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link href="/companies" className="block text-primary hover:underline">
              → {t('nav.companies')}
            </Link>
            <Link href="/team" className="block text-primary hover:underline">
              → {t('nav.team')}
            </Link>
            <Link href="/eta-portal" className="block text-primary hover:underline">
              → {t('nav.etaPortal')}
            </Link>
            <Link href="/vat-return" className="block text-primary hover:underline">
              → {t('nav.vatReturn')}
            </Link>
            <Link href="/form41" className="block text-primary hover:underline">
              → {t('nav.form41')}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'neutral';
  loading?: boolean;
}) {
  const color =
    tone === 'bad'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'good'
        ? 'text-emerald-600 dark:text-emerald-400'
        : '';
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          {loading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          )}
        </div>
        <Icon className="h-7 w-7 text-primary/30" />
      </CardContent>
    </Card>
  );
}

function AlertRow({
  label,
  value,
  neutral,
}: {
  label: string;
  value: number;
  neutral?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2">
      <span>{label}</span>
      <Badge variant={neutral ? 'secondary' : value > 0 ? 'destructive' : 'outline'}>
        {value}
      </Badge>
    </div>
  );
}
