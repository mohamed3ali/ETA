'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { LanguageProvider, useI18n } from '@/lib/i18n';

function LocalizedToaster() {
  const { dir } = useI18n();
  return <Toaster richColors position={dir === 'rtl' ? 'top-left' : 'top-right'} dir={dir} />;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <LocalizedToaster />
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
