'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useT } from '@/lib/i18n';

interface Branch {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  governorate?: string;
  phone?: string;
  isActive: boolean;
}

const blank = { code: '', name: '', address: '', city: '', governorate: '', phone: '' };

export default function BranchesPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ ...blank });

  const query = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get<{ data: Branch[] }>('/branches')).data.data,
  });

  const open_new = () => {
    setEditing(null);
    setForm({ ...blank });
    setOpen(true);
  };
  const open_edit = (b: Branch) => {
    setEditing(b);
    setForm({
      code: b.code,
      name: b.name,
      address: b.address ?? '',
      city: b.city ?? '',
      governorate: b.governorate ?? '',
      phone: b.phone ?? '',
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { ...form };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      if (editing) {
        return (await api.patch(`/branches/${editing.id}`, payload)).data;
      }
      return (await api.post('/branches', payload)).data;
    },
    onSuccess: () => {
      toast.success(editing ? t('branches.updated') : t('branches.created'));
      qc.invalidateQueries({ queryKey: ['branches'] });
      setOpen(false);
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('branches.failed')),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/branches/${id}`)).data,
    onSuccess: () => {
      toast.success(t('branches.deleted'));
      qc.invalidateQueries({ queryKey: ['branches'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('branches.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('branches.subtitle')}</p>
        </div>
        <Button onClick={open_new}>
          <Plus className="me-2 h-4 w-4" /> {t('branches.new')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('branches.col.code')}</TableHead>
                <TableHead>{t('branches.col.name')}</TableHead>
                <TableHead>{t('branches.col.city')}</TableHead>
                <TableHead>{t('branches.col.phone')}</TableHead>
                <TableHead>{t('branches.col.state')}</TableHead>
                <TableHead className="text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {query.data?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {b.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[b.city, b.governorate].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.phone ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={b.isActive ? 'success' : 'muted'}>
                      {b.isActive ? t('branches.active') : t('branches.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => open_edit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(t('branches.deleteConfirm'))) del.mutate(b.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {t('branches.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('branches.edit') : t('branches.new')}</DialogTitle>
            <DialogDescription>{t('branches.dialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('branches.code')}</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>{t('branches.name')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{t('branches.address')}</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('branches.city')}</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('branches.governorate')}</Label>
                <Input
                  value={form.governorate}
                  onChange={(e) => setForm({ ...form, governorate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{t('branches.phone')}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.code || !form.name}
            >
              {editing ? t('common.saveChanges') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
