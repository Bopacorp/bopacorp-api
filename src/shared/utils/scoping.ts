import { advisorSupervisors } from '@db/schema/core.js';
import { db } from '@lib/db.js';
import { and, eq } from 'drizzle-orm';

export async function getSupervisedAdvisorIds(supervisorId: string): Promise<string[]> {
  const rows = await db
    .select({ advisorId: advisorSupervisors.advisorId })
    .from(advisorSupervisors)
    .where(
      and(eq(advisorSupervisors.supervisorId, supervisorId), eq(advisorSupervisors.isActive, true))
    );
  return rows.map((r) => r.advisorId);
}
