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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFormatters, useT } from '@/lib/i18n';

type ProductKind = 'product' | 'service';

const schema = z.object({
  kind: z.enum(['product', 'service']).default('product'),
  sku: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(14),
  unitType: z.string().min(1).default('EA'),
  etaItemCode: z.string().optional().or(z.literal('')),
  etaCodeType: z.enum(['GS1', 'EGS']).default('GS1'),
});
type FormValues = z.infer<typeof schema>;

interface Product extends FormValues {
  id: string;
}

export default function ProductsPage() {
  const t = useT();
  const { formatCurrency } = useFormatters();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ProductKind>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ['products', search, kindFilter],
    queryFn: async () =>
      (
        await api.get('/products', {
          params: {
            search: search || undefined,
            kind: kindFilter === 'all' ? undefined : kindFilter,
            limit: 50,
          },
        })
      ).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { unitType: 'EA', taxRate: 14, etaCodeType: 'GS1' },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ kind: 'product', unitType: 'EA', taxRate: 14, etaCodeType: 'GS1' });
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    reset(p as any);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload: any = { ...v };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      if (editing) return (await api.patch(`/products/${editing.id}`, payload)).data;
      return (await api.post('/products', payload)).data;
    },
    onSuccess: () => {
      toast.success(editing ? t('products.updated') : t('products.created'));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('products.failed')),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/products/${id}`)).data,
    onSuccess: () => {
      toast.success(t('products.deleted'));
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('products.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('products.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" /> {t('products.new')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-72 max-w-full">
              <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
                placeholder={t('products.searchPh')}
              />
            </div>
            <Select
              value={kindFilter}
              onValueChange={(v) => setKindFilter(v as 'all' | ProductKind)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('products.kind.all')}</SelectItem>
                <SelectItem value="product">{t('products.kind.product')}</SelectItem>
                <SelectItem value="service">{t('products.kind.service')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('products.col.kind')}</TableHead>
                <TableHead>{t('products.col.sku')}</TableHead>
                <TableHead>{t('products.col.name')}</TableHead>
                <TableHead>{t('products.col.etaCode')}</TableHead>
                <TableHead>{t('products.col.unit')}</TableHead>
                <TableHead className="text-end">{t('products.col.price')}</TableHead>
                <TableHead className="text-end">{t('products.col.vat')}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {query.data?.items?.map((p: Product) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Badge variant={p.kind === 'service' ? 'secondary' : 'outline'}>
                      {t(`products.kind.${p.kind ?? 'product'}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.etaItemCode ?? '—'}</TableCell>
                  <TableCell>{p.unitType}</TableCell>
                  <TableCell className="text-end">{formatCurrency(p.unitPrice)}</TableCell>
                  <TableCell className="text-end">{Number(p.taxRate)}%</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(t('products.deleteConfirm'))) del.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!query.isLoading && (query.data?.items?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    {t('products.empty')}
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
            <DialogTitle>{editing ? t('products.edit') : t('products.new')}</DialogTitle>
            <DialogDescription>{t('products.dialogDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-3">
            <div>
              <Label>{t('products.kind.label')}</Label>
              <Select
                value={watch('kind') ?? 'product'}
                onValueChange={(v) => setValue('kind', v as ProductKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">{t('products.kind.product')}</SelectItem>
                  <SelectItem value="service">{t('products.kind.service')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('products.kind.hint')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sku">{t('products.sku')}</Label>
                <Input id="sku" {...register('sku')} />
                {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
              </div>
              <div>
                <Label htmlFor="name">{t('products.name')}</Label>
                <Input id="name" {...register('name')} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="unitPrice">{t('products.unitPrice')}</Label>
                <Input id="unitPrice" type="number" step="0.01" {...register('unitPrice')} />
              </div>
              <div>
                <Label htmlFor="taxRate">{t('products.taxRate')}</Label>
                <Input id="taxRate" type="number" step="0.01" {...register('taxRate')} />
              </div>
              <div>
                <Label htmlFor="unitType">{t('products.unitType')}</Label>
                <Input id="unitType" {...register('unitType')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="etaItemCode">{t('products.etaItemCode')}</Label>
                <Input id="etaItemCode" {...register('etaItemCode')} />
              </div>
              <div>
                <Label>{t('products.codeType')}</Label>
                <Select
                  value={watch('etaCodeType')}
                  onValueChange={(v) => setValue('etaCodeType', v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GS1">GS1</SelectItem>
                    <SelectItem value="EGS">EGS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {editing ? t('common.saveChanges') : t('products.new')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
