/**
 * Authorisation helpers.
 *
 * Every API route and server action must call requireUser() before accessing
 * data. Site-scoping checks (Practice Manager only sees their own site) layer
 * on top via requireSiteAccess().
 *
 * If you find yourself reaching for a "skip auth" flag here, stop — there are
 * no exceptions in Phase 1.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { UserRole } from '@prisma/client';
import { prisma } from './db';
import { getSession, getActiveSession, hashToken, touchSession } from './session';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  mfaEnrolled: boolean;
  mfaVerified: boolean;
  roles: { siteId: string | null; role: UserRole }[];
}

/** Returns the user or null. Use this when the route may be public. */
export async function getUser(): Promise<AuthenticatedUser | null> {
  const session = await getSession();
  if (!session.sessionId) return null;

  const row = await getActiveSession(session.sessionId);
  if (!row) return null;

  const u = await prisma.appUser.findUnique({
    where: { id: row.userId },
    include: { siteRoles: true },
  });
  if (!u || !u.active) return null;

  // Touch session expiry on each successful auth check (idle timeout reset).
  await touchSession(session.sessionId);

  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    mfaEnrolled: u.mfaEnrolled,
    mfaVerified: !!session.mfaVerified,
    roles: u.siteRoles.map((r) => ({ siteId: r.siteId, role: r.role })),
  };
}

/** Returns the user, redirecting to /login if unauthenticated. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const u = await getUser();
  if (!u) redirect('/login');
  if (u.mfaEnrolled && !u.mfaVerified) redirect('/mfa');
  return u;
}

/** Throws if the user does not have any of the given roles, optionally site-scoped. */
export function requireRole(
  user: AuthenticatedUser,
  roles: UserRole[],
  opts?: { siteId?: string },
) {
  const matches = user.roles.some(
    (r) =>
      roles.includes(r.role) &&
      (opts?.siteId == null || r.siteId == null || r.siteId === opts.siteId),
  );
  if (!matches) {
    const e = new Error('Forbidden');
    (e as Error & { status?: number }).status = 403;
    throw e;
  }
}

export async function getClientIp(): Promise<string | undefined> {
  // Next 15+: headers() is async.
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? undefined;
}

export async function getUserAgent(): Promise<string | undefined> {
  const h = await headers();
  return h.get('user-agent') ?? undefined;
}

// Suppress unused-export-var lint complaints on the helper used elsewhere.
export { hashToken };
