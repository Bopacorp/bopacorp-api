import type {
  CreateDepartmentRequest,
  CreateEmployeeRequest,
  CreateOrgRoleRequest,
  ListDepartmentsQuery,
  ListEmployeesQuery,
  ListOrgRolesQuery,
  UpdateDepartmentRequest,
  UpdateEmployeeRequest,
  UpdateOrgRoleRequest,
} from '@bopacorp/shared/core';
import { users } from '@db/schema/auth.js';
import { createAuditLog } from '@lib/audit.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  advisorSupervisors,
  departments,
  employees,
  orgRoles,
  profiles,
} from '../../db/schema/core.js';

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

// ── Departments ──

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

// ── Org Roles ──

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

// ── Employees ──

type ClientInfo = { ipAddress?: string; userAgent?: string };

function getEmployeeSortColumn(sortBy: string | undefined): AnyPgColumn {
  switch (sortBy) {
    case 'username':
      return users.username;
    case 'email':
      return users.email;
    case 'hiredAt':
      return employees.hiredAt;
    case 'territory':
      return employees.territory;
    default:
      return employees.createdAt;
  }
}

function buildEmployeeQuery() {
  return db
    .select({
      userId: employees.userId,
      orgRoleId: employees.orgRoleId,
      territory: employees.territory,
      hiredAt: employees.hiredAt,
      isActive: employees.isActive,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
      deletedAt: employees.deletedAt,
      userUsername: users.username,
      userEmail: users.email,
      profileFirstName: profiles.firstName,
      profileLastName: profiles.lastName,
      profileAvatarUrl: profiles.avatarUrl,
      orgRoleCode: orgRoles.code,
      orgRoleName: orgRoles.name,
      deptId: departments.id,
      deptCode: departments.code,
      deptName: departments.name,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .leftJoin(orgRoles, eq(employees.orgRoleId, orgRoles.id))
    .leftJoin(departments, eq(orgRoles.departmentId, departments.id));
}

type EmployeeRow = Awaited<ReturnType<typeof buildEmployeeQuery>>[number];

function toEmployeeResponse(row: EmployeeRow) {
  return {
    userId: row.userId,
    user: {
      id: row.userId,
      username: row.userUsername ?? '',
      email: row.userEmail ?? '',
      profile: row.profileFirstName
        ? {
            firstName: row.profileFirstName,
            lastName: row.profileLastName ?? '',
            avatarUrl: row.profileAvatarUrl,
          }
        : null,
    },
    orgRole: {
      id: row.orgRoleId,
      code: row.orgRoleCode ?? '',
      name: row.orgRoleName ?? '',
      department: row.deptId
        ? { id: row.deptId, code: row.deptCode ?? '', name: row.deptName ?? '' }
        : null,
    },
    territory: row.territory,
    hiredAt: row.hiredAt,
    isActive: row.isActive,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : '',
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
  };
}

function toEmployeeListItem(row: EmployeeRow) {
  return {
    userId: row.userId,
    user: {
      id: row.userId,
      username: row.userUsername ?? '',
      email: row.userEmail ?? '',
      firstName: row.profileFirstName ?? null,
      lastName: row.profileLastName ?? null,
    },
    orgRole: {
      id: row.orgRoleId,
      name: row.orgRoleName ?? '',
    },
    territory: row.territory,
    hiredAt: row.hiredAt,
    isActive: row.isActive,
    createdAt: row.createdAt ? row.createdAt.toISOString() : '',
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
  };
}

export async function listEmployees(query: ListEmployeesQuery) {
  const conditions: SQL[] = [isNull(employees.deletedAt)];

  if (query.isActive !== undefined) {
    conditions.push(eq(employees.isActive, query.isActive));
  }

  if (query.orgRoleId) {
    conditions.push(eq(employees.orgRoleId, query.orgRoleId));
  }

  if (query.departmentId) {
    conditions.push(eq(orgRoles.departmentId, query.departmentId));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    const searchCond = or(
      ilike(users.username, term),
      ilike(users.email, term),
      ilike(profiles.firstName, term),
      ilike(profiles.lastName, term)
    );
    if (searchCond) conditions.push(searchCond);
  }

  const where = and(...conditions);

  const countResult = await db
    .select({ count: count() })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .leftJoin(orgRoles, eq(employees.orgRoleId, orgRoles.id))
    .where(where);

  const totalItems = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / query.limit);

  const sortColumn = getEmployeeSortColumn(query.sortBy);
  const orderFn = query.sortOrder === 'desc' ? desc : asc;

  const rows = await buildEmployeeQuery()
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data: rows.map(toEmployeeListItem),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getEmployeeByUserId(userId: string) {
  const [row] = await buildEmployeeQuery().where(
    and(eq(employees.userId, userId), isNull(employees.deletedAt))
  );

  if (!row) {
    throw new NotFoundError('Employee', userId);
  }

  return toEmployeeResponse(row);
}

export async function createEmployee(
  adminId: string,
  input: CreateEmployeeRequest,
  clientInfo: ClientInfo
) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, input.userId), isNull(users.deletedAt)));

  if (!user) {
    throw new NotFoundError('User', input.userId);
  }

  const [existing] = await db.select().from(employees).where(eq(employees.userId, input.userId));

  if (existing) {
    throw new ConflictError(`User '${input.userId}' already has an employee record`);
  }

  await getOrgRoleById(input.orgRoleId);

  const [employee] = await db.insert(employees).values(input).returning();

  if (!employee) {
    throw new InternalServerError();
  }

  await createAuditLog({
    tableName: 'employees',
    recordId: employee.userId,
    operation: 'I',
    userId: adminId,
    newData: { orgRoleId: input.orgRoleId, territory: input.territory, hiredAt: input.hiredAt },
    notes: 'Employee created by admin',
    ...clientInfo,
  });

  return getEmployeeByUserId(employee.userId);
}

