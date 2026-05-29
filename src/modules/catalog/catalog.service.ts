import type {
  CreateBenefitTypeRequest,
  CreateCategoryRequest,
  CreateContentBlockRequest,
  CreateContentTypeRequest,
  CreateContractTypeRequest,
  CreateGeoZoneRequest,
  CreateItemTypeRequest,
  CreateSegmentRequest,
  CreateTierRequest,
  ListBenefitTypesQuery,
  ListCategoriesQuery,
  ListContentBlocksQuery,
  ListContractTypesQuery,
  ListGeoZonesQuery,
  ListItemTypesQuery,
  ListSegmentsQuery,
  ListTiersQuery,
  UpdateBenefitTypeRequest,
  UpdateCategoryRequest,
  UpdateContentBlockRequest,
  UpdateContentTypeRequest,
  UpdateContractTypeRequest,
  UpdateGeoZoneRequest,
  UpdateItemTypeRequest,
  UpdateSegmentRequest,
  UpdateTierRequest,
} from '@bopacorp/shared/catalog';
import {
  benefitTypes,
  categories,
  contentBlocks,
  contentTypes,
  contractTypes,
  geoZones,
  itemTypes,
  segments,
  tiers,
} from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

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

// ── Lookup tables ──

function buildLookupListConditions(
  query: { search?: string | undefined; isActive?: boolean | undefined },
  cols: { code: AnyPgColumn; name: AnyPgColumn; isActive: AnyPgColumn }
) {
  const conditions: (ReturnType<typeof eq> | ReturnType<typeof or> | undefined)[] = [];

  if (query.search) {
    conditions.push(
      or(ilike(cols.code, `%${query.search}%`), ilike(cols.name, `%${query.search}%`))
    );
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(cols.isActive, query.isActive));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

// item_types

export async function listItemTypes(query: ListItemTypesQuery) {
  const where = buildLookupListConditions(query, itemTypes);
  return db.select().from(itemTypes).where(where).orderBy(itemTypes.code);
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

// contract_types

export async function listContractTypes(query: ListContractTypesQuery) {
  const where = buildLookupListConditions(query, contractTypes);
  return db.select().from(contractTypes).where(where).orderBy(contractTypes.code);
}

export async function getContractTypeById(id: string) {
  const [type] = await db.select().from(contractTypes).where(eq(contractTypes.id, id));

  if (!type) {
    throw new NotFoundError('Contract type', id);
  }

  return type;
}

export async function createContractType(input: CreateContractTypeRequest) {
  const existing = await db.select().from(contractTypes).where(eq(contractTypes.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Contract type with code '${input.code}' already exists`);
  }

  const [type] = await db.insert(contractTypes).values(input).returning();

  if (!type) {
    throw new InternalServerError();
  }

  return type;
}

export async function updateContractType(id: string, input: UpdateContractTypeRequest) {
  await getContractTypeById(id);

  if (input.code) {
    const existing = await db
      .select()
      .from(contractTypes)
      .where(eq(contractTypes.code, input.code));

    const existingType = existing[0];
    if (existingType && existingType.id !== id) {
      throw new ConflictError(`Contract type with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof contractTypes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(contractTypes)
    .set(updateData)
    .where(eq(contractTypes.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Contract type', id);
  }

  return updated;
}

export async function disableContractType(id: string) {
  await getContractTypeById(id);

  await db
    .update(contractTypes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(contractTypes.id, id));
}

// segments

export async function listSegments(query: ListSegmentsQuery) {
  const where = buildLookupListConditions(query, segments);
  return db.select().from(segments).where(where).orderBy(segments.code);
}

export async function getSegmentById(id: string) {
  const [segment] = await db.select().from(segments).where(eq(segments.id, id));

  if (!segment) {
    throw new NotFoundError('Segment', id);
  }

  return segment;
}

export async function createSegment(input: CreateSegmentRequest) {
  const existing = await db.select().from(segments).where(eq(segments.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Segment with code '${input.code}' already exists`);
  }

  const [segment] = await db.insert(segments).values(input).returning();

  if (!segment) {
    throw new InternalServerError();
  }

  return segment;
}

export async function updateSegment(id: string, input: UpdateSegmentRequest) {
  await getSegmentById(id);

  if (input.code) {
    const existing = await db.select().from(segments).where(eq(segments.code, input.code));

    const existingSegment = existing[0];
    if (existingSegment && existingSegment.id !== id) {
      throw new ConflictError(`Segment with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof segments.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(segments)
    .set(updateData)
    .where(eq(segments.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Segment', id);
  }

  return updated;
}

export async function disableSegment(id: string) {
  await getSegmentById(id);

  await db
    .update(segments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(segments.id, id));
}

// tiers

export async function listTiers(query: ListTiersQuery) {
  const where = buildLookupListConditions(query, tiers);
  return db.select().from(tiers).where(where).orderBy(tiers.code);
}

export async function getTierById(id: string) {
  const [tier] = await db.select().from(tiers).where(eq(tiers.id, id));

  if (!tier) {
    throw new NotFoundError('Tier', id);
  }

  return tier;
}

export async function createTier(input: CreateTierRequest) {
  const existing = await db.select().from(tiers).where(eq(tiers.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Tier with code '${input.code}' already exists`);
  }

  const [tier] = await db.insert(tiers).values(input).returning();

  if (!tier) {
    throw new InternalServerError();
  }

  return tier;
}

export async function updateTier(id: string, input: UpdateTierRequest) {
  await getTierById(id);

  if (input.code) {
    const existing = await db.select().from(tiers).where(eq(tiers.code, input.code));

    const existingTier = existing[0];
    if (existingTier && existingTier.id !== id) {
      throw new ConflictError(`Tier with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof tiers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db.update(tiers).set(updateData).where(eq(tiers.id, id)).returning();

  if (!updated) {
    throw new NotFoundError('Tier', id);
  }

  return updated;
}

export async function disableTier(id: string) {
  await getTierById(id);

  await db.update(tiers).set({ isActive: false, updatedAt: new Date() }).where(eq(tiers.id, id));
}

// geo_zones

export async function listGeoZones(query: ListGeoZonesQuery) {
  const where = buildLookupListConditions(query, geoZones);
  return db.select().from(geoZones).where(where).orderBy(geoZones.code);
}

export async function getGeoZoneById(id: string) {
  const [zone] = await db.select().from(geoZones).where(eq(geoZones.id, id));

  if (!zone) {
    throw new NotFoundError('Geo zone', id);
  }

  return zone;
}

export async function createGeoZone(input: CreateGeoZoneRequest) {
  const existing = await db.select().from(geoZones).where(eq(geoZones.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Geo zone with code '${input.code}' already exists`);
  }

  const [zone] = await db.insert(geoZones).values(input).returning();

  if (!zone) {
    throw new InternalServerError();
  }

  return zone;
}

export async function updateGeoZone(id: string, input: UpdateGeoZoneRequest) {
  await getGeoZoneById(id);

  if (input.code) {
    const existing = await db.select().from(geoZones).where(eq(geoZones.code, input.code));

    const existingZone = existing[0];
    if (existingZone && existingZone.id !== id) {
      throw new ConflictError(`Geo zone with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof geoZones.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(geoZones)
    .set(updateData)
    .where(eq(geoZones.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Geo zone', id);
  }

  return updated;
}

export async function disableGeoZone(id: string) {
  await getGeoZoneById(id);

  await db
    .update(geoZones)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(geoZones.id, id));
}

// benefit_types

export async function listBenefitTypes(query: ListBenefitTypesQuery) {
  const where = buildLookupListConditions(query, benefitTypes);
  return db.select().from(benefitTypes).where(where).orderBy(benefitTypes.code);
}

export async function getBenefitTypeById(id: string) {
  const [type] = await db.select().from(benefitTypes).where(eq(benefitTypes.id, id));

  if (!type) {
    throw new NotFoundError('Benefit type', id);
  }

  return type;
}

export async function createBenefitType(input: CreateBenefitTypeRequest) {
  const existing = await db.select().from(benefitTypes).where(eq(benefitTypes.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Benefit type with code '${input.code}' already exists`);
  }

  const [type] = await db.insert(benefitTypes).values(input).returning();

  if (!type) {
    throw new InternalServerError();
  }

  return type;
}

export async function updateBenefitType(id: string, input: UpdateBenefitTypeRequest) {
  await getBenefitTypeById(id);

  if (input.code) {
    const existing = await db.select().from(benefitTypes).where(eq(benefitTypes.code, input.code));

    const existingType = existing[0];
    if (existingType && existingType.id !== id) {
      throw new ConflictError(`Benefit type with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof benefitTypes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(benefitTypes)
    .set(updateData)
    .where(eq(benefitTypes.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Benefit type', id);
  }

  return updated;
}

export async function disableBenefitType(id: string) {
  await getBenefitTypeById(id);

  await db
    .update(benefitTypes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(benefitTypes.id, id));
}

// ── Categories ──

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
