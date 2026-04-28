'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Role = 'practice_manager' | 'clinician' | 'operations' | 'finance' | 'slt';

interface SiteOption {
  id: string;
  name: string;
  slug: string;
}

const GROUP_ROLES: Role[] = ['finance', 'slt'];

export function NewUserForm({ sites }: { sites: SiteOption[] }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('practice_manager');
  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGroupRole = GROUP_ROLES.includes(role);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          phone: phone || null,
          password,
          roles: [{ siteId: isGroupRole ? null : siteId, role }],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Failed to create user');
        return;
      }
      router.push('/admin/users');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-sand bg-cream p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Initial password (≥12 chars)</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="flex h-10 w-full rounded-md border border-input bg-eggshell px-3 text-sm text-slate"
          >
            <option value="practice_manager">Practice Manager</option>
            <option value="clinician">Clinician</option>
            <option value="operations">Operations</option>
            <option value="finance">Finance (group-wide)</option>
            <option value="slt">SLT (group-wide, read-only)</option>
          </select>
        </div>
        {!isGroupRole && (
          <div className="space-y-1.5">
            <Label htmlFor="siteId">Site</Label>
            <select
              id="siteId"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-eggshell px-3 text-sm text-slate"
              required
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create user'}
        </Button>
      </div>
    </form>
  );
}
