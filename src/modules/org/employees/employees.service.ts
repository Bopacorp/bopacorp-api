import type {
  CreateEmployeeRequest,
  ListEmployeesQuery,
  UpdateEmployeeRequest,
} from '@bopacorp/shared/core';
import { users } from '@db/schema/auth.js';
import { advisorSupervisors, departments, employees, orgRoles, profiles } from '@db/schema/core.js';
import { createAuditLog } from '@lib/audit.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, asc, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { getOrgRoleById } from '../org-roles/org-roles.service.js';

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

  if (query.orgRoleCode) {
    conditions.push(eq(orgRoles.code, query.orgRoleCode));
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
