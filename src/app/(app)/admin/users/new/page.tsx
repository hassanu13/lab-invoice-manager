import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser, requireRole } from '@/lib/authorize';
import { DSDLogo } from '@/components/dsd-logo';
import { NewUserForm } from './new-user-form';

export default async function NewUserPage() {
  const me = await requireUser();
  requireRole(me, ['operations']);
  const sites = await prisma.site.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="min-h-screen bg-eggshell">
      <header className="border-b border-sand bg-cream">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/dashboard">
            <DSDLogo size={160} />
          </Link>
          <Link href="/admin/users" className="text-sm text-moss hover:text-slate">
            ← Users
          </Link>
        </div>
      </header>
      <main className="container max-w-2xl py-10">
        <h1 className="mb-6 text-2xl font-medium text-slate">New user</h1>
        <NewUserForm sites={sites} />
      </main>
    </div>
  );
}
