import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser, requireRole } from '@/lib/authorize';
import { DSDLogo } from '@/components/dsd-logo';
import { Button } from '@/components/ui/button';

export default async function UsersAdminPage() {
  const me = await requireUser();
  requireRole(me, ['operations', 'finance']);

  const [users, sites] = await Promise.all([
    prisma.appUser.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        active: true,
        mfaEnrolled: true,
        lastLoginAt: true,
        siteRoles: { select: { role: true, site: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.site.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
  ]);

  return (
    <div className="min-h-screen bg-eggshell">
      <header className="border-b border-sand bg-cream">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/dashboard">
            <DSDLogo size={160} />
          </Link>
          <Link href="/dashboard" className="text-sm text-moss hover:text-slate">
            ← Dashboard
          </Link>
        </div>
      </header>
      <main className="container py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-medium text-slate">Users</h1>
            <p className="text-sm text-moss">{sites.length} site(s) configured.</p>
          </div>
          <Link href="/admin/users/new">
            <Button>New user</Button>
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-sand bg-cream">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-left text-xs uppercase tracking-wide text-moss">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">MFA</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {users.map((u) => (
                <tr key={u.id} className="text-slate">
                  <td className="px-4 py-3 font-medium">{u.fullName}</td>
                  <td className="px-4 py-3 text-moss">{u.email}</td>
                  <td className="px-4 py-3 text-xs">
                    {u.siteRoles
                      .map((r) => `${r.role}${r.site ? ` @ ${r.site.slug}` : ' (group)'}`)
                      .join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    {u.mfaEnrolled ? (
                      <span className="text-confidence-high">enrolled</span>
                    ) : (
                      <span className="text-confidence-medium">pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-moss">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="text-confidence-high">active</span>
                    ) : (
                      <span className="text-confidence-low">deactivated</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
