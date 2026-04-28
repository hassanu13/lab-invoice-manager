import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser, requireRole, getClientIp, getUserAgent } from '@/lib/authorize';
import { hashPassword } from '@/lib/auth';
import { audit } from '@/lib/audit';

const createSchema = z.object({
  email: z.string().email().max(254),
  fullName: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(12).max(256),
  roles: z
    .array(
      z.object({
        siteId: z.string().uuid().nullable(),
        role: z.enum(['practice_manager', 'clinician', 'operations', 'finance', 'slt']),
      }),
    )
    .min(1)
    .max(20),
});

export async function GET() {
  const user = await requireUser();
  requireRole(user, ['operations', 'finance']);
  const list = await prisma.appUser.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      active: true,
      mfaEnrolled: true,
      lastLoginAt: true,
      siteRoles: { select: { role: true, siteId: true } },
    },
    orderBy: { fullName: 'asc' },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const user = await requireUser();
  requireRole(user, ['operations']); // only Ops can create users in Phase 1
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }
  const { email, fullName, phone, password, roles } = parsed.data;

  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 });
  }

  const hash = await hashPassword(password);
  const created = await prisma.appUser.create({
    data: {
      email,
      fullName,
      phone: phone ?? null,
      passwordHash: hash,
      siteRoles: { create: roles },
    },
    select: { id: true, email: true, fullName: true },
  });

  await audit({
    actorUserId: user.id,
    action: 'create',
    entityType: 'app_user',
    entityId: created.id,
    ipAddress: await getClientIp(),
    userAgent: await getUserAgent(),
    details: { email, roles },
  });

  return NextResponse.json(created, { status: 201 });
}
