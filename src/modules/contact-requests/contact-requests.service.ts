import type { CreateContactRequest, ListContactRequestsQuery } from '@bopacorp/shared/catalog';
import { contactRequests } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, ilike, or } from 'drizzle-orm';

export async function listContactRequests(query: ListContactRequestsQuery) {
  const conditions = [];

  if (query.itemId) {
    conditions.push(eq(contactRequests.itemId, query.itemId));
  }

  if (query.isAttended !== undefined) {
    conditions.push(eq(contactRequests.isAttended, query.isAttended));
  }

  if (query.search) {
    conditions.push(
      or(
        ilike(contactRequests.clientName, `%${query.search}%`),
        ilike(contactRequests.clientEmail, `%${query.search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalItems = await db.$count(contactRequests, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(contactRequests)
    .where(where)
    .orderBy(contactRequests.createdAt)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data: rows.map((row) => ({
      id: row.id,
      itemId: row.itemId,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      message: row.message,
      isAttended: row.isAttended,
      attendedAt: row.attendedAt ? row.attendedAt.toISOString() : null,
      attendedBy: row.attendedBy,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
    })),
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getContactRequestById(id: string) {
  const [request] = await db.select().from(contactRequests).where(eq(contactRequests.id, id));

  if (!request) {
    throw new NotFoundError('Contact request', id);
  }

  return {
    id: request.id,
    itemId: request.itemId,
    clientName: request.clientName,
    clientEmail: request.clientEmail,
    clientPhone: request.clientPhone,
    message: request.message,
    isAttended: request.isAttended,
    attendedAt: request.attendedAt ? request.attendedAt.toISOString() : null,
    attendedBy: request.attendedBy,
    createdAt: request.createdAt ? request.createdAt.toISOString() : '',
  };
}

export async function createContactRequest(input: CreateContactRequest) {
  const [request] = await db
    .insert(contactRequests)
    .values({
      itemId: input.itemId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone,
      message: input.message,
    })
    .returning();

  if (!request) {
    throw new NotFoundError('Contact request', 'create failed');
  }

  return {
    id: request.id,
    itemId: request.itemId,
    clientName: request.clientName,
    clientEmail: request.clientEmail,
    clientPhone: request.clientPhone,
    message: request.message,
    isAttended: request.isAttended,
    attendedAt: request.attendedAt ? request.attendedAt.toISOString() : null,
    attendedBy: request.attendedBy,
    createdAt: request.createdAt ? request.createdAt.toISOString() : '',
  };
}

export async function attendContactRequest(id: string, userId: string) {
  const [request] = await db.select().from(contactRequests).where(eq(contactRequests.id, id));

  if (!request) {
    throw new NotFoundError('Contact request', id);
  }

  const [updated] = await db
    .update(contactRequests)
    .set({
      isAttended: true,
      attendedAt: new Date(),
      attendedBy: userId,
    })
    .where(eq(contactRequests.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Contact request', id);
  }

  return {
    id: updated.id,
    itemId: updated.itemId,
    clientName: updated.clientName,
    clientEmail: updated.clientEmail,
    clientPhone: updated.clientPhone,
    message: updated.message,
    isAttended: updated.isAttended,
    attendedAt: updated.attendedAt ? updated.attendedAt.toISOString() : null,
    attendedBy: updated.attendedBy,
    createdAt: updated.createdAt ? updated.createdAt.toISOString() : '',
  };
}
