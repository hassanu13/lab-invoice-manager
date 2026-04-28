/**
 * Local dev seed.
 *
 * Idempotent: safe to run multiple times. The base seed (Bolton site, 12 labs,
 * 9 clinicians) is already in the SQL migration. This script layers on:
 *  - The first admin user (Hassan), with a known dev password.
 *  - A practice-manager role assignment at Bolton.
 *
 * In production, the first user is created via a CLI bootstrap step, never via
 * a seed script.
 */
// Force-load .env so this seed works whether invoked by `prisma db seed`
// (which loads .env automatically) or `tsx prisma/seed.ts` (which doesn't).
import 'dotenv/config';
import argon2 from 'argon2';
import { prisma } from '../src/lib/db';

async function main() {
  // Seed clinicians/labs are already inserted by migration 000_initial_schema.sql.
  // Just confirm and log.
  const labCount = await prisma.lab.count();
  const clinicianCount = await prisma.clinician.count();
  const siteCount = await prisma.site.count();
  console.log(`Found ${siteCount} site(s), ${labCount} lab(s), ${clinicianCount} clinician(s).`);

  // First admin user (dev only)
  const email = 'Mohammed@dreamsmilesdental.co.uk';
  const devPassword = 'ChangeMe!Dev2026'; // local dev only — never used in production
  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists, skipping create.`);
    return;
  }

  const hash = await argon2.hash(devPassword, { type: argon2.argon2id });
  const bolton = await prisma.site.findUnique({ where: { slug: 'bolton' } });
  if (!bolton) {
    throw new Error('Bolton site not found. Did the SQL migration run?');
  }

  const user = await prisma.appUser.create({
    data: {
      email,
      fullName: 'Hassan Ugradar',
      passwordHash: hash,
      mfaEnrolled: false,
      siteRoles: {
        create: [
          { siteId: bolton.id, role: 'practice_manager' },
          { siteId: bolton.id, role: 'operations' },
          { siteId: null, role: 'finance' }, // group-wide
          { siteId: null, role: 'slt' }, // group-wide
        ],
      },
    },
  });

  console.log(`Created admin user ${user.email}.`);
  console.log(`Dev password: ${devPassword} (CHANGE BEFORE ANY REAL DATA IS LOADED)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
