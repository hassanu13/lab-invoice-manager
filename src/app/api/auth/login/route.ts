import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, recordFailedLogin, clearFailedLogins, isLocked } from '@/lib/auth';
import { createSession } from '@/lib/session';
import { getSession } from '@/lib/session';
import { audit } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/authorize';

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const ip = await getClientIp();
  const ua = await getUserAgent();

  // Always hash a dummy when the user doesn't exist to avoid timing leaks.
  const user = await prisma.appUser.findUnique({ where: { email } });
  const ok = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$ZmFrZXNhbHQAAAAAAAAA$decoyDecoyDecoyDecoyDecoyDecoyDecoyDecoy',
        password,
      ).catch(() => false);

  if (!user || !user.active || !ok) {
    if (user) await recordFailedLogin(user.id);
    await audit({
      actorUserId: user?.id ?? null,
      action: 'login_failed',
      entityType: 'app_user',
      entityId: user?.id ?? null,
      ipAddress: ip,
      userAgent: ua,
      details: { email },
    });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  if (isLocked(user)) {
    return NextResponse.json(
      { error: 'Account temporarily locked. Try again later.' },
      { status: 423 },
    );
  }

  await clearFailedLogins(user.id);

  const created = await createSession({ userId: user.id, ipAddress: ip, userAgent: ua });
  const session = await getSession();
  session.sessionId = created.id;
  session.mfaVerified = false; // require MFA step next if enrolled
  await session.save();

  await audit({
    actorUserId: user.id,
    action: 'login',
    entityType: 'app_user',
    entityId: user.id,
    ipAddress: ip,
    userAgent: ua,
  });

  return NextResponse.json({
    next: user.mfaEnrolled ? 'mfa' : 'mfa_setup',
  });
}
