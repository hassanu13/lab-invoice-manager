/**
 * Append-only audit log writer. Every patient-data read/write,
 * every login (success and fail), every export must go through here.
 */
import type { AuditAction, Prisma } from '@prisma/client';
import { prisma } from './db';

export interface AuditEntry {
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        // Prisma's Json input type is narrower than Record<string, unknown>; cast at the
        // boundary. Callers stick to JSON-safe values (strings, numbers, arrays, plain
        // objects) — anything else gets stringified at the call site.
        details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    // Never let an audit-log failure break the user-facing request.
    // CloudWatch will surface this in production via Sentry.
    console.error('audit_log_write_failed', e);
  }
}
