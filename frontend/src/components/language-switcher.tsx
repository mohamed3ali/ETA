'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/i18n';

interface Props {
  variant?: 'ghost' | 'outline';
  showLabel?: boolean;
}

export function LanguageSwitcher({ variant = 'ghost', showLabel = false }: Props) {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={showLabel ? 'sm' : 'icon'} className="gap-2">
          <Languages className="h-4 w-4" />
          {showLabel && <span>{locale === 'ar' ? 'العربية' : 'English'}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLocale('ar')}
          className={locale === 'ar' ? 'font-semibold' : ''}
        >
          {t('common.arabic')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocale('en')}
          className={locale === 'en' ? 'font-semibold' : ''}
        >
          {t('common.english')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
