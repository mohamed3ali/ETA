'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { api } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT, useFormatters } from '@/lib/i18n';

const companySchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  defaultCurrency: z.string().min(2).max(3).default('EGP'),
});
type CompanyForm = z.infer<typeof companySchema>;

const etaSchema = z.object({
  etaClientId: z.string().min(1),
  etaClientSecret: z.string().min(1),
  etaEnvironment: z.enum(['preprod', 'production']).default('preprod'),
});
type EtaForm = z.infer<typeof etaSchema>;

interface SubscriptionMe {
  subscription: {
    id: string;
    plan: 'trial' | 'starter' | 'professional' | 'enterprise';
    status: 'active' | 'past_due' | 'cancelled' | 'expired';
    startsAt: string;
    endsAt?: string | null;
    price: number;
    currency: string;
  } | null;
  usage: {
    hasSubscription: boolean;
    active: boolean;
    plan: string | null;
    status: string | null;
    startsAt: string | null;
    endsAt: string | null;
    daysRemaining: number | null;
    invoiceQuota: number;
    invoicesUsed: number;
    invoicesRemaining: number;
    isUnlimited: boolean;
  };
  catalog: {
    id: string;
    name: string;
    invoiceQuota: number;
    prices: { monthly: number; yearly: number };
    currency: string;
  } | null;
}

interface NotificationSettings {
  whatsappEnabled: boolean;
  sendOnAccepted: boolean;
  sendReminders: boolean;
  reminderLeadDays: number;
  sendOnOverdue: boolean;
  sendOnPaid: boolean;
  alertOverdue: boolean;
  alertRejected: boolean;
  alertSubmissionStuck: boolean;
  alertLargeInvoice: boolean;
  alertLargeInvoiceThreshold: number;
  templates?: Record<string, string> | null;
}

