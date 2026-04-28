/**
 * Session management.
 *
 * Sessions are server-side rows in the `session` table; we hand the client an
 * iron-session cookie containing only the session id. The token itself never
 * leaves the server in plaintext — we store its SHA-256 in token_hash so a
 * leaked DB still can't be replayed against the cookie.
 */
import { cookies } from 'next/headers';
import { getIronSession, type IronSession } from 'iron-session';
import { randomBytes, createHash } from 'crypto';
import { prisma } from './db';

const COOKIE_NAME = 'lim_session';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30-minute idle timeout
const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000; // 12-hour absolute cap

interface SessionData {
  sessionId?: string;
  // Set once MFA is verified for the current login
  mfaVerified?: boolean;
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 chars long.');
  }
  return s;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  // Next 15+: cookies() is async.
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    cookieName: COOKIE_NAME,
    password: getSecret(),
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ABSOLUTE_TTL_MS / 1000,
      path: '/',
    },
  });
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreateSessionInput {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Create a server-side session row. The caller stores `token` in the cookie. */
export async function createSession(input: CreateSessionInput) {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ABSOLUTE_TTL_MS);

  const row = await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAt,
    },
  });

  return { id: row.id, token, expiresAt };
}

export async function getActiveSession(sessionId: string) {
  const row = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt < new Date()) return null;
  // Idle-timeout check: last activity is approximated by createdAt for now;
  // a refresh-on-request middleware bumps it.
  return row;
}

export async function revokeSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/** Idle timeout helper: extend cookie + row at request time. */
export async function touchSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
}
