import type {
  CreateCategoryRequest,
  ListCategoriesQuery,
  UpdateCategoryRequest,
} from '@bopacorp/shared/catalog';
import { categories } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, ilike } from 'drizzle-orm';

export async function listCategories(query: ListCategoriesQuery) {
  const conditions = [];

  if (query.search) {
    conditions.push(ilike(categories.name, `%${query.search}%`));
  }

  if (query.parentId !== undefined) {
    if (query.parentId === null) {
      conditions.push(eq(categories.parentId, query.parentId));
    } else {
      conditions.push(eq(categories.parentId, query.parentId));
    }
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(categories.isActive, query.isActive));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select().from(categories).where(where).orderBy(categories.sortOrder, categories.name);
}

export async function getCategoryTree() {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(categories.sortOrder, categories.name);

  const categoryMap = new Map<
    string,
    {
      id: string;
      parentId: string | null;
      name: string;
      description: string | null;
      sortOrder: number;
      isActive: boolean;
      createdAt: Date | null;
      updatedAt: Date | null;
      children: unknown[];
    }
  >();

  for (const row of rows) {
    categoryMap.set(row.id, { ...row, children: [] });
  }

  const roots: unknown[] = [];

  for (const row of rows) {
    const node = categoryMap.get(row.id);
    if (!node) continue;

    if (row.parentId) {
      const parent = categoryMap.get(row.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function getCategoryById(id: string) {
  const [category] = await db.select().from(categories).where(eq(categories.id, id));

  if (!category) {
    throw new NotFoundError('Category', id);
  }

  return category;
}

export async function createCategory(input: CreateCategoryRequest) {
  if (input.parentId) {
    const parent = await db.select().from(categories).where(eq(categories.id, input.parentId));
    if (parent.length === 0) {
      throw new NotFoundError('Parent category', input.parentId);
    }
  }

  const [category] = await db.insert(categories).values(input).returning();

  if (!category) {
    throw new InternalServerError();
  }

  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryRequest) {
  await getCategoryById(id);

  if (input.parentId !== undefined) {
    if (input.parentId === id) {
      throw new ConflictError('Category cannot be its own parent');
    }

    if (input.parentId !== null) {
      const parent = await db.select().from(categories).where(eq(categories.id, input.parentId));
      if (parent.length === 0) {
        throw new NotFoundError('Parent category', input.parentId);
      }
    }
  }

  const updateData: Partial<typeof categories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.parentId !== undefined) updateData.parentId = input.parentId;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(categories)
    .set(updateData)
    .where(eq(categories.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Category', id);
  }

  return updated;
}

export async function disableCategory(id: string) {
  await getCategoryById(id);

  await db
    .update(categories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(categories.id, id));
}
