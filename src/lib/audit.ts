import { auditLogs } from '@db/schema/auth.js';
import { db } from '@lib/db.js';

export interface AuditLogParams {
  tableName: string;
  recordId: string;
  operation: 'I' | 'U' | 'D';
  userId: string;
  oldData?: Record<string, unknown> | undefined;
  newData?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  notes?: string | undefined;
}

export async function createAuditLog(params: AuditLogParams) {
  await db.insert(auditLogs).values({
    tableName: params.tableName,
    recordId: params.recordId,
    operation: params.operation,
    userId: params.userId,
    oldData: params.oldData ?? null,
    newData: params.newData ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    notes: params.notes ?? null,
  });
}
