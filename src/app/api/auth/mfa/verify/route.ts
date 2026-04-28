import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyTotp } from '@/lib/auth';
import { getSession, getActiveSession } from '@/lib/session';

const schema = z.object({ code: z.string().min(6).max(8) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const row = await getActiveSession(session.sessionId);
  if (!row) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const u = await prisma.appUser.findUnique({ where: { id: row.userId } });
  if (!u || !u.mfaEnrolled || !u.mfaSecret) {
    return NextResponse.json({ error: 'MFA not enrolled' }, { status: 400 });
  }
  if (!verifyTotp(u.mfaSecret, parsed.data.code)) {
    return NextResponse.json({ error: 'Code did not match' }, { status: 400 });
  }

  session.mfaVerified = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
