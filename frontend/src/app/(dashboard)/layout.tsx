import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { AuthGate } from '@/components/dashboard/auth-gate';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="relative flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">
            <div className="pointer-events-none absolute inset-0 landing-grid-bg opacity-[0.25]" />
            <div className="relative">{children}</div>
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
