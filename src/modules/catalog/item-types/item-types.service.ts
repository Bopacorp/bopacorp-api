import type {
  CreateItemTypeRequest,
  ListItemTypesQuery,
  UpdateItemTypeRequest,
} from '@bopacorp/shared/catalog';
import { itemTypes } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { eq } from 'drizzle-orm';
import { buildLookupListConditions, getLookupOrderBy } from '../catalog.helpers.js';

export async function listItemTypes(query: ListItemTypesQuery) {
  const where = buildLookupListConditions(query, itemTypes);
  return db
    .select()
    .from(itemTypes)
    .where(where)
    .orderBy(getLookupOrderBy(itemTypes, query.sortBy, query.sortOrder));
}

export async function getItemTypeById(id: string) {
  const [type] = await db.select().from(itemTypes).where(eq(itemTypes.id, id));

  if (!type) {
    throw new NotFoundError('Item type', id);
  }

  return type;
}

export async function createItemType(input: CreateItemTypeRequest) {
  const existing = await db.select().from(itemTypes).where(eq(itemTypes.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Item type with code '${input.code}' already exists`);
  }

  const [type] = await db.insert(itemTypes).values(input).returning();

  if (!type) {
    throw new InternalServerError();
  }

  return type;
}

export async function updateItemType(id: string, input: UpdateItemTypeRequest) {
  await getItemTypeById(id);

  if (input.code) {
    const existing = await db.select().from(itemTypes).where(eq(itemTypes.code, input.code));

    const existingType = existing[0];
    if (existingType && existingType.id !== id) {
      throw new ConflictError(`Item type with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof itemTypes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(itemTypes)
    .set(updateData)
    .where(eq(itemTypes.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Item type', id);
  }

  return updated;
}

export async function disableItemType(id: string) {
  await getItemTypeById(id);

  await db
    .update(itemTypes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(itemTypes.id, id));
}
