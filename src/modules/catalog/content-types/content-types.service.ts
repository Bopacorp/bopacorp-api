import type { CreateContentTypeRequest, UpdateContentTypeRequest } from '@bopacorp/shared/catalog';
import { contentTypes } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { eq } from 'drizzle-orm';

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
