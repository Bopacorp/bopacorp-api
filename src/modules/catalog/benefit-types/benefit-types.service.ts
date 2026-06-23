import type {
  CreateBenefitTypeRequest,
  ListBenefitTypesQuery,
  UpdateBenefitTypeRequest,
} from '@bopacorp/shared/catalog';
import { benefitTypes } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { eq } from 'drizzle-orm';
import { buildLookupListConditions } from '../catalog.helpers.js';

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
