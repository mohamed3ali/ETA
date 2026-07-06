'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs from 'dayjs';
import {
  UsersRound,
  Plus,
  Copy,
  Trash2,
  ShieldOff,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useT } from '@/lib/i18n';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Role = 'owner' | 'admin' | 'accountant' | 'employee';
type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

interface Member {
  id: string;
  membershipId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isDefault: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  joinedAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  status: InviteStatus;
  token: string;
  inviteUrl: string;
  invitedByName: string | null;
  expiresAt: string | null;
  createdAt: string;
  acceptedAt: string | null;
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'accountant', 'employee']).default('accountant'),
  expiresInDays: z.coerce.number().int().min(1).max(60).default(14),
});
type InviteForm = z.infer<typeof inviteSchema>;

const roleBadgeTone = (r: Role): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (r) {
    case 'owner':
      return 'default';
    case 'admin':
      return 'destructive';
    case 'accountant':
      return 'secondary';
    default:
      return 'outline';
  }
};

const inviteStatusIcon = (s: InviteStatus) => {
  if (s === 'accepted') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (s === 'revoked' || s === 'expired') return <XCircle className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
};

const inviteStatusVariant = (
  s: InviteStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'accepted') return 'default';
  if (s === 'revoked' || s === 'expired') return 'destructive';
  return 'secondary';
};

