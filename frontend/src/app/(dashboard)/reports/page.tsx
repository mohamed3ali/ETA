'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Download } from 'lucide-react';

import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatters, useT } from '@/lib/i18n';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ReportsPage() {
  const t = useT();
  const { formatCurrency } = useFormatters();

  const trend = useQuery({
    queryKey: ['reports-trend'],
    queryFn: async () =>
      (await api.get('/dashboard/revenue-by-month?months=12')).data.data as Array<{
        month: string;
        revenue: number;
        vat: number;
        count: number;
      }>,
  });

  const top = useQuery({
    queryKey: ['reports-top'],
    queryFn: async () =>
      (await api.get('/dashboard/top-customers?limit=10')).data.data as Array<{
        customerName: string;
        revenue: number;
        invoices: number;
      }>,
  });

  const downloadExcel = async () => {
    const res = await api.get('/invoices/export/excel', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={downloadExcel}>
          <Download className="me-2 h-4 w-4" /> {t('reports.exportAll')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.monthlyTitle')}</CardTitle>
          <CardDescription>{t('reports.monthlyDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {trend.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vat" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.topTitle')}</CardTitle>
          <CardDescription>{t('reports.topDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reports.col.customer')}</TableHead>
                <TableHead className="text-end">{t('reports.col.invoices')}</TableHead>
                <TableHead className="text-end">{t('reports.col.revenue')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {top.data?.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.customerName}</TableCell>
                  <TableCell className="text-end">{c.invoices}</TableCell>
                  <TableCell className="text-end">{formatCurrency(c.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
