import type {
  CreateOrgRoleRequest,
  ListOrgRolesQuery,
  UpdateOrgRoleRequest,
} from '@bopacorp/shared/core';
import { departments, orgRoles } from '@db/schema/core.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, ilike, or } from 'drizzle-orm';
import { getDepartmentById } from '../departments/departments.service.js';

function toOrgRoleResponse(
  role: typeof orgRoles.$inferSelect,
  dept: typeof departments.$inferSelect | null
) {
  return {
    ...role,
    department: dept ? { id: dept.id, code: dept.code, name: dept.name } : null,
  };
}

export async function listOrgRoles(query: ListOrgRolesQuery) {
  const conditions: (ReturnType<typeof eq> | ReturnType<typeof or> | undefined)[] = [];

  if (query.search) {
    conditions.push(
      or(ilike(orgRoles.code, `%${query.search}%`), ilike(orgRoles.name, `%${query.search}%`))
    );
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(orgRoles.isActive, query.isActive));
  }

  if (query.departmentId) {
    conditions.push(eq(orgRoles.departmentId, query.departmentId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(orgRoles)
    .leftJoin(departments, eq(orgRoles.departmentId, departments.id))
    .where(where)
    .orderBy(orgRoles.code);

  return rows.map((row) => toOrgRoleResponse(row.org_roles, row.departments));
}

export async function getOrgRoleById(id: string) {
  const [row] = await db
    .select()
    .from(orgRoles)
    .leftJoin(departments, eq(orgRoles.departmentId, departments.id))
    .where(eq(orgRoles.id, id));

  if (!row) {
    throw new NotFoundError('Org role', id);
  }

  return toOrgRoleResponse(row.org_roles, row.departments);
}

export async function createOrgRole(input: CreateOrgRoleRequest) {
  const existing = await db.select().from(orgRoles).where(eq(orgRoles.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Org role with code '${input.code}' already exists`);
  }

  if (input.departmentId) {
    await getDepartmentById(input.departmentId);
  }

  const [role] = await db.insert(orgRoles).values(input).returning();

  if (!role) {
    throw new InternalServerError();
  }

  return getOrgRoleById(role.id);
}

export async function updateOrgRole(id: string, input: UpdateOrgRoleRequest) {
  await getOrgRoleById(id);

  if (input.code) {
    const existing = await db.select().from(orgRoles).where(eq(orgRoles.code, input.code));

    const existingRole = existing[0];
    if (existingRole && existingRole.id !== id) {
      throw new ConflictError(`Org role with code '${input.code}' already exists`);
    }
  }

  if (input.departmentId) {
    await getDepartmentById(input.departmentId);
  }

  const updateData: Partial<typeof orgRoles.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.departmentId !== undefined) updateData.departmentId = input.departmentId;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  await db.update(orgRoles).set(updateData).where(eq(orgRoles.id, id));

  return getOrgRoleById(id);
}

export async function disableOrgRole(id: string) {
  await getOrgRoleById(id);

  await db
    .update(orgRoles)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(orgRoles.id, id));
}