export async function updateEmployee(
  adminId: string,
  userId: string,
  input: UpdateEmployeeRequest,
  clientInfo: ClientInfo
) {
  const existing = await getEmployeeByUserId(userId);

  if (input.orgRoleId) {
    await getOrgRoleById(input.orgRoleId);
  }

  const updateData: Partial<typeof employees.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.orgRoleId !== undefined) updateData.orgRoleId = input.orgRoleId;
  if (input.territory !== undefined) updateData.territory = input.territory;
  if (input.hiredAt !== undefined) updateData.hiredAt = input.hiredAt;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  await db.update(employees).set(updateData).where(eq(employees.userId, userId));

  await createAuditLog({
    tableName: 'employees',
    recordId: userId,
    operation: 'U',
    userId: adminId,
    oldData: {
      orgRoleId: existing.orgRole.id,
      territory: existing.territory,
      isActive: existing.isActive,
    },
    newData: {
      orgRoleId: input.orgRoleId,
      territory: input.territory,
      isActive: input.isActive,
    },
    notes: 'Employee updated by admin',
    ...clientInfo,
  });

  return getEmployeeByUserId(userId);
}

export async function deleteEmployee(adminId: string, userId: string, clientInfo: ClientInfo) {
  const existing = await getEmployeeByUserId(userId);

  await db.transaction(async (tx) => {
    await tx
      .update(employees)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(employees.userId, userId));

    await tx
      .update(advisorSupervisors)
      .set({ isActive: false })
      .where(
        or(eq(advisorSupervisors.advisorId, userId), eq(advisorSupervisors.supervisorId, userId))
      );
  });

  await createAuditLog({
    tableName: 'employees',
    recordId: userId,
    operation: 'D',
    userId: adminId,
    oldData: {
      orgRoleId: existing.orgRole.id,
      territory: existing.territory,
      isActive: existing.isActive,
    },
    notes: 'Employee soft-deleted by admin',
    ...clientInfo,
  });
}
