import type { CreateContactRequest, ListContactRequestsQuery } from '@bopacorp/shared/catalog';
import { catalogItems, contactRequests } from '@db/schema/catalog.js';
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
        ilike(contactRequests.clientEmail, `%${query.search}%`),
        ilike(contactRequests.clientPhone, `%${query.search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalItems = await db.$count(contactRequests, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      request: contactRequests,
      itemName: catalogItems.name,
    })
    .from(contactRequests)
    .leftJoin(catalogItems, eq(contactRequests.itemId, catalogItems.id))
    .where(where)
    .orderBy(contactRequests.createdAt)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data: rows.map((row) => toContactRequestResponse(row.request, row.itemName)),
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getContactRequestById(id: string) {
  const rows = await db
    .select({
      request: contactRequests,
      itemName: catalogItems.name,
    })
    .from(contactRequests)
    .leftJoin(catalogItems, eq(contactRequests.itemId, catalogItems.id))
    .where(eq(contactRequests.id, id));

  const row = rows[0];
  if (!row) {
    throw new NotFoundError('Contact request', id);
  }

  return toContactRequestResponse(row.request, row.itemName);
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

  return toContactRequestResponse(request, null);
}

export async function attendContactRequest(id: string, userId: string) {
  const request = await getContactRequestById(id);

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

  return toContactRequestResponse(updated, request.itemName);
}

function toContactRequestResponse(
  request: (typeof contactRequests)['$inferSelect'],
  itemName: string | null
) {
  return {
    id: request.id,
    itemId: request.itemId,
    itemName,
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
