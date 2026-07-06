'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatters, useT } from '@/lib/i18n';

interface PublicLink {
  token: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  provider: string;
  checkoutUrl?: string;
  expiresAt?: string;
  paidAt?: string;
  invoice: {
    number: string;
    issueDate: string;
    dueDate?: string;
    total: number;
    currency: string;
  };
  company: { name: string; logoUrl?: string };
}

/**
 * Public, unauthenticated payment page. Customers land here from a payment
 * link sent via WhatsApp or email and can either click through to the real
 * gateway (Paymob) or, in mock mode, confirm the payment in-place.
 */
export default function PublicPayPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const t = useT();
  const { formatCurrency, formatDate } = useFormatters();
  const [confirmed, setConfirmed] = useState(false);

  const query = useQuery({
    queryKey: ['public-pay', token],
    queryFn: async () =>
      (await api.get<{ data: PublicLink }>(`/public/pay/${token}`)).data.data,
    refetchInterval: confirmed ? 2_000 : false,
  });

  const confirmMock = useMutation({
    mutationFn: async () => (await api.post(`/public/pay/${token}/confirm-mock`)).data,
    onSuccess: () => {
      toast.success(t('publicPay.success'));
      setConfirmed(true);
      query.refetch();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('publicPay.failed')),
  });

  useEffect(() => {
    if (query.data?.status === 'paid') setConfirmed(true);
  }, [query.data?.status]);

  const link = query.data;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-md">
        {!link && query.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!link && !query.isLoading && (
          <Card>
            <CardContent className="p-10 text-center">
              <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-medium">{t('publicPay.notFound')}</p>
              <p className="text-sm text-muted-foreground">{t('publicPay.notFoundDesc')}</p>
            </CardContent>
          </Card>
        )}

        {link && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-primary/5 text-center">
              {link.company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={link.company.logoUrl}
                  alt={link.company.name}
                  className="mx-auto h-12 w-auto"
                />
              ) : (
                <div className="mx-auto rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                  {link.company.name}
                </div>
              )}
              <CardTitle className="text-lg">{t('publicPay.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-md border bg-muted/40 p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('publicPay.amount')}
                </div>
                <div className="mt-1 text-3xl font-bold">
                  {formatCurrency(link.amount, link.currency)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t('publicPay.invoiceNumber', { number: link.invoice.number })}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <Row label={t('publicPay.issuedOn')} value={formatDate(link.invoice.issueDate)} />
                {link.invoice.dueDate && (
                  <Row label={t('publicPay.dueOn')} value={formatDate(link.invoice.dueDate)} />
                )}
                <Row
                  label={t('publicPay.status')}
                  value={
                    <Badge
                      variant={
                        link.status === 'paid'
                          ? 'success'
                          : link.status === 'pending'
                            ? 'default'
                            : 'muted'
                      }
                    >
                      {t(`paymentLink.status.${link.status}`)}
                    </Badge>
                  }
                />
              </div>

              {link.status === 'paid' && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-sm">
                  <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-emerald-500" />
                  <div className="font-medium">{t('publicPay.paidTitle')}</div>
                  {link.paidAt && (
                    <div className="text-xs text-muted-foreground">
                      {formatDate(link.paidAt)}
                    </div>
                  )}
                </div>
              )}

              {link.status === 'pending' && (
                <div className="space-y-2">
                  {link.provider === 'mock' ? (
                    <Button
                      className="w-full"
                      onClick={() => confirmMock.mutate()}
                      disabled={confirmMock.isPending}
                    >
                      {confirmMock.isPending && (
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      )}
                      {t('publicPay.confirmMock')}
                    </Button>
                  ) : (
                    link.checkoutUrl && (
                      <Button asChild className="w-full">
                        <a href={link.checkoutUrl} target="_self" rel="noopener noreferrer">
                          <ExternalLink className="me-2 h-4 w-4" />
                          {t('publicPay.payNow')}
                        </a>
                      </Button>
                    )
                  )}
                  <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    {link.provider === 'mock'
                      ? t('publicPay.mockNote')
                      : t('publicPay.secureNote', { provider: link.provider })}
                  </p>
                </div>
              )}

              {(link.status === 'expired' || link.status === 'cancelled') && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-center text-sm">
                  {t('publicPay.unavailable')}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Powered by ETA SaaS · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
