import type {
  AssignRolePermissionsRequest,
  CreateModuleRequest,
  CreatePermissionRequest,
  CreateRoleRequest,
  ListModulesQuery,
  ListPermissionsQuery,
  ListRolesQuery,
  UpdateModuleRequest,
  UpdatePermissionRequest,
  UpdateRoleRequest,
} from '@bopacorp/shared/auth';
import { modules, permissions, rolePermissions, roles } from '@db/schema/auth.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

// ── Roles ──

function getRoleSortColumn(sortBy: string | undefined): AnyPgColumn {
  switch (sortBy) {
    case 'name':
      return roles.name;
    case 'slug':
      return roles.slug;
    default:
      return roles.createdAt;
  }
}

export async function listRoles(query: ListRolesQuery) {
  const conditions: SQL[] = [];

  if (query.search) {
    const term = `%${query.search}%`;
    const searchCond = or(ilike(roles.name, term), ilike(roles.slug, term));
    if (searchCond) conditions.push(searchCond);
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(roles.isActive, query.isActive));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ count: count() }).from(roles).where(where);

  const totalItems = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / query.limit);

  const sortColumn = getRoleSortColumn(query.sortBy);
  const orderFn = query.sortOrder === 'desc' ? desc : asc;

  const data = await db
    .select()
    .from(roles)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getRoleById(id: string) {
  const [role] = await db.select().from(roles).where(eq(roles.id, id));

  if (!role) {
    throw new NotFoundError('Role', id);
  }

  return role;
}

export async function getRoleDetail(id: string) {
  const role = await getRoleById(id);

  const rpRows = await db
    .select({
      permissionId: permissions.id,
      code: permissions.code,
      name: permissions.name,
      type: permissions.type,
      isGranted: rolePermissions.isGranted,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, id));

  return {
    ...role,
    permissions: rpRows.map((rp) => ({
      id: rp.permissionId,
      code: rp.code,
      name: rp.name,
      type: rp.type,
      isGranted: rp.isGranted,
    })),
  };
}

export async function createRole(input: CreateRoleRequest) {
  const existingName = await db.select().from(roles).where(eq(roles.name, input.name));

  if (existingName.length > 0) {
    throw new ConflictError(`Role with name '${input.name}' already exists`);
  }

  const existingSlug = await db.select().from(roles).where(eq(roles.slug, input.slug));

  if (existingSlug.length > 0) {
    throw new ConflictError(`Role with slug '${input.slug}' already exists`);
  }

  const [role] = await db.insert(roles).values(input).returning();

  if (!role) {
    throw new InternalServerError();
  }

  return role;
}

export async function updateRole(id: string, input: UpdateRoleRequest) {
  await getRoleById(id);

  if (input.name) {
    const existing = await db.select().from(roles).where(eq(roles.name, input.name));

    const existingRole = existing[0];
    if (existingRole && existingRole.id !== id) {
      throw new ConflictError(`Role with name '${input.name}' already exists`);
    }
  }

  const updateData: Partial<typeof roles.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db.update(roles).set(updateData).where(eq(roles.id, id)).returning();

  if (!updated) {
    throw new NotFoundError('Role', id);
  }

  return updated;
}

export async function disableRole(id: string) {
  await getRoleById(id);

  await db.update(roles).set({ isActive: false, updatedAt: new Date() }).where(eq(roles.id, id));
}

export async function assignRolePermissions(id: string, input: AssignRolePermissionsRequest) {
  await getRoleById(id);

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));

    if (input.permissions.length > 0) {
      await tx.insert(rolePermissions).values(
        input.permissions.map((p) => ({
          roleId: id,
          permissionId: p.permissionId,
          isGranted: p.isGranted,
        }))
      );
    }
  });

  return getRoleDetail(id);
}

// ── Modules ──

function getModuleSortColumn(sortBy: string | undefined): AnyPgColumn {
  switch (sortBy) {
    case 'code':
      return modules.code;
    case 'name':
      return modules.name;
    case 'sortOrder':
      return modules.sortOrder;
    default:
      return modules.createdAt;
  }
}

