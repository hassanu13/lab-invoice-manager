import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateMfaSecret, buildOtpAuthUrl, buildMfaQrCodeDataUrl, verifyTotp } from '@/lib/auth';
import { getSession, getActiveSession } from '@/lib/session';

/**
 * Two-step MFA enrolment:
 *   GET  -> returns a fresh secret + QR code for the authenticator app.
 *   POST -> verifies the first code and persists `mfa_secret` + `mfa_enrolled`.
 *
 * The provisional secret is held in the iron-session cookie (encrypted) until
 * the user confirms with a valid code. That avoids writing an unverified
 * secret to the DB.
 */
export async function GET() {
  const session = await getSession();
  if (!session.sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const row = await getActiveSession(session.sessionId);
  if (!row) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.appUser.findUnique({ where: { id: row.userId } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const secret = generateMfaSecret();
  // stash on the session cookie until verified
  (session as unknown as { provisionalMfaSecret?: string }).provisionalMfaSecret = secret;
  await session.save();

  const otpauth = buildOtpAuthUrl({ email: user.email, secret });
  const qr = await buildMfaQrCodeDataUrl(otpauth);
  return NextResponse.json({ secret, otpauth, qrDataUrl: qr });
}

const verifySchema = z.object({ code: z.string().min(6).max(8) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const row = await getActiveSession(session.sessionId);
  if (!row) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const provisional = (session as unknown as { provisionalMfaSecret?: string })
    .provisionalMfaSecret;
  if (!provisional) {
    return NextResponse.json({ error: 'No enrolment in progress' }, { status: 400 });
  }
  if (!verifyTotp(provisional, parsed.data.code)) {
    return NextResponse.json({ error: 'Code did not match' }, { status: 400 });
  }

  await prisma.appUser.update({
    where: { id: row.userId },
    data: { mfaSecret: provisional, mfaEnrolled: true },
  });

  // promote the session to mfa-verified
  delete (session as unknown as { provisionalMfaSecret?: string }).provisionalMfaSecret;
  session.mfaVerified = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
