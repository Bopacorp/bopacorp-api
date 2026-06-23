import type {
  CreateBusinessClientRequest,
  ListBusinessClientsQuery,
  UpdateBusinessClientRequest,
} from '@bopacorp/shared/crm';
import { users } from '@db/schema/auth.js';
import { employees, profiles } from '@db/schema/core.js';
import { businessClients } from '@db/schema/crm.js';
import { db } from '@lib/db.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import type { AnyColumn } from 'drizzle-orm';
import { and, eq, ilike, isNull, or, type SQL, sql } from 'drizzle-orm';
import { formatDateTime, getOrderBy } from '../crm.helpers.js';

function getSortColumn(sortBy?: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    businessName: businessClients.businessName,
    contactName: businessClients.contactName,
    ruc: businessClients.ruc,
    createdAt: businessClients.createdAt,
    updatedAt: businessClients.updatedAt,
  };
  return (sortBy && map[sortBy]) || businessClients.updatedAt;
}

export async function listBusinessClients(
  query: ListBusinessClientsQuery,
  user: NonNullable<Express.Request['user']>
) {
  const advisorId = user.roles.includes('advisor') ? user.id : query.advisorId;

  const conditions = [];
  conditions.push(isNull(businessClients.deletedAt));

  if (query.isActive !== undefined) {
    conditions.push(eq(businessClients.isActive, query.isActive));
  }

  if (advisorId) {
    conditions.push(eq(businessClients.advisorId, advisorId));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(businessClients.businessName, term),
        ilike(businessClients.contactName, term),
        ilike(businessClients.ruc, term)
      ) as SQL<unknown>
    );
  }

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(businessClients, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: businessClients.id,
      ruc: businessClients.ruc,
      businessName: businessClients.businessName,
      contactName: businessClients.contactName,
      isActive: businessClients.isActive,
      createdAt: businessClients.createdAt,
      updatedAt: businessClients.updatedAt,
      advisorId: users.id,
      advisorUsername: users.username,
      advisorFirstName: profiles.firstName,
      advisorLastName: profiles.lastName,
    })
    .from(businessClients)
    .leftJoin(users, eq(businessClients.advisorId, users.id))
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(getOrderBy(getSortColumn(query.sortBy), query.sortOrder));

  return {
    data: rows.map((row) => ({
      id: row.id,
      ruc: row.ruc,
      businessName: row.businessName,
      contactName: row.contactName,
      isActive: row.isActive,
      advisor: row.advisorId
        ? {
            id: row.advisorId,
            username: row.advisorUsername ?? '',
            profile:
              row.advisorFirstName && row.advisorLastName
                ? { firstName: row.advisorFirstName, lastName: row.advisorLastName }
                : null,
          }
        : null,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getBusinessClientById(id: string) {
  const row = await db.query.businessClients.findFirst({
    where: and(eq(businessClients.id, id), isNull(businessClients.deletedAt)),
    with: { advisor: { with: { user: { with: { profile: true } } } } },
  });

  if (!row) {
    throw new NotFoundError('Business client', id);
  }

  const advisor = row.advisor;
  const user = advisor?.user;
  const profile = user?.profile;

  return {
    id: row.id,
    ruc: row.ruc,
    businessName: row.businessName,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    address: row.address,
    activeServicesCount: row.activeServicesCount,
    currentMonthlyBilling: Number(row.currentMonthlyBilling),
    isActive: row.isActive,
    advisor: advisor
      ? {
          id: advisor.userId,
          username: user?.username ?? '',
          email: user?.email ?? '',
          profile: profile ? { firstName: profile.firstName, lastName: profile.lastName } : null,
        }
      : null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createBusinessClient(data: CreateBusinessClientRequest, userId: string) {
  const existing = await db
    .select()
    .from(businessClients)
    .where(and(eq(businessClients.ruc, data.ruc), isNull(businessClients.deletedAt)));

  if (existing.length > 0) {
    throw new ConflictError('Business client with this RUC already exists');
  }

  let advisorId = data.advisorId;
  if (!advisorId) {
    const currentEmployee = await db.query.employees.findFirst({
      where: eq(employees.userId, userId),
    });
    if (currentEmployee) {
      advisorId = userId;
    }
  }

  if (advisorId) {
    const advisor = await db.query.employees.findFirst({
      where: eq(employees.userId, advisorId),
    });

    if (!advisor) {
      throw new NotFoundError('Advisor', advisorId);
    }
  }

  const [row] = await db
    .insert(businessClients)
    .values({
      advisorId,
      ruc: data.ruc,
      businessName: data.businessName,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      address: data.address,
      activeServicesCount: data.activeServicesCount,
      currentMonthlyBilling: data.currentMonthlyBilling.toString(),
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create business client');
  }

  return getBusinessClientById(row.id);
}

export async function updateBusinessClient(id: string, data: UpdateBusinessClientRequest) {
  await getBusinessClientById(id);

  const updateData: Partial<typeof businessClients.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.ruc !== undefined) {
    const existing = await db
      .select()
      .from(businessClients)
      .where(and(eq(businessClients.ruc, data.ruc), isNull(businessClients.deletedAt)));

    if (existing.length > 0 && existing[0]?.id !== id) {
      throw new ConflictError('Business client with this RUC already exists');
    }
    updateData.ruc = data.ruc;
  }

  if (data.advisorId !== undefined) {
    if (data.advisorId) {
      const advisor = await db.query.employees.findFirst({
        where: eq(employees.userId, data.advisorId),
      });

      if (!advisor) {
        throw new NotFoundError('Advisor', data.advisorId);
      }
    }
    updateData.advisorId = data.advisorId;
  }

  if (data.businessName !== undefined) updateData.businessName = data.businessName;
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.activeServicesCount !== undefined)
    updateData.activeServicesCount = data.activeServicesCount;
  if (data.currentMonthlyBilling !== undefined)
    updateData.currentMonthlyBilling = data.currentMonthlyBilling.toString();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(businessClients).set(updateData).where(eq(businessClients.id, id));
  }

  return getBusinessClientById(id);
}

export async function removeBusinessClient(id: string) {
  await getBusinessClientById(id);
  await db.update(businessClients).set({ deletedAt: new Date() }).where(eq(businessClients.id, id));
}
