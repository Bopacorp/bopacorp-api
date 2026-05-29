import type {
  CreateContentBlockRequest,
  CreateContentTypeRequest,
  ListContentBlocksQuery,
  UpdateContentBlockRequest,
  UpdateContentTypeRequest,
} from '@bopacorp/shared/catalog';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { contentBlocks, contentTypes } from '../../db/schema/catalog.js';

export async function listContentTypes() {
  return db.select().from(contentTypes).orderBy(contentTypes.code);
}

export async function getContentTypeById(id: string) {
  const [type] = await db.select().from(contentTypes).where(eq(contentTypes.id, id));

  if (!type) {
    throw new NotFoundError('Content type', id);
  }

  return type;
}

export async function createContentType(input: CreateContentTypeRequest) {
  const existing = await db.select().from(contentTypes).where(eq(contentTypes.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Content type with code '${input.code}' already exists`);
  }

  const [type] = await db.insert(contentTypes).values(input).returning();

  if (!type) {
    throw new InternalServerError();
  }

  return type;
}

export async function updateContentType(id: string, input: UpdateContentTypeRequest) {
  await getContentTypeById(id);

  if (input.code) {
    const existing = await db.select().from(contentTypes).where(eq(contentTypes.code, input.code));

    const existingType = existing[0];
    if (existingType && existingType.id !== id) {
      throw new ConflictError(`Content type with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof contentTypes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(contentTypes)
    .set(updateData)
    .where(eq(contentTypes.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Content type', id);
  }

  return updated;
}

export async function disableContentType(id: string) {
  await getContentTypeById(id);

  await db
    .update(contentTypes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(contentTypes.id, id));
}

const CONTENT_BLOCK_RESPONSE_COLUMNS = {
  id: contentBlocks.id,
  contentKey: contentBlocks.contentKey,
  contentTypeId: contentBlocks.contentTypeId,
  title: contentBlocks.title,
  body: contentBlocks.body,
  sortOrder: contentBlocks.sortOrder,
  createdAt: contentBlocks.createdAt,
  updatedAt: contentBlocks.updatedAt,
  contentTypeCode: contentTypes.code,
  contentTypeName: contentTypes.name,
  contentTypeIdJoined: contentTypes.id,
};

function buildContentBlockQuery() {
  return db
    .select(CONTENT_BLOCK_RESPONSE_COLUMNS)
    .from(contentBlocks)
    .leftJoin(contentTypes, eq(contentBlocks.contentTypeId, contentTypes.id));
}

type ContentBlockRow = Awaited<
  ReturnType<ReturnType<typeof buildContentBlockQuery>['execute']>
>[number];

function toContentBlockResponse(row: ContentBlockRow) {
  return {
    id: row.id,
    contentKey: row.contentKey,
    contentTypeId: row.contentTypeId,
    title: row.title,
    body: row.body,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    contentType: row.contentTypeIdJoined
      ? {
          id: row.contentTypeIdJoined,
          code: row.contentTypeCode,
          name: row.contentTypeName,
        }
      : null,
  };
}

function getSortColumn(sortBy: string | undefined) {
  switch (sortBy) {
    case 'contentKey':
      return contentBlocks.contentKey;
    case 'title':
      return contentBlocks.title;
    case 'sortOrder':
      return contentBlocks.sortOrder;
    case 'createdAt':
      return contentBlocks.createdAt;
    case 'updatedAt':
      return contentBlocks.updatedAt;
    default:
      return contentBlocks.sortOrder;
  }
}

export async function listContentBlocks(query: ListContentBlocksQuery) {
  const conditions = [isNull(contentBlocks.deletedAt)];

  if (query.contentTypeId) {
    conditions.push(eq(contentBlocks.contentTypeId, query.contentTypeId));
  }

  if (query.search) {
    const cond = or(
      ilike(contentBlocks.contentKey, `%${query.search}%`),
      ilike(contentBlocks.title, `%${query.search}%`)
    );
    if (cond) conditions.push(cond);
  }

  const where = and(...conditions);

  const totalItems = await db.$count(contentBlocks, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const sortColumn = getSortColumn(query.sortBy);
  const orderFn = query.sortOrder === 'desc' ? desc : asc;

  const rows = await buildContentBlockQuery()
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  const data = rows.map(toContentBlockResponse);

  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getContentBlockById(id: string) {
  const rows = await buildContentBlockQuery().where(
    and(eq(contentBlocks.id, id), isNull(contentBlocks.deletedAt))
  );

  const block = rows[0];

  if (!block) {
    throw new NotFoundError('Content block', id);
  }

  return toContentBlockResponse(block);
}

export async function createContentBlock(input: CreateContentBlockRequest, userId: string) {
  const existing = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.contentKey, input.contentKey), isNull(contentBlocks.deletedAt)));

  if (existing.length > 0) {
    throw new ConflictError(`Content block with key '${input.contentKey}' already exists`);
  }

  const [inserted] = await db
    .insert(contentBlocks)
    .values({ ...input, updatedBy: userId })
    .returning();

  if (!inserted) {
    throw new InternalServerError();
  }

  const rows = await buildContentBlockQuery().where(eq(contentBlocks.id, inserted.id));
  const block = rows[0];

  if (!block) {
    throw new InternalServerError();
  }

  return toContentBlockResponse(block);
}

export async function updateContentBlock(
  id: string,
  input: UpdateContentBlockRequest,
  userId: string
) {
  await getContentBlockById(id);

  if (input.contentKey) {
    const existing = await db
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.contentKey, input.contentKey), isNull(contentBlocks.deletedAt)));

    const existingBlock = existing[0];
    if (existingBlock && existingBlock.id !== id) {
      throw new ConflictError(`Content block with key '${input.contentKey}' already exists`);
    }
  }

  const updateData = insertInputToUpdateData(input, userId);

  const [updated] = await db
    .update(contentBlocks)
    .set(updateData)
    .where(and(eq(contentBlocks.id, id), isNull(contentBlocks.deletedAt)))
    .returning();

  if (!updated) {
    throw new NotFoundError('Content block', id);
  }

  const rows = await buildContentBlockQuery().where(eq(contentBlocks.id, updated.id));
  const block = rows[0];

  if (!block) {
    throw new InternalServerError();
  }

  return toContentBlockResponse(block);
}

function insertInputToUpdateData(input: UpdateContentBlockRequest, userId: string) {
  const updateData: Partial<typeof contentBlocks.$inferInsert> = {
    updatedAt: new Date(),
    updatedBy: userId,
  };

  if (input.contentKey !== undefined) updateData.contentKey = input.contentKey;
  if (input.contentTypeId !== undefined) updateData.contentTypeId = input.contentTypeId;
  if (input.title !== undefined) updateData.title = input.title;
  if (input.body !== undefined) updateData.body = input.body;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  return updateData;
}

export async function deleteContentBlock(id: string) {
  await getContentBlockById(id);

  await db.update(contentBlocks).set({ deletedAt: new Date() }).where(eq(contentBlocks.id, id));
}
