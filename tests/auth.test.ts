import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateMfaSecret, verifyTotp } from '@/lib/auth';
import { authenticator } from 'otplib';

describe('password hashing', () => {
  it('argon2id round-trips', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'correct-horse-battery-staple')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
});

describe('TOTP', () => {
  it('verifies a freshly-generated code', () => {
    const secret = generateMfaSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
  });
});
