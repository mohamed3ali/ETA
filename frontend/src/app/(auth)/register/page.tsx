import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import { RegisterForm } from './register-form';

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex w-full max-w-md items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
