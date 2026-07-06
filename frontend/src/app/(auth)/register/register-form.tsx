'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useT } from '@/lib/i18n';

const schema = z.object({
  companyName: z.string().min(2),
  taxRegistrationNumber: z.string().min(5),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
type FormValues = z.infer<typeof schema>;

const PAID_PLANS = ['starter', 'professional', 'enterprise'];

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const t = useT();
  const setSession = useAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const res = await api.post('/auth/register', values);
      const payload = res.data.data;
      setSession({
        tokens: payload.tokens,
        user: payload.user,
        company: payload.company,
        companies: payload.companies,
      });
      toast.success(t('register.welcome'));
      if (plan && PAID_PLANS.includes(plan)) {
        router.push(`/checkout?plan=${plan}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? t('register.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
        <CardDescription>{t('register.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">{t('register.companyName')}</Label>
            <Input id="companyName" {...register('companyName')} />
            {errors.companyName && (
              <p className="text-xs text-destructive">{t('register.companyRequired')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxRegistrationNumber">{t('register.taxNumber')}</Label>
            <Input id="taxRegistrationNumber" {...register('taxRegistrationNumber')} />
            {errors.taxRegistrationNumber && (
              <p className="text-xs text-destructive">{t('register.taxRequired')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('register.firstName')}</Label>
              <Input id="firstName" {...register('firstName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t('register.lastName')}</Label>
              <Input id="lastName" {...register('lastName')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('login.email')}</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('login.password')}</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && (
              <p className="text-xs text-destructive">{t('register.passwordMin')}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('register.cta')}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('register.haveAccount')}{' '}
            <Link className="text-primary hover:underline" href="/login">
              {t('common.signIn')}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
