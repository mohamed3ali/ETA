'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/lib/i18n';

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(['B', 'P', 'F']).default('B'),
  taxRegistrationNumber: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

interface Customer extends FormValues {
  id: string;
  isActive: boolean;
}

export default function CustomersPage() {
  const t = useT();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ['customers', search],
    queryFn: async () =>
      (
        await api.get('/customers', {
          params: { search: search || undefined, limit: 50 },
        })
      ).data,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: 'B' } });

  const openCreate = () => {
    setEditing(null);
    reset({ type: 'B' });
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    reset({
      name: c.name,
      type: c.type,
      taxRegistrationNumber: c.taxRegistrationNumber ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: any = { ...values };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      if (editing) return (await api.patch(`/customers/${editing.id}`, payload)).data;
      return (await api.post('/customers', payload)).data;
    },
    onSuccess: () => {
      toast.success(editing ? t('customers.updated') : t('customers.created'));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('customers.failed')),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/customers/${id}`)).data,
    onSuccess: () => {
      toast.success(t('customers.deleted'));
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const typeLabel = (type: string) =>
    type === 'B' ? t('customers.type.B') : type === 'P' ? t('customers.type.P') : t('customers.type.F');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('customers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" /> {t('customers.new')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative w-72 max-w-full">
              <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('customers.searchPh')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('customers.col.name')}</TableHead>
                <TableHead>{t('customers.col.type')}</TableHead>
                <TableHead>{t('customers.col.taxReg')}</TableHead>
                <TableHead>{t('customers.col.email')}</TableHead>
                <TableHead>{t('customers.col.phone')}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {query.data?.items?.map((c: Customer) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{typeLabel(c.type)}</TableCell>
                  <TableCell>{c.taxRegistrationNumber ?? '—'}</TableCell>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell>{c.phone ?? '—'}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(t('customers.deleteConfirm'))) del.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!query.isLoading && (query.data?.items?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {t('customers.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('customers.edit') : t('customers.new')}</DialogTitle>
            <DialogDescription>{t('customers.dialogDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-3">
            <div>
              <Label htmlFor="name">{t('customers.name')}</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">{t('customers.nameRequired')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('customers.type')}</Label>
                <Select value={watch('type')} onValueChange={(v) => setValue('type', v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B">{t('customers.type.B')}</SelectItem>
                    <SelectItem value="P">{t('customers.type.P')}</SelectItem>
                    <SelectItem value="F">{t('customers.type.F')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="taxRegistrationNumber">{t('customers.taxReg')}</Label>
                <Input id="taxRegistrationNumber" {...register('taxRegistrationNumber')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email">{t('customers.email')}</Label>
                <Input id="email" type="email" {...register('email')} />
              </div>
              <div>
                <Label htmlFor="phone">{t('customers.phone')}</Label>
                <Input id="phone" {...register('phone')} />
              </div>
            </div>
            <div>
              <Label htmlFor="address">{t('customers.address')}</Label>
              <Input id="address" {...register('address')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {editing ? t('common.saveChanges') : t('customers.new')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
