'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-primary via-blue-600 to-indigo-700 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <span className="rounded-md bg-white/20 px-2 py-1">ETA</span>
          <span>{t('brand.suffix')}</span>
        </Link>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold">{t('auth.side.title')}</h2>
          <p className="text-white/80">{t('auth.side.sub')}</p>
        </div>
        <p className="text-sm text-white/60">© {new Date().getFullYear()} ETA SaaS</p>
      </div>
      <div className="relative flex items-center justify-center p-6">
        <div className="absolute end-4 top-4">
          <LanguageSwitcher />
        </div>
        {children}
      </div>
    </div>
  );
}
