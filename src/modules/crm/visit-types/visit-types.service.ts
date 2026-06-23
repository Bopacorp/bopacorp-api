import type {
  CreateVisitTypeRequest,
  ListVisitTypesQuery,
  UpdateVisitTypeRequest,
} from '@bopacorp/shared/crm';
import { visits, visitTypes } from '@db/schema/crm.js';
import { db } from '@lib/db.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { formatDateTime } from '../crm.helpers.js';

export async function listVisitTypes(query: ListVisitTypesQuery) {
  const conditions = [];

  if (query.isActive !== undefined) {
    conditions.push(eq(visitTypes.isActive, query.isActive));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(or(ilike(visitTypes.name, term), ilike(visitTypes.code, term)));
  }

  const where = conditions.length > 0 ? and(...conditions) : sql`true`;

  const totalItems = await db.$count(visitTypes, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(visitTypes)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(visitTypes.createdAt);

  return {
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getVisitTypeById(id: string) {
  const row = await db.query.visitTypes.findFirst({
    where: eq(visitTypes.id, id),
  });

  if (!row) {
    throw new NotFoundError('Visit type', id);
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createVisitType(data: CreateVisitTypeRequest) {
  const existing = await db.select().from(visitTypes).where(eq(visitTypes.code, data.code));

  if (existing.length > 0) {
    throw new ConflictError('Visit type with this code already exists');
  }

  const [row] = await db
    .insert(visitTypes)
    .values({
      code: data.code,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create visit type');
  }

  return getVisitTypeById(row.id);
}

export async function updateVisitType(id: string, data: UpdateVisitTypeRequest) {
  await getVisitTypeById(id);

  const updateData: Partial<typeof visitTypes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) {
    const existing = await db
      .select()
      .from(visitTypes)
      .where(and(eq(visitTypes.code, data.code), eq(visitTypes.id, id)));

    if (existing.length > 0) {
      throw new ConflictError('Visit type with this code already exists');
    }
    updateData.code = data.code;
  }

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(visitTypes).set(updateData).where(eq(visitTypes.id, id));
  }

  return getVisitTypeById(id);
}

export async function removeVisitType(id: string) {
  await getVisitTypeById(id);

  const inUse = await db
    .select({ count: visits.id })
    .from(visits)
    .where(eq(visits.visitTypeId, id));

  if (inUse.length > 0) {
    await db
      .update(visitTypes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(visitTypes.id, id));
    return;
  }

  await db.delete(visitTypes).where(eq(visitTypes.id, id));
}