export async function listModules(query: ListModulesQuery) {
  const conditions: SQL[] = [];

  if (query.search) {
    const term = `%${query.search}%`;
    const searchCond = or(ilike(modules.name, term), ilike(modules.code, term));
    if (searchCond) conditions.push(searchCond);
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(modules.isActive, query.isActive));
  }

  if (query.parentId) {
    conditions.push(eq(modules.parentId, query.parentId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ count: count() }).from(modules).where(where);

  const totalItems = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / query.limit);

  const sortColumn = getModuleSortColumn(query.sortBy);
  const orderFn = query.sortOrder === 'desc' ? desc : asc;

  const data = await db
    .select()
    .from(modules)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getModuleById(id: string) {
  const [mod] = await db.select().from(modules).where(eq(modules.id, id));

  if (!mod) {
    throw new NotFoundError('Module', id);
  }

  return mod;
}

interface ModuleTree {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  children: ModuleTree[];
}

export async function getModuleTree() {
  const allModules = await db
    .select()
    .from(modules)
    .orderBy(asc(modules.sortOrder), asc(modules.name));

  const map = new Map<string, ModuleTree>();
  const roots: ModuleTree[] = [];

  for (const mod of allModules) {
    map.set(mod.id, { ...mod, children: [] });
  }

  for (const mod of allModules) {
    const node = map.get(mod.id);
    if (!node) continue;
    if (mod.parentId) {
      const parent = map.get(mod.parentId);
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

export async function createModule(input: CreateModuleRequest) {
  if (input.parentId) {
    await getModuleById(input.parentId);
  }

  const existing = await db.select().from(modules).where(eq(modules.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Module with code '${input.code}' already exists`);
  }

  const [mod] = await db.insert(modules).values(input).returning();

  if (!mod) {
    throw new InternalServerError();
  }

  return mod;
}

export async function updateModule(id: string, input: UpdateModuleRequest) {
  await getModuleById(id);

  if (input.parentId) {
    await getModuleById(input.parentId);
  }

  const updateData: Partial<typeof modules.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.parentId !== undefined) updateData.parentId = input.parentId;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db.update(modules).set(updateData).where(eq(modules.id, id)).returning();

  if (!updated) {
    throw new NotFoundError('Module', id);
  }

  return updated;
}

export async function disableModule(id: string) {
  await getModuleById(id);

  await db
    .update(modules)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(modules.id, id));
}

// ── Permissions ──

function getPermissionSortColumn(sortBy: string | undefined): AnyPgColumn {
  switch (sortBy) {
    case 'code':
      return permissions.code;
    case 'name':
      return permissions.name;
    default:
      return permissions.createdAt;
  }
}

export async function listPermissions(query: ListPermissionsQuery) {
  const conditions: SQL[] = [];

  if (query.search) {
    const term = `%${query.search}%`;
    const searchCond = or(ilike(permissions.name, term), ilike(permissions.code, term));
    if (searchCond) conditions.push(searchCond);
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(permissions.isActive, query.isActive));
  }

  if (query.moduleId) {
    conditions.push(eq(permissions.moduleId, query.moduleId));
  }

  if (query.type) {
    conditions.push(eq(permissions.type, query.type));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ count: count() }).from(permissions).where(where);

  const totalItems = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / query.limit);

  const sortColumn = getPermissionSortColumn(query.sortBy);
  const orderFn = query.sortOrder === 'desc' ? desc : asc;

  const data = await db
    .select()
    .from(permissions)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getPermissionById(id: string) {
  const [permission] = await db.select().from(permissions).where(eq(permissions.id, id));

  if (!permission) {
    throw new NotFoundError('Permission', id);
  }

  return permission;
}

export async function createPermission(input: CreatePermissionRequest) {
  await getModuleById(input.moduleId);

  const existing = await db.select().from(permissions).where(eq(permissions.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Permission with code '${input.code}' already exists`);
  }

  const [permission] = await db.insert(permissions).values(input).returning();

  if (!permission) {
    throw new InternalServerError();
  }

  return permission;
}

export async function updatePermission(id: string, input: UpdatePermissionRequest) {
  await getPermissionById(id);

  const updateData: Partial<typeof permissions.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(permissions)
    .set(updateData)
    .where(eq(permissions.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Permission', id);
  }

  return updated;
}

export async function disablePermission(id: string) {
  await getPermissionById(id);

  await db
    .update(permissions)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(permissions.id, id));
}