export default function TeamPage() {
  const t = useT();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const canManage =
    me?.role === 'owner' || me?.role === 'admin';

  const members = useQuery({
    queryKey: ['team-members', company?.id],
    queryFn: async () =>
      (await api.get<{ data: Member[] }>('/team/members')).data.data,
    enabled: canManage,
  });

  const invites = useQuery({
    queryKey: ['team-invites', company?.id],
    queryFn: async () =>
      (await api.get<{ data: Invite[] }>('/team/invites')).data.data,
    enabled: canManage,
  });

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'accountant', expiresInDays: 14 },
  });

  const invite = useMutation({
    mutationFn: async (values: InviteForm) =>
      (await api.post<{ data: Invite }>('/team/invites', values)).data.data,
    onSuccess: (data) => {
      toast.success(t('team.invited'));
      setLastInviteUrl(data.inviteUrl);
      form.reset({ role: 'accountant', expiresInDays: 14, email: '' });
      qc.invalidateQueries({ queryKey: ['team-invites'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/team/invites/${id}/revoke`)).data,
    onSuccess: () => {
      toast.success(t('team.revoked'));
      qc.invalidateQueries({ queryKey: ['team-invites'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const changeRole = useMutation({
    mutationFn: async (vars: { userId: string; role: Role }) =>
      (await api.patch(`/team/members/${vars.userId}/role`, { role: vars.role })).data,
    onSuccess: () => {
      toast.success(t('team.roleUpdated'));
      qc.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) =>
      (await api.delete(`/team/members/${userId}`)).data,
    onSuccess: () => {
      toast.success(t('team.removed'));
      qc.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const pendingInvites = useMemo(
    () => (invites.data ?? []).filter((i) => i.status === 'pending'),
    [invites.data],
  );
  const historyInvites = useMemo(
    () => (invites.data ?? []).filter((i) => i.status !== 'pending'),
    [invites.data],
  );

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('team.linkCopied'));
    } catch {
      window.prompt(t('team.inviteCopy'), url);
    }
  };

  if (!canManage) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex items-center gap-3 p-6 text-sm">
            <ShieldOff className="h-6 w-6 text-destructive" />
            <span>{t('team.notAllowed')}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{t('team.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('team.subtitle')}</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="me-2 h-4 w-4" /> {t('team.invite')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('team.members')}</CardTitle>
          <CardDescription>{t('team.membersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('team.name')}</TableHead>
                <TableHead>{t('team.email')}</TableHead>
                <TableHead>{t('team.role')}</TableHead>
                <TableHead className="w-40 text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!members.isLoading && (members.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    {t('team.emptyMembers')}
                  </TableCell>
                </TableRow>
              )}
              {members.data?.map((m) => {
                const isSelf = m.id === me?.id;
                const isOwnerRow = m.role === 'owner';
                const adminEditingAdmin =
                  me?.role === 'admin' && (m.role === 'admin' || m.role === 'owner');
                const canEditRole = !isSelf && !isOwnerRow && !adminEditingAdmin;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.firstName} {m.lastName}{' '}
                      {isSelf && (
                        <span className="ms-1 text-xs text-muted-foreground">
                          ({t('team.you')})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{m.email}</TableCell>
                    <TableCell>
                      {canEditRole ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            changeRole.mutate({ userId: m.id, role: v as Role })
                          }
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t('companies.role.admin')}</SelectItem>
                            <SelectItem value="accountant">
                              {t('companies.role.accountant')}
                            </SelectItem>
                            <SelectItem value="employee">
                              {t('companies.role.employee')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={roleBadgeTone(m.role)}>
                          {t(`companies.role.${m.role}`)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {!isSelf && !isOwnerRow && !(me?.role === 'admin' && m.role === 'admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(t('team.removeConfirm'))) remove.mutate(m.id);
                          }}
                        >
                          <Trash2 className="me-1 h-3.5 w-3.5" /> {t('team.remove')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('team.pendingInvites')}</CardTitle>
          <CardDescription>{t('team.pendingInvitesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {invites.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : pendingInvites.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('team.emptyInvites')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.email')}</TableHead>
                  <TableHead>{t('team.role')}</TableHead>
                  <TableHead>{t('team.expiresAt')}</TableHead>
                  <TableHead>{t('team.invitedBy')}</TableHead>
                  <TableHead className="w-56 text-end">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeTone(i.role)}>
                        {t(`companies.role.${i.role}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {i.expiresAt ? dayjs(i.expiresAt).format('YYYY-MM-DD') : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{i.invitedByName ?? '—'}</TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(i.inviteUrl)}
                      >
                        <Copy className="me-1 h-3.5 w-3.5" /> {t('team.inviteCopy')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => revoke.mutate(i.id)}
                      >
                        <ShieldOff className="me-1 h-3.5 w-3.5" /> {t('team.revoke')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {historyInvites.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {t('team.invite.statusAccepted')} / {t('team.invite.statusRevoked')} /{' '}
                {t('team.invite.statusExpired')}
              </h3>
              <ul className="space-y-1 text-xs">
                {historyInvites.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded border bg-muted/30 px-3 py-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {i.email}{' '}
                      <Badge
                        variant={inviteStatusVariant(i.status)}
                        className="ms-1 gap-1"
                      >
                        {inviteStatusIcon(i.status)}
                        {t(
                          `team.invite.status${
                            i.status.charAt(0).toUpperCase() + i.status.slice(1)
                          }`,
                        )}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">
                      {dayjs(i.createdAt).format('YYYY-MM-DD')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o);
          if (!o) setLastInviteUrl(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('team.inviteTitle')}</DialogTitle>
            <DialogDescription>
              {t('team.inviteDesc', { company: company?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <form
            id="invite-form"
            onSubmit={form.handleSubmit((v) => invite.mutate(v))}
            className="space-y-3"
          >
            <div>
              <Label>{t('team.email')}</Label>
              <Input type="email" autoFocus {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('team.role')}</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(v) => form.setValue('role', v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t('companies.role.admin')}</SelectItem>
                    <SelectItem value="accountant">
                      {t('companies.role.accountant')}
                    </SelectItem>
                    <SelectItem value="employee">
                      {t('companies.role.employee')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('team.expiresInDays')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  {...form.register('expiresInDays', { valueAsNumber: true })}
                />
              </div>
            </div>
          </form>

          {lastInviteUrl && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="mb-2 text-muted-foreground">{t('team.linkCopyManual')}</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={lastInviteUrl} className="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(lastInviteUrl)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="invite-form" disabled={invite.isPending}>
              {invite.isPending ? t('common.loading') : t('team.invite')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
