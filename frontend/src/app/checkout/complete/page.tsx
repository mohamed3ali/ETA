'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useFormatters, useT } from '@/lib/i18n';

interface CheckoutPublic {
  token: string;
  plan: string;
  planName: string;
  billingPeriod: 'monthly' | 'yearly';
  invoiceQuota: number | null;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  provider: 'paymob' | 'mock';
  checkoutUrl?: string;
  paidAt?: string;
  expiresAt?: string;
  company: { name: string; logoUrl?: string };
}

/**
 * Landing page after returning from Paymob (real flow) or when the mock
 * checkout URL points at us directly. Polls the public subscription
 * endpoint every few seconds while still pending, so the screen flips to
 * "Subscription activated" automatically once the webhook fires.
 */
export default function CheckoutCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-muted/30 px-4 py-10">
          <div className="mx-auto max-w-md">
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      }
    >
      <CompleteInner />
    </Suspense>
  );
}

function CompleteInner() {
  const t = useT();
  const { formatCurrency, formatDate } = useFormatters();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [polling, setPolling] = useState(false);

  const query = useQuery({
    queryKey: ['checkout-public', token],
    queryFn: async () =>
      (
        await api.get<{ data: CheckoutPublic }>(`/public/subscription/${token}`)
      ).data.data,
    enabled: !!token,
    refetchInterval: polling ? 2_500 : false,
  });

  const confirmMock = useMutation({
    mutationFn: async () =>
      (await api.post(`/public/subscription/${token}/confirm-mock`)).data,
    onSuccess: () => {
      toast.success(t('checkout.success'));
      setPolling(true);
      query.refetch();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('checkout.failed')),
  });

  useEffect(() => {
    if (query.data?.status === 'paid') setPolling(false);
    if (query.data?.status === 'pending') setPolling(true);
  }, [query.data?.status]);

  if (!token) {
    return (
      <Shell>
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <p className="font-medium">{t('checkout.missingToken')}</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const data = query.data;

  return (
    <Shell>
      {!data && query.isLoading && <Skeleton className="h-72 w-full" />}

      {!data && !query.isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <p className="font-medium">{t('checkout.notFound')}</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5 text-center">
            <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              {data.company.name}
            </div>
            <CardTitle className="mt-2 text-lg">{t('checkout.completeTitle')}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-5 p-6">
            {/* Amount header */}
            <div className="rounded-xl border border-border bg-muted/40 p-5 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('checkout.amount')}
              </div>
              <div className="mt-1 text-3xl font-extrabold">
                {formatCurrency(data.amount, data.currency)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data.planName}{' '}
                <span className="opacity-70">
                  · {t(`landing.billing.${data.billingPeriod}`)}
                </span>
              </div>
            </div>

            {/* Status detail rows */}
            <div className="space-y-2 text-sm">
              <Row
                label={t('checkout.plan')}
                value={<span className="font-medium">{data.planName}</span>}
              />
              {data.invoiceQuota && (
                <Row
                  label={t('checkout.quota')}
                  value={t('landing.plan.quota', {
                    count: data.invoiceQuota.toLocaleString(),
                  })}
                />
              )}
              <Row
                label={t('checkout.status')}
                value={<StatusBadge status={data.status} />}
              />
              {data.paidAt && (
                <Row
                  label={t('checkout.paidOn')}
                  value={formatDate(data.paidAt)}
                />
              )}
            </div>

            {/* Action zone */}
            {data.status === 'paid' && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <div className="font-semibold">{t('checkout.success')}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('checkout.successSub')}
                </p>
                <Button asChild className="mt-4 w-full">
                  <Link href="/dashboard">
                    {t('checkout.goDashboard')}
                    <ArrowRight className="ms-2 h-4 w-4 rtl-flip" />
                  </Link>
                </Button>
              </div>
            )}

            {data.status === 'pending' && (
              <div className="space-y-3">
                {data.provider === 'mock' ? (
                  <Button
                    className="w-full"
                    onClick={() => confirmMock.mutate()}
                    disabled={confirmMock.isPending}
                  >
                    {confirmMock.isPending ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="me-2 h-4 w-4" />
                    )}
                    {t('checkout.confirmMock')}
                  </Button>
                ) : (
                  data.checkoutUrl && (
                    <Button asChild className="w-full">
                      <a href={data.checkoutUrl}>
                        <CreditCard className="me-2 h-4 w-4" />
                        {t('checkout.payNow')}
                      </a>
                    </Button>
                  )
                )}
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  {data.provider === 'mock'
                    ? t('checkout.mockNote')
                    : t('checkout.secure')}
                </p>
              </div>
            )}

            {(data.status === 'expired' || data.status === 'cancelled') && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-center text-sm">
                <p>{t('checkout.unavailable')}</p>
                <Button asChild variant="outline" className="mt-3">
                  <Link href="/#pricing">{t('checkout.tryDifferentPlan')}</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
}) {
  const t = useT();
  const variant: Record<typeof status, 'default' | 'success' | 'muted'> = {
    pending: 'default',
    paid: 'success',
    cancelled: 'muted',
    expired: 'muted',
  };
  return <Badge variant={variant[status]}>{t(`checkout.status.${status}`)}</Badge>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-md">
        {children}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('checkout.footer')}
        </p>
      </div>
    </div>
  );
}
