import { requireUser } from '@/lib/authorize';
import { Button } from '@/components/ui/button';
import { DSDLogo } from '@/components/dsd-logo';
import Link from 'next/link';

// Brand: cream (#ECDFD2) page background, dark slate (#39393B) text and surfaces.
// Eggshell (#F1EFE9) reserved for interior surfaces (stat cards) so they read against
// the cream page; sand (#D2C6B5) for hairline borders. Faded moss (#A19F92) for
// secondary copy. All values per DSD brand guidelines v1, page 20.
export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.roles.some((r) => r.role === 'operations' || r.role === 'finance');

  return (
    <div className="min-h-screen bg-cream text-slate">
      <header className="border-b border-sand bg-cream">
        <div className="container flex h-16 items-center justify-between">
          <DSDLogo size={160} />
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate/70">{user.fullName}</span>
            <form action="/api/auth/logout" method="POST">
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="container py-12">
        <h1 className="mb-2 text-2xl font-medium text-slate">
          Welcome back, {user.fullName.split(' ')[0]}.
        </h1>
        <p className="mb-6 text-slate/60">
          Phase 1, Week 2 — upload is live. Confirmation + reporting land in Weeks 3 and 4.
        </p>

        <div className="mb-10">
          <Link
            href="/uploads"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate px-4 text-sm font-medium text-eggshell transition-colors hover:bg-slate/90"
          >
            Upload an invoice →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Invoices awaiting you" value="—" hint="Wired up in Week 3" />
          <StatCard label="Outstanding (GBP)" value="—" hint="Wired up in Week 4" />
          <StatCard label="Spend MTD" value="—" hint="Wired up in Week 4" />
          <StatCard label="Overdue" value="—" hint="Wired up in Week 4" />
        </div>

        {isAdmin && (
          <div className="mt-10">
            <h2 className="mb-3 text-lg font-medium text-slate">Admin</h2>
            <Link
              href="/admin/users"
              className="inline-flex h-10 items-center justify-center rounded-md border border-sand bg-eggshell px-4 text-sm font-medium text-slate transition-colors hover:bg-eggshell/70"
            >
              Manage users
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-sand bg-eggshell p-5">
      <div className="text-xs uppercase tracking-wide text-slate/60">{label}</div>
      <div className="mt-2 text-2xl font-medium text-slate">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate/50">{hint}</div>}
    </div>
  );
}