export default function SettingsPage() {
  const t = useT();
  const { formatCurrency } = useFormatters();
  const qc = useQueryClient();

  const company = useQuery({
    queryKey: ['company-me'],
    queryFn: async () => (await api.get('/companies/me')).data.data,
  });
  const settings = useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () =>
      (await api.get<{ data: NotificationSettings }>('/notifications/settings')).data.data,
  });
  const subscription = useQuery({
    queryKey: ['subscription-me'],
    queryFn: async () =>
      (await api.get<{ data: SubscriptionMe }>('/subscriptions/me')).data.data,
  });

  const form = useForm<CompanyForm>({ resolver: zodResolver(companySchema) });
  const etaForm = useForm<EtaForm>({
    resolver: zodResolver(etaSchema),
    defaultValues: { etaEnvironment: 'preprod' },
  });
  const [notif, setNotif] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    if (company.data) {
      form.reset({
        name: company.data.name,
        email: company.data.email ?? '',
        phone: company.data.phone ?? '',
        address: company.data.address ?? '',
        defaultCurrency: company.data.defaultCurrency ?? 'EGP',
      });
      etaForm.setValue('etaEnvironment', company.data.etaEnvironment ?? 'preprod');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.data]);

  useEffect(() => {
    if (settings.data) setNotif(settings.data);
  }, [settings.data]);

  const saveCompany = useMutation({
    mutationFn: async (values: CompanyForm) => {
      const payload: any = { ...values };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      return (await api.patch('/companies/me', payload)).data;
    },
    onSuccess: () => {
      toast.success(t('settings.companySaved'));
      qc.invalidateQueries({ queryKey: ['company-me'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const saveEta = useMutation({
    mutationFn: async (values: EtaForm) =>
      (await api.put('/companies/me/eta-credentials', values)).data,
    onSuccess: () => toast.success(t('settings.etaSaved')),
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const saveNotif = useMutation({
    mutationFn: async () => {
      if (!notif) return null;
      return (await api.patch('/notifications/settings', notif)).data;
    },
    onSuccess: () => {
      toast.success(t('settings.notifSaved'));
      qc.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const patchNotif = (patch: Partial<NotificationSettings>) =>
    setNotif((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <SubscriptionCard
        data={subscription.data}
        loading={subscription.isLoading}
        formatCurrency={formatCurrency}
        t={t}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.companyTitle')}</CardTitle>
          <CardDescription>{t('settings.companyDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((v) => saveCompany.mutate(v))} className="space-y-3">
            <div>
              <Label>{t('settings.companyName')}</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('settings.email')}</Label>
                <Input type="email" {...form.register('email')} />
              </div>
              <div>
                <Label>{t('settings.phone')}</Label>
                <Input {...form.register('phone')} />
              </div>
            </div>
            <div>
              <Label>{t('settings.address')}</Label>
              <Input {...form.register('address')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('settings.defaultCurrency')}</Label>
                <Input {...form.register('defaultCurrency')} />
              </div>
              <div>
                <Label>{t('settings.taxNumber')}</Label>
                <Input value={company.data?.taxRegistrationNumber ?? ''} disabled />
              </div>
            </div>
            <Button type="submit" disabled={saveCompany.isPending}>
              {t('settings.saveCompany')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.etaTitle')}</CardTitle>
          <CardDescription>
            {t('settings.etaDescA')}{' '}
            <span className="font-mono">{t('settings.etaDescMock')}</span>{' '}
            {t('settings.etaDescB')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={etaForm.handleSubmit((v) => saveEta.mutate(v))} className="space-y-3">
            <div>
              <Label>{t('settings.etaClientId')}</Label>
              <Input {...etaForm.register('etaClientId')} />
            </div>
            <div>
              <Label>{t('settings.etaClientSecret')}</Label>
              <Input type="password" {...etaForm.register('etaClientSecret')} />
            </div>
            <div>
              <Label>{t('settings.environment')}</Label>
              <Select
                value={etaForm.watch('etaEnvironment')}
                onValueChange={(v) => etaForm.setValue('etaEnvironment', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preprod">{t('settings.env.preprod')}</SelectItem>
                  <SelectItem value="production">{t('settings.env.production')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saveEta.isPending}>
              {t('settings.saveEta')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {notif && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.notifTitle')}</CardTitle>
            <CardDescription>{t('settings.notifDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle
              label={t('settings.notif.whatsappEnabled')}
              hint={t('settings.notif.whatsappEnabledHint')}
              checked={notif.whatsappEnabled}
              onChange={(v) => patchNotif({ whatsappEnabled: v })}
            />
            <Toggle
              label={t('settings.notif.sendOnAccepted')}
              checked={notif.sendOnAccepted}
              onChange={(v) => patchNotif({ sendOnAccepted: v })}
            />
            <Toggle
              label={t('settings.notif.sendReminders')}
              checked={notif.sendReminders}
              onChange={(v) => patchNotif({ sendReminders: v })}
            />
            <div className="ms-7 flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">
                {t('settings.notif.reminderLeadDays')}
              </Label>
              <Input
                type="number"
                className="w-24"
                value={notif.reminderLeadDays}
                onChange={(e) => patchNotif({ reminderLeadDays: Number(e.target.value) })}
                min={0}
                max={30}
              />
            </div>
            <Toggle
              label={t('settings.notif.sendOnOverdue')}
              checked={notif.sendOnOverdue}
              onChange={(v) => patchNotif({ sendOnOverdue: v })}
            />
            <Toggle
              label={t('settings.notif.sendOnPaid')}
              checked={notif.sendOnPaid}
              onChange={(v) => patchNotif({ sendOnPaid: v })}
            />

            <div className="border-t pt-3">
              <h3 className="mb-2 text-sm font-semibold">{t('settings.notif.alerts')}</h3>
            </div>
            <Toggle
              label={t('settings.notif.alertOverdue')}
              checked={notif.alertOverdue}
              onChange={(v) => patchNotif({ alertOverdue: v })}
            />
            <Toggle
              label={t('settings.notif.alertRejected')}
              checked={notif.alertRejected}
              onChange={(v) => patchNotif({ alertRejected: v })}
            />
            <Toggle
              label={t('settings.notif.alertSubmissionStuck')}
              checked={notif.alertSubmissionStuck}
              onChange={(v) => patchNotif({ alertSubmissionStuck: v })}
            />
            <Toggle
              label={t('settings.notif.alertLargeInvoice')}
              checked={notif.alertLargeInvoice}
              onChange={(v) => patchNotif({ alertLargeInvoice: v })}
            />
            <div className="ms-7 flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">
                {t('settings.notif.largeThreshold')}
              </Label>
              <Input
                type="number"
                className="w-40"
                value={notif.alertLargeInvoiceThreshold}
                onChange={(e) =>
                  patchNotif({ alertLargeInvoiceThreshold: Number(e.target.value) })
                }
              />
              <span className="text-xs text-muted-foreground">EGP</span>
            </div>

            <div className="border-t pt-3">
              <h3 className="mb-1 text-sm font-semibold">{t('settings.notif.templates')}</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                {t('settings.notif.templatesHint')}
              </p>
            </div>
            {(['invoice_sent', 'payment_reminder', 'overdue', 'payment_received'] as const).map(
              (key) => (
                <div key={key}>
                  <Label className="text-xs">{t(`whatsapp.template.${key}`)}</Label>
                  <Textarea
                    rows={2}
                    placeholder={t('settings.notif.templatePh')}
                    value={notif.templates?.[key] ?? ''}
                    onChange={(e) =>
                      patchNotif({
                        templates: {
                          ...(notif.templates ?? {}),
                          [key]: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              ),
            )}

            <Button onClick={() => saveNotif.mutate()} disabled={saveNotif.isPending}>
              {t('settings.saveNotif')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <div>{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
    </label>
  );
}

function SubscriptionCard({
  data,
  loading,
  formatCurrency,
  t,
}: {
  data: SubscriptionMe | undefined;
  loading: boolean;
  formatCurrency: (n: number, currency?: string) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.sub.title')}</CardTitle>
        <CardDescription>{t('settings.sub.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !data ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label={t('settings.sub.plan')}
                value={
                  data.usage.plan
                    ? t(`landing.plan.${data.usage.plan}`)
                    : t('settings.sub.none')
                }
              />
              <Stat
                label={t('settings.sub.status')}
                value={
                  data.usage.status
                    ? t(`settings.sub.status.${data.usage.status}`)
                    : t('settings.sub.statusInactive')
                }
                tone={
                  data.usage.status === 'active'
                    ? 'good'
                    : data.usage.status === 'expired'
                      ? 'bad'
                      : 'neutral'
                }
              />
              <Stat
                label={t('settings.sub.renewsOn')}
                value={data.usage.endsAt ?? t('common.dash')}
              />
              <Stat
                label={t('settings.sub.daysLeft')}
                value={
                  data.usage.daysRemaining === null
                    ? t('common.dash')
                    : String(Math.max(0, data.usage.daysRemaining))
                }
                tone={
                  data.usage.daysRemaining !== null && data.usage.daysRemaining <= 7
                    ? 'bad'
                    : 'neutral'
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-end justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('settings.sub.quotaUsed', {
                    used: data.usage.invoicesUsed,
                    quota: data.usage.isUnlimited
                      ? t('settings.sub.unlimited')
                      : data.usage.invoiceQuota,
                  })}
                </span>
                {data.subscription?.price ? (
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(
                      Number(data.subscription.price),
                      data.subscription.currency,
                    )}
                  </span>
                ) : null}
              </div>
              {!data.usage.isUnlimited && (
                <div className="h-2 w-full overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        data.usage.invoiceQuota > 0
                          ? (data.usage.invoicesUsed / data.usage.invoiceQuota) * 100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild>
                <Link href="/checkout">
                  {data.usage.hasSubscription
                    ? t('settings.sub.upgrade')
                    : t('settings.sub.subscribe')}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/#pricing">{t('settings.sub.viewPlans')}</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-rose-600 dark:text-rose-400'
        : '';
  return (
    <div className="rounded border bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
