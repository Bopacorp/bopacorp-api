import type {
  CreateDepartmentRequest,
  ListDepartmentsQuery,
  UpdateDepartmentRequest,
} from '@bopacorp/shared/core';
import { departments } from '@db/schema/core.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { eq } from 'drizzle-orm';
import { buildLookupListConditions } from '../org.helpers.js';

export async function listDepartments(query: ListDepartmentsQuery) {
  const where = buildLookupListConditions(query, departments);
  return db.select().from(departments).where(where).orderBy(departments.code);
}

export async function getDepartmentById(id: string) {
  const [department] = await db.select().from(departments).where(eq(departments.id, id));

  if (!department) {
    throw new NotFoundError('Department', id);
  }

  return department;
}

export async function createDepartment(input: CreateDepartmentRequest) {
  const existing = await db.select().from(departments).where(eq(departments.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Department with code '${input.code}' already exists`);
  }

  const [department] = await db.insert(departments).values(input).returning();

  if (!department) {
    throw new InternalServerError();
  }

  return department;
}

export async function updateDepartment(id: string, input: UpdateDepartmentRequest) {
  await getDepartmentById(id);

  if (input.code) {
    const existing = await db.select().from(departments).where(eq(departments.code, input.code));

    const existingDept = existing[0];
    if (existingDept && existingDept.id !== id) {
      throw new ConflictError(`Department with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof departments.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(departments)
    .set(updateData)
    .where(eq(departments.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Department', id);
  }

  return updated;
}

export async function disableDepartment(id: string) {
  await getDepartmentById(id);

  await db
    .update(departments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(departments.id, id));
}
