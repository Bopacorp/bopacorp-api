import type {
  AssignAdvisorSupervisorsRequest,
  ListAdvisorSupervisorsQuery,
} from '@bopacorp/shared/core';
import { users } from '@db/schema/auth.js';
import { advisorSupervisors, employees, orgRoles, profiles } from '@db/schema/core.js';
import { createAuditLog } from '@lib/audit.js';
import { db } from '@lib/db.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { and, asc, count, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getEmployeeByUserId } from '../employees/employees.service.js';

type ClientInfo = { ipAddress?: string; userAgent?: string };

const advUsers = alias(users, 'adv_users');
const advProfiles = alias(profiles, 'adv_profiles');
const advOrgRoles = alias(orgRoles, 'adv_org_roles');
const supUsers = alias(users, 'sup_users');
const supProfiles = alias(profiles, 'sup_profiles');
const supOrgRoles = alias(orgRoles, 'sup_org_roles');

function buildAdvisorSupervisorQuery() {
  return db
    .select({
      advisorId: advisorSupervisors.advisorId,
      supervisorId: advisorSupervisors.supervisorId,
      isActive: advisorSupervisors.isActive,
      assignedAt: advisorSupervisors.assignedAt,
      advUsername: advUsers.username,
      advEmail: advUsers.email,
      advFirstName: advProfiles.firstName,
      advLastName: advProfiles.lastName,
      advOrgRoleId: advOrgRoles.id,
      advOrgRoleName: advOrgRoles.name,
      supUsername: supUsers.username,
      supEmail: supUsers.email,
      supFirstName: supProfiles.firstName,
      supLastName: supProfiles.lastName,
      supOrgRoleId: supOrgRoles.id,
      supOrgRoleName: supOrgRoles.name,
    })
    .from(advisorSupervisors)
    .leftJoin(advUsers, eq(advisorSupervisors.advisorId, advUsers.id))
    .leftJoin(advProfiles, eq(advUsers.id, advProfiles.userId))
    .leftJoin(
      advOrgRoles,
      eq(
        advOrgRoles.id,
        db
          .select({ id: employees.orgRoleId })
          .from(employees)
          .where(eq(employees.userId, advisorSupervisors.advisorId))
      )
    )
    .leftJoin(supUsers, eq(advisorSupervisors.supervisorId, supUsers.id))
    .leftJoin(supProfiles, eq(supUsers.id, supProfiles.userId))
    .leftJoin(
      supOrgRoles,
      eq(
        supOrgRoles.id,
        db
          .select({ id: employees.orgRoleId })
          .from(employees)
          .where(eq(employees.userId, advisorSupervisors.supervisorId))
      )
    );
}

type AdvisorSupervisorRow = Awaited<ReturnType<typeof buildAdvisorSupervisorQuery>>[number];

function toAdvisorSupervisorResponse(row: AdvisorSupervisorRow) {
  return {
    advisorId: row.advisorId,
    supervisorId: row.supervisorId,
    isActive: row.isActive,
    assignedAt: row.assignedAt ? row.assignedAt.toISOString() : '',
    advisor: {
      id: row.advisorId,
      username: row.advUsername ?? '',
      email: row.advEmail ?? '',
      profile: row.advFirstName
        ? { firstName: row.advFirstName, lastName: row.advLastName ?? '' }
        : null,
      orgRole: { id: row.advOrgRoleId ?? '', name: row.advOrgRoleName ?? '' },
    },
    supervisor: {
      id: row.supervisorId,
      username: row.supUsername ?? '',
      email: row.supEmail ?? '',
      profile: row.supFirstName
        ? { firstName: row.supFirstName, lastName: row.supLastName ?? '' }
        : null,
      orgRole: { id: row.supOrgRoleId ?? '', name: row.supOrgRoleName ?? '' },
    },
  };
}

export async function listSupervisors(userId: string, query: ListAdvisorSupervisorsQuery) {
  await getEmployeeByUserId(userId);

  const conditions: SQL[] = [eq(advisorSupervisors.advisorId, userId)];

  if (query.isActive !== undefined) {
    conditions.push(eq(advisorSupervisors.isActive, query.isActive));
  }

  const where = and(...conditions);

  const countResult = await db.select({ count: count() }).from(advisorSupervisors).where(where);

  const totalItems = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await buildAdvisorSupervisorQuery()
    .where(where)
    .orderBy(asc(advisorSupervisors.assignedAt))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data: rows.map(toAdvisorSupervisorResponse),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function listAdvisors(userId: string, query: ListAdvisorSupervisorsQuery) {
  await getEmployeeByUserId(userId);

  const conditions: SQL[] = [eq(advisorSupervisors.supervisorId, userId)];

  if (query.isActive !== undefined) {
    conditions.push(eq(advisorSupervisors.isActive, query.isActive));
  }

  const where = and(...conditions);

  const countResult = await db.select({ count: count() }).from(advisorSupervisors).where(where);

  const totalItems = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await buildAdvisorSupervisorQuery()
    .where(where)
    .orderBy(asc(advisorSupervisors.assignedAt))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  return {
    data: rows.map(toAdvisorSupervisorResponse),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function assignSupervisors(
  adminId: string,
  userId: string,
  input: AssignAdvisorSupervisorsRequest,
  clientInfo: ClientInfo
) {
  await getEmployeeByUserId(userId);

  if (input.supervisorIds.includes(userId)) {
    throw new ConflictError('An employee cannot supervise themselves');
  }

  const existingEmployees = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(and(inArray(employees.userId, input.supervisorIds), isNull(employees.deletedAt)));

  if (existingEmployees.length !== input.supervisorIds.length) {
    const found = new Set(existingEmployees.map((e) => e.userId));
    const missing = input.supervisorIds.filter((id) => !found.has(id));
    throw new NotFoundError('Employee', missing.join(', '));
  }

  const oldSupervisors = await db
    .select({ supervisorId: advisorSupervisors.supervisorId })
    .from(advisorSupervisors)
    .where(eq(advisorSupervisors.advisorId, userId));

  await db.transaction(async (tx) => {
    await tx.delete(advisorSupervisors).where(eq(advisorSupervisors.advisorId, userId));

    await tx.insert(advisorSupervisors).values(
      input.supervisorIds.map((supervisorId) => ({
        advisorId: userId,
        supervisorId,
      }))
    );
  });

  await createAuditLog({
    tableName: 'advisor_supervisors',
    recordId: userId,
    operation: 'U',
    userId: adminId,
    oldData: { supervisorIds: oldSupervisors.map((s) => s.supervisorId) },
    newData: { supervisorIds: input.supervisorIds },
    notes: 'Supervisors reassigned by admin',
    ...clientInfo,
  });

  return listSupervisors(userId, { page: 1, limit: 100, sortOrder: 'asc' });
}
