/**
 * Authentication primitives:
 *  - Password hashing (argon2id)
 *  - TOTP MFA (otplib, RFC 6238)
 *  - Login attempt tracking + account lockout
 *
 * All functions here are pure server-side and safe for the Node runtime.
 * Lockout policy: 5 failed attempts -> 15-minute lock.
 */
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from './db';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

authenticator.options = { window: 1, step: 30 };

// -----------------------------------------------------------------------------
// Passwords
// -----------------------------------------------------------------------------
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456, // ~19 MB — OWASP 2023 baseline
    timeCost: 2,
    parallelism: 1,
  });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// -----------------------------------------------------------------------------
// TOTP / MFA
// -----------------------------------------------------------------------------
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

/** Build the otpauth:// URL the authenticator app scans. */
export function buildOtpAuthUrl(opts: { email: string; secret: string }): string {
  return authenticator.keyuri(opts.email, 'DSD Lab Invoice Manager', opts.secret);
}

export async function buildMfaQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1 });
}

export function verifyTotp(secret: string, token: string): boolean {
  // Strip any spaces/zero-width chars users sometimes paste in.
  const cleaned = token.replace(/\s+/g, '');
  return authenticator.check(cleaned, secret);
}

// -----------------------------------------------------------------------------
// Lockout
// -----------------------------------------------------------------------------
export async function recordFailedLogin(userId: string) {
  const u = await prisma.appUser.findUnique({ where: { id: userId } });
  if (!u) return;
  const next = u.failedLogins + 1;
  const lockedUntil = next >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;
  await prisma.appUser.update({
    where: { id: userId },
    data: { failedLogins: next, lockedUntil },
  });
}

export async function clearFailedLogins(userId: string) {
  await prisma.appUser.update({
    where: { id: userId },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
}

export function isLocked(user: { lockedUntil: Date | null }): boolean {
  return user.lockedUntil !== null && user.lockedUntil > new Date();
}
