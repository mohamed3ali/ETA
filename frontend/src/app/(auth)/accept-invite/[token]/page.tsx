'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useT } from '@/lib/i18n';

interface InvitePreview {
  token: string;
  email: string;
  role: 'owner' | 'admin' | 'accountant' | 'employee';
  expiresAt: string | null;
  needsAccount: boolean;
  company: {
    id: string;
    name: string;
    taxRegistrationNumber: string;
  } | null;
}

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const t = useT();
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');

  const preview = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: async () =>
      (await api.get<{ data: InvitePreview }>(`/public/invites/${token}`)).data.data,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const body: any = { token };
      if (preview.data?.needsAccount) {
        body.firstName = firstName;
        body.lastName = lastName;
        body.password = password;
      }
      return (await api.post('/public/invites/accept', body)).data.data;
    },
    onSuccess: (data) => {
      setSession({
        tokens: data.tokens,
        user: data.user,
        company: data.company,
      });
      toast.success(
        t('accept.success', { company: preview.data?.company?.name ?? '' }),
      );
      router.replace('/dashboard');
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('accept.failed')),
  });

  if (preview.isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('accept.invalidToken')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t('common.login')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const invite = preview.data;
  const company = invite.company;
  const wrongUser = me && me.email.toLowerCase() !== invite.email.toLowerCase();
  const canAccept =
    !wrongUser &&
    (!invite.needsAccount || (firstName && lastName && password.length >= 8));

  return (
    <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t('accept.title', { company: company?.name ?? '' })}
        </CardTitle>
        <CardDescription>
          {t('accept.subtitle', {
            company: company?.name ?? '',
            role: t(`companies.role.${invite.role}`),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">{t('team.email')}:</span>{' '}
            <span className="font-mono">{invite.email}</span>
          </p>
          {invite.expiresAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('team.expiresAt')}: {new Date(invite.expiresAt).toLocaleString()}
            </p>
          )}
        </div>

        {wrongUser ? (
          <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {t('accept.wrongEmail', { email: invite.email })}
          </p>
        ) : me ? (
          <p className="text-xs text-muted-foreground">
            {t('accept.signedInAs', { email: me.email })}
          </p>
        ) : invite.needsAccount ? (
          <div className="space-y-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {t('accept.needsAccount', { email: invite.email })}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('accept.firstName')}</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>{t('accept.lastName')}</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t('accept.password')}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <p className="rounded border bg-muted/40 p-2 text-xs">
            {t('accept.alreadyHasAccount')}{' '}
            <Link href={`/login?next=/accept-invite/${token}`} className="text-primary underline">
              {t('accept.signIn')}
            </Link>
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={!canAccept || accept.isPending}
          onClick={() => accept.mutate()}
        >
          {accept.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t('accept.acceptBtn')}
        </Button>
      </CardFooter>
    </Card>
  );
}
