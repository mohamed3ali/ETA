'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BarChart3,
  Settings,
  Building2,
  Sparkles,
  ScrollText,
  Download,
  Repeat,
  Bell,
  Wallet,
  Receipt,
  ReceiptText,
  ClipboardList,
  Calculator,
  UsersRound,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/invoices', label: t('nav.invoices'), icon: FileText },
    { href: '/receipts', label: t('nav.receipts'), icon: ReceiptText },
    { href: '/invoices/recurring', label: t('nav.recurring'), icon: Repeat },
    { href: '/payments', label: t('nav.payments'), icon: Wallet },
    { href: '/customers', label: t('nav.customers'), icon: Users },
    { href: '/products', label: t('nav.products'), icon: Package },
    { href: '/firm', label: t('nav.firm'), icon: Briefcase },
    { href: '/companies', label: t('nav.companies'), icon: Building2 },
    { href: '/team', label: t('nav.team'), icon: UsersRound },
    { href: '/branches', label: t('nav.branches'), icon: Building2 },
    { href: '/alerts', label: t('nav.alerts'), icon: Bell },
    { href: '/eta-portal', label: t('nav.etaPortal'), icon: Download },
    { href: '/eta-reader', label: t('nav.etaReader'), icon: ScrollText },
    { href: '/vat-return', label: t('nav.vatReturn'), icon: Receipt },
    { href: '/form41', label: t('nav.form41'), icon: ClipboardList },
    { href: '/tax-calculator', label: t('nav.taxCalculator'), icon: Calculator },
    { href: '/reports', label: t('nav.reports'), icon: BarChart3 },
    { href: '/assistant', label: t('nav.assistant'), icon: Sparkles },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  // Longest-prefix match so child routes (e.g. /invoices/recurring) don't also
  // highlight the parent (/invoices).
  const activeHref = navItems
    .map((it) => it.href)
    .filter((h) =>
      h === '/dashboard' ? pathname === '/dashboard' : pathname === h || pathname.startsWith(h + '/'),
    )
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="hidden h-full border-e bg-card/50 backdrop-blur-sm md:flex md:w-64 md:flex-col">
      <div className="flex h-16 shrink-0 items-center border-b px-5">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-indigo-600 to-violet-600 text-primary-foreground shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight">
            ETA<span className="text-gradient-hero">{t('brand.suffix')}</span>
          </span>
        </Link>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className={cn('h-4 w-4', active && 'text-primary')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5" />
          <span>{t('common.multiTenant')}</span>
        </div>
      </div>
    </aside>
  );
}
