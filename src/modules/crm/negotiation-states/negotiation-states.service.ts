import type {
  CreateNegotiationStateRequest,
  ListNegotiationStatesQuery,
  UpdateNegotiationStateRequest,
} from '@bopacorp/shared/crm';
import { negotiationStates, negotiations } from '@db/schema/crm.js';
import { db } from '@lib/db.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { formatDateTime } from '../crm.helpers.js';

export async function listNegotiationStates(query: ListNegotiationStatesQuery) {
  const conditions = [];

  if (query.isActive !== undefined) {
    conditions.push(eq(negotiationStates.isActive, query.isActive));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(or(ilike(negotiationStates.name, term), ilike(negotiationStates.code, term)));
  }

  const where = conditions.length > 0 ? and(...conditions) : sql`true`;

  const totalItems = await db.$count(negotiationStates, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(negotiationStates)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(asc(negotiationStates.position));

  return {
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      position: row.position,
      isActive: row.isActive,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getNegotiationStateById(id: string) {
  const row = await db.query.negotiationStates.findFirst({
    where: eq(negotiationStates.id, id),
  });

  if (!row) {
    throw new NotFoundError('Negotiation state', id);
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    position: row.position,
    isActive: row.isActive,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createNegotiationState(data: CreateNegotiationStateRequest) {
  const existing = await db
    .select()
    .from(negotiationStates)
    .where(eq(negotiationStates.code, data.code));

  if (existing.length > 0) {
    throw new ConflictError('Negotiation state with this code already exists');
  }

  const [row] = await db
    .insert(negotiationStates)
    .values({
      code: data.code,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create negotiation state');
  }

  return getNegotiationStateById(row.id);
}

export async function updateNegotiationState(id: string, data: UpdateNegotiationStateRequest) {
  await getNegotiationStateById(id);

  const updateData: Partial<typeof negotiationStates.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) {
    const existing = await db
      .select()
      .from(negotiationStates)
      .where(and(eq(negotiationStates.code, data.code), eq(negotiationStates.id, id)));

    if (existing.length > 0) {
      throw new ConflictError('Negotiation state with this code already exists');
    }
    updateData.code = data.code;
  }

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(negotiationStates).set(updateData).where(eq(negotiationStates.id, id));
  }

  return getNegotiationStateById(id);
}

export async function removeNegotiationState(id: string) {
  await getNegotiationStateById(id);

  const inUse = await db
    .select({ count: negotiationStates.id })
    .from(negotiations)
    .where(eq(negotiations.stateId, id));

  if (inUse.length > 0) {
    await db
      .update(negotiationStates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(negotiationStates.id, id));
    return;
  }

  await db.delete(negotiationStates).where(eq(negotiationStates.id, id));
}
