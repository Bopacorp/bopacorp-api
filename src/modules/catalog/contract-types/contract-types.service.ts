import type {
  CreateContractTypeRequest,
  ListContractTypesQuery,
  UpdateContractTypeRequest,
} from '@bopacorp/shared/catalog';
import { contractTypes } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { eq } from 'drizzle-orm';
import { buildLookupListConditions } from '../catalog.helpers.js';

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
