import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser, requireRole, getClientIp, getUserAgent } from '@/lib/authorize';
import { audit } from '@/lib/audit';

const patchSchema = z.object({
  active: z.boolean().optional(),
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const user = await requireUser();
  requireRole(user, ['operations']);
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const updated = await prisma.appUser.update({
    where: { id: ctx.params.id },
    data: parsed.data,
    select: { id: true, active: true, fullName: true, phone: true },
  });

  await audit({
    actorUserId: user.id,
    action: 'update',
    entityType: 'app_user',
    entityId: updated.id,
    ipAddress: await getClientIp(),
    userAgent: await getUserAgent(),
    details: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}
