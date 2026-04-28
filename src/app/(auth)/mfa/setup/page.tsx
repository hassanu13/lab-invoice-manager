'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DSDLogo } from '@/components/dsd-logo';

interface SetupData {
  secret: string;
  otpauth: string;
  qrDataUrl: string;
}

export default function MfaSetupPage() {
  const router = useRouter();
  const [data, setData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/mfa/setup')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j: SetupData) => setData(j))
      .catch(() => setError('Could not start enrolment'));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/setup', {
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
          <h1 className="mb-1 text-xl font-medium text-slate">Set up two-step verification</h1>
          <p className="mb-6 text-sm text-moss">
            Scan this QR code with Google Authenticator, 1Password, or any TOTP app, then enter
            the 6-digit code to confirm.
          </p>
          {data ? (
            <>
              <div className="mb-4 flex justify-center rounded-md bg-eggshell p-4">
                <Image
                  src={data.qrDataUrl}
                  alt="MFA QR code"
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>
              <p className="mb-6 break-all text-center text-xs text-moss">
                Manual key: <span className="font-mono">{data.secret}</span>
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code">6-digit code</Label>
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
                  {busy ? 'Confirming…' : 'Confirm and finish'}
                </Button>
              </form>
            </>
          ) : (
            <p className="text-sm text-moss">Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}
