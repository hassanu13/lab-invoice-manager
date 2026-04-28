import { NextResponse } from 'next/server';
import { getSession, revokeSession } from '@/lib/session';
import { audit } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/authorize';

export async function POST() {
  const session = await getSession();
  if (session.sessionId) {
    await revokeSession(session.sessionId);
    await audit({
      action: 'login', // semantic 'logout' isn't in the enum; entityType narrows it
      entityType: 'session_logout',
      entityId: session.sessionId,
      ipAddress: await getClientIp(),
      userAgent: await getUserAgent(),
    });
  }
  session.destroy();
  return NextResponse.json({ ok: true });
}
