'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DSDLogo } from '@/components/dsd-logo';

export default function MfaPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Verification failed');
        return;
      }
      router.push('/dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-eggshell px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <DSDLogo size={220} />
        </div>
        <div className="rounded-lg border border-sand bg-cream p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-medium text-slate">Two-step verification</h1>
          <p className="mb-6 text-sm text-moss">
            Enter the 6-digit code from your authenticator app.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={busy}
                maxLength={8}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
