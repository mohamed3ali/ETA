'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Check, CreditCard, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useFormatters, useT } from '@/lib/i18n';

type PlanId = 'starter' | 'professional' | 'enterprise';
type BillingPeriod = 'monthly' | 'yearly';

const PLAN_META: Record<
  PlanId,
  { monthly: number; yearly: number; quota: number; nameKey: string }
> = {
  starter: { monthly: 299, yearly: 2_990, quota: 200, nameKey: 'landing.plan.starter' },
  professional: {
    monthly: 699,
    yearly: 6_990,
    quota: 1_000,
    nameKey: 'landing.plan.professional',
  },
  enterprise: {
    monthly: 1_999,
    yearly: 19_990,
    quota: 10_000,
    nameKey: 'landing.plan.enterprise',
  },
};

const ALL_PLANS: PlanId[] = ['starter', 'professional', 'enterprise'];

/**
 * Subscription checkout page. The user lands here after picking a plan
 * on the pricing section. We show an order summary, then on "Pay" we ask
 * the backend to spin up a Paymob (or mock) checkout and bounce to it.
 */
export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutShell><div className="p-8 text-center text-sm text-muted-foreground">…</div></CheckoutShell>}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const t = useT();
  const { formatCurrency } = useFormatters();
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuthStore();

  const planParam = (params.get('plan') ?? 'professional') as PlanId;
  const billingParam = (params.get('billing') ?? 'monthly') as BillingPeriod;

  const [plan, setPlan] = useState<PlanId>(
    ALL_PLANS.includes(planParam) ? planParam : 'professional',
  );
  const [billing, setBilling] = useState<BillingPeriod>(
    billingParam === 'yearly' ? 'yearly' : 'monthly',
  );

  const meta = PLAN_META[plan];
  const amount = billing === 'yearly' ? meta.yearly : meta.monthly;

  const savings = useMemo(() => {
    if (billing !== 'yearly') return 0;
    return Math.max(0, meta.monthly * 12 - meta.yearly);
  }, [billing, meta]);

  useEffect(() => {
    if (!auth.accessToken) {
      router.replace(`/register?plan=${plan}&billing=${billing}`);
    }
  }, [auth.accessToken, plan, billing, router]);

  const startCheckout = useMutation({
    mutationFn: async () => {
      const res = await api.post<{
        success: boolean;
        data: { token: string; checkoutUrl: string; provider: string };
      }>('/subscriptions/checkout', { plan, billingPeriod: billing });
      return res.data.data;
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('checkout.failed')),
  });

  return (
    <CheckoutShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Plan picker */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('checkout.choosePlan')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ALL_PLANS.map((id) => {
                const m = PLAN_META[id];
                const isActive = id === plan;
                const price = billing === 'yearly' ? m.yearly : m.monthly;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlan(id)}
                    className={`rounded-xl border p-4 text-start transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="text-sm font-semibold">{t(m.nameKey)}</div>
                    <div className="mt-2 text-xl font-bold">
                      {price.toLocaleString()} <span className="text-xs font-medium">EGP</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      / {billing === 'yearly' ? t('landing.billing.perYear') : t('landing.billing.perMonth')}
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {t('landing.plan.quota', { count: m.quota.toLocaleString() })}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <div className="text-sm font-semibold">{t('checkout.billingCycle')}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {billing === 'yearly'
                    ? t('checkout.billingCycle.yearlyHint')
                    : t('checkout.billingCycle.monthlyHint')}
                </div>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setBilling('monthly')}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    billing === 'monthly'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('landing.billing.monthly')}
                </button>
                <button
                  type="button"
                  onClick={() => setBilling('yearly')}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    billing === 'yearly'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('landing.billing.yearly')}
                  <span className="rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-600">
                    -17%
                  </span>
                </button>
              </div>
            </div>

            <ul className="space-y-2 text-sm">
              {[
                t('landing.plan.feat1'),
                t('landing.plan.feat2'),
                t('landing.plan.feat3'),
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Order summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t('checkout.orderSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row
              label={t('checkout.plan')}
              value={
                <span className="font-medium">
                  {t(meta.nameKey)}{' '}
                  <span className="text-xs text-muted-foreground">
                    ({t(`landing.billing.${billing}`)})
                  </span>
                </span>
              }
            />
            <Row
              label={t('checkout.quota')}
              value={t('landing.plan.quota', { count: meta.quota.toLocaleString() })}
            />
            <div className="border-t border-border" />
            <Row
              label={t('checkout.subtotal')}
              value={formatCurrency(amount, 'EGP')}
            />
            {savings > 0 && (
              <Row
                label={t('checkout.yearlyDiscount')}
                value={
                  <span className="text-emerald-600">
                    − {formatCurrency(savings, 'EGP')}
                  </span>
                }
              />
            )}
            <div className="border-t border-border" />
            <div className="flex items-end justify-between">
              <span className="text-sm font-medium">{t('checkout.total')}</span>
              <span className="text-2xl font-extrabold">
                {formatCurrency(amount, 'EGP')}
              </span>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={startCheckout.isPending}
              onClick={() => startCheckout.mutate()}
            >
              {startCheckout.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="me-2 h-4 w-4" />
              )}
              {t('checkout.payNow')}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              {t('checkout.secure')}
            </p>

            <div className="text-center">
              <Link
                href="/dashboard"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {t('checkout.skip')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </CheckoutShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CheckoutShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            {t('checkout.completeTitle')}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {t('checkout.title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('checkout.headerSub')}</p>
        </div>

        {children}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {t('checkout.footer')}
        </p>
      </div>
    </div>
  );
}
