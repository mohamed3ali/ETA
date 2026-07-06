'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';

import { api } from '@/lib/api';
import { useAuthStore, AccessibleCompany } from '@/store/auth-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

export function CompanySwitcher() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const company = useAuthStore((s) => s.company);
  const companies = useAuthStore((s) => s.companies);
  const setSession = useAuthStore((s) => s.setSession);
  const setCompanies = useAuthStore((s) => s.setCompanies);

  // Always source the canonical list from the server so newly created
  // companies show up even if the persisted store is stale.
  const list = useQuery({
    queryKey: ['accessible-companies'],
    queryFn: async () =>
      (await api.get<{ data: AccessibleCompany[] }>('/companies/mine')).data.data,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (list.data) setCompanies(list.data);
  }, [list.data, setCompanies]);

  const switchTo = useMutation({
    mutationFn: async (companyId: string) =>
      (await api.post('/auth/switch-company', { companyId })).data.data,
    onSuccess: (data) => {
      setSession({
        tokens: data.tokens,
        user: data.user,
        company: data.company,
        companies,
      });
      // Reload all data scoped to the previous company.
      qc.invalidateQueries();
      toast.success(t('companySwitcher.switched', { name: data.company.name }));
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message ?? t('common.tryAgain')),
  });

  const items = companies.length > 0 ? companies : list.data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <Building2 className="h-4 w-4 text-primary" />
          <div className="hidden text-start sm:block">
            <p className="text-sm font-medium leading-none">
              {company?.name ?? t('topbar.myCompany')}
            </p>
            {company?.taxRegistrationNumber && (
              <p className="text-xs text-muted-foreground">
                {t('topbar.tin', { value: company.taxRegistrationNumber })}
              </p>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t('companySwitcher.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((c) => {
          const active = c.id === company?.id;
          return (
            <DropdownMenuItem
              key={c.id}
              disabled={switchTo.isPending || active}
              onClick={() => !active && switchTo.mutate(c.id)}
              className="flex items-start gap-2"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.isDefault && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {t('companySwitcher.default')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.taxRegistrationNumber
                    ? t('topbar.tin', { value: c.taxRegistrationNumber })
                    : c.role}
                </p>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/companies')}>
          <Plus className="me-2 h-4 w-4" />
          {t('companySwitcher.manage')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
