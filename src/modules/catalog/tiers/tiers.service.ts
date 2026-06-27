import type {
  CreateTierRequest,
  ListTiersQuery,
  UpdateTierRequest,
} from '@bopacorp/shared/catalog';
import { tiers } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { eq } from 'drizzle-orm';
import { buildLookupListConditions, getLookupOrderBy } from '../catalog.helpers.js';

export async function listTiers(query: ListTiersQuery) {
  const where = buildLookupListConditions(query, tiers);
  return db
    .select()
    .from(tiers)
    .where(where)
    .orderBy(getLookupOrderBy(tiers, query.sortBy, query.sortOrder));
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
