'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, ArrowRightLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore, AccessibleCompany } from '@/store/auth-store';
import { useT } from '@/lib/i18n';

const createSchema = z
  .object({
    name: z.string().min(2),
    taxRegistrationNumber: z.string().min(5),
    nameEn: z.string().optional().or(z.literal('')),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    etaClientId: z.string().optional().or(z.literal('')),
    etaClientSecret: z.string().optional().or(z.literal('')),
    etaEnvironment: z.enum(['preprod', 'production']).default('preprod'),
  })
  .refine(
    (d) => {
      const hasId = !!d.etaClientId?.trim();
      const hasSecret = !!d.etaClientSecret?.trim();
      return hasId === hasSecret;
    },
    { message: 'etaBothRequired', path: ['etaClientId'] },
  );
type CreateForm = z.infer<typeof createSchema>;

export default function CompaniesPage() {
  const t = useT();
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const setCompanies = useAuthStore((s) => s.setCompanies);
  const activeCompany = useAuthStore((s) => s.company);
  const stored = useAuthStore((s) => s.companies);
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { etaEnvironment: 'preprod' },
  });

  const list = useQuery({
    queryKey: ['accessible-companies'],
    queryFn: async () =>
      (await api.get<{ data: AccessibleCompany[] }>('/companies/mine')).data.data,
  });

  const create = useMutation({
    mutationFn: async (values: CreateForm) => {
      const payload: any = { ...values };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      return (await api.post('/companies', payload)).data.data;
    },
    onSuccess: () => {
      toast.success(t('companies.created'));
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ['accessible-companies'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const switchTo = useMutation({
    mutationFn: async (companyId: string) =>
      (await api.post('/auth/switch-company', { companyId })).data.data,
    onSuccess: (data) => {
      setSession({
        tokens: data.tokens,
        user: data.user,
        company: data.company,
        companies: list.data ?? stored,
      });
      qc.invalidateQueries();
      toast.success(t('companySwitcher.switched', { name: data.company.name }));
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const items = list.data ?? stored;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('companies.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('companies.subtitle')}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="me-2 h-4 w-4" /> {t('companies.add')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('companies.listTitle')}</CardTitle>
          <CardDescription>{t('companies.listDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('companies.empty')}
            </p>
          ) : (
            <div className="divide-y">
              {items.map((c) => {
                const active = c.id === activeCompany?.id;
                return (
                  <div key={c.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-primary/10 p-2">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          {active && (
                            <Badge variant="default" className="gap-1">
                              <Check className="h-3 w-3" /> {t('companies.active')}
                            </Badge>
                          )}
                          {c.isDefault && (
                            <Badge variant="secondary">{t('companySwitcher.default')}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.taxRegistrationNumber
                            ? t('topbar.tin', { value: c.taxRegistrationNumber })
                            : ''}{' '}
                          · {t(`companies.role.${c.role}`)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={active ? 'outline' : 'default'}
                      size="sm"
                      disabled={active || switchTo.isPending}
                      onClick={() => switchTo.mutate(c.id)}
                    >
                      <ArrowRightLeft className="me-2 h-3.5 w-3.5" />
                      {active ? t('companies.current') : t('companies.switch')}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('companies.addTitle')}</DialogTitle>
            <DialogDescription>{t('companies.addDesc')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((v) => create.mutate(v))}
            className="space-y-3"
            id="add-company-form"
          >
            <div>
              <Label>{t('register.companyName')}</Label>
              <Input {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">{t('register.companyRequired')}</p>
              )}
            </div>
            <div>
              <Label>{t('register.taxNumber')}</Label>
              <Input {...register('taxRegistrationNumber')} />
              {errors.taxRegistrationNumber && (
                <p className="text-xs text-destructive">{t('register.taxRequired')}</p>
              )}
            </div>
            <div>
              <Label>{t('companies.nameEn')}</Label>
              <Input {...register('nameEn')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('settings.email')}</Label>
                <Input type="email" {...register('email')} />
              </div>
              <div>
                <Label>{t('settings.phone')}</Label>
                <Input {...register('phone')} />
              </div>
            </div>
            <div>
              <Label>{t('settings.address')}</Label>
              <Input {...register('address')} />
            </div>

            <div className="space-y-3 border-t pt-3">
              <div>
                <p className="text-sm font-medium">{t('companies.etaSection')}</p>
                <p className="text-xs text-muted-foreground">{t('companies.etaHint')}</p>
              </div>
              <div>
                <Label>{t('settings.etaClientId')}</Label>
                <Input {...register('etaClientId')} />
                {errors.etaClientId && (
                  <p className="text-xs text-destructive">
                    {t('companies.etaBothRequired')}
                  </p>
                )}
              </div>
              <div>
                <Label>{t('settings.etaClientSecret')}</Label>
                <Input type="password" {...register('etaClientSecret')} />
              </div>
              <div>
                <Label>{t('settings.environment')}</Label>
                <Select
                  value={watch('etaEnvironment')}
                  onValueChange={(v) => setValue('etaEnvironment', v as 'preprod' | 'production')}
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
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="add-company-form"
              disabled={create.isPending}
            >
              {create.isPending ? t('common.loading') : t('companies.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
