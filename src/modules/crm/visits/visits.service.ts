import type {
  CreateVisitRequest,
  ListVisitsQuery,
  UpdateVisitRequest,
  VerifyVisitRequest,
} from '@bopacorp/shared/crm';
import { users } from '@db/schema/auth.js';
import { employees, profiles } from '@db/schema/core.js';
import { businessClients, negotiations, visits, visitTypes } from '@db/schema/crm.js';
import { db } from '@lib/db.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { getSupervisedAdvisorIds } from '@shared/utils/scoping.js';
import type { AnyColumn } from 'drizzle-orm';
import { and, eq, gte, ilike, inArray, isNull, lte, type SQL, sql } from 'drizzle-orm';
import { formatDateTime, getOrderBy } from '../crm.helpers.js';

function getSortColumn(sortBy?: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    visitDate: visits.visitDate,
    createdAt: visits.createdAt,
  };
  return (sortBy && map[sortBy]) || visits.visitDate;
}

export async function listVisits(
  query: ListVisitsQuery,
  user: NonNullable<Express.Request['user']>
) {
  let advisorIds: string[] | undefined;
  if (user.roles.includes('advisor')) {
    advisorIds = [user.id];
  } else if (user.roles.includes('supervisor')) {
    advisorIds = await getSupervisedAdvisorIds(user.id);
    if (query.advisorId) {
      advisorIds = advisorIds.filter((id) => id === query.advisorId);
    }
  } else if (query.advisorId) {
    advisorIds = [query.advisorId];
  }

  const conditions = [];
  conditions.push(isNull(visits.deletedAt));

  if (query.isVerified !== undefined) {
    conditions.push(eq(visits.isVerified, query.isVerified));
  }

  if (query.clientId) {
    conditions.push(eq(visits.clientId, query.clientId));
  }

  if (advisorIds && advisorIds.length > 0) {
    conditions.push(inArray(visits.advisorId, advisorIds));
  }

  if (query.visitTypeId) {
    conditions.push(eq(visits.visitTypeId, query.visitTypeId));
  }

  if (query.dateFrom) {
    conditions.push(gte(visits.visitDate, new Date(query.dateFrom)));
  }

  if (query.dateTo) {
    const endOfDay = new Date(query.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(visits.visitDate, endOfDay));
  }

  if (query.search) {
    conditions.push(ilike(visits.observations, `%${query.search}%`));
  }

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(visits, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: visits.id,
      visitDate: visits.visitDate,
      isVerified: visits.isVerified,
      createdAt: visits.createdAt,
      updatedAt: visits.updatedAt,
      client: { id: businessClients.id, businessName: businessClients.businessName },
      advisorId: users.id,
      advisorUsername: users.username,
      advisorFirstName: profiles.firstName,
      advisorLastName: profiles.lastName,
      visitType: { id: visitTypes.id, code: visitTypes.code, name: visitTypes.name },
    })
    .from(visits)
    .innerJoin(businessClients, eq(visits.clientId, businessClients.id))
    .innerJoin(users, eq(visits.advisorId, users.id))
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .innerJoin(visitTypes, eq(visits.visitTypeId, visitTypes.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(getOrderBy(getSortColumn(query.sortBy), query.sortOrder));

  return {
    data: rows.map((row) => ({
      id: row.id,
      visitDate: formatDateTime(row.visitDate),
      isVerified: row.isVerified,
      client: row.client,
      advisor: {
        id: row.advisorId,
        username: row.advisorUsername,
        profile:
          row.advisorFirstName && row.advisorLastName
            ? { firstName: row.advisorFirstName, lastName: row.advisorLastName }
            : null,
      },
      visitType: row.visitType,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getVisitById(id: string) {
  const row = await db.query.visits.findFirst({
    where: and(eq(visits.id, id), isNull(visits.deletedAt)),
    with: {
      client: true,
      advisor: { with: { user: { with: { profile: true } } } },
      visitType: true,
      verifiedBy: true,
      negotiation: { with: { client: true } },
    },
  });

  if (!row) {
    throw new NotFoundError('Visit', id);
  }

  const advisor = row.advisor;
  const user = advisor?.user;
  const profile = user?.profile;

  return {
    id: row.id,
    visitDate: formatDateTime(row.visitDate),
    observations: row.observations,
    isVerified: row.isVerified,
    supervisorComment: row.supervisorComment,
    gpsLatitude: row.gpsLatitude ? Number(row.gpsLatitude) : null,
    gpsLongitude: row.gpsLongitude ? Number(row.gpsLongitude) : null,
    gpsAccuracy: row.gpsAccuracy ? Number(row.gpsAccuracy) : null,
    gpsTimestamp: row.gpsTimestamp ? formatDateTime(row.gpsTimestamp) : null,
    negotiation: row.negotiation
      ? {
          id: row.negotiation.id,
          client: {
            id: row.negotiation.client.id,
            businessName: row.negotiation.client.businessName,
          },
        }
      : null,
    client: {
      id: row.client.id,
      businessName: row.client.businessName,
      contactName: row.client.contactName,
    },
    advisor: {
      id: advisor.userId,
      username: user?.username ?? '',
      email: user?.email ?? '',
      profile: profile ? { firstName: profile.firstName, lastName: profile.lastName } : null,
    },
    verifiedBy: row.verifiedBy
      ? { id: row.verifiedBy.id, username: row.verifiedBy.username }
      : null,
    visitType: {
      id: row.visitType.id,
      name: row.visitType.name,
    },
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createVisit(data: CreateVisitRequest) {
  const client = await db.query.businessClients.findFirst({
    where: and(eq(businessClients.id, data.clientId), isNull(businessClients.deletedAt)),
  });

  if (!client) {
    throw new NotFoundError('Business client', data.clientId);
  }

  const advisor = await db.query.employees.findFirst({
    where: eq(employees.userId, data.advisorId),
  });

  if (!advisor) {
    throw new NotFoundError('Advisor', data.advisorId);
  }

  const visitType = await db.query.visitTypes.findFirst({
    where: eq(visitTypes.id, data.visitTypeId),
  });

  if (!visitType) {
    throw new NotFoundError('Visit type', data.visitTypeId);
  }

  if (data.negotiationId) {
    const negotiation = await db.query.negotiations.findFirst({
      where: and(eq(negotiations.id, data.negotiationId), isNull(negotiations.deletedAt)),
    });

    if (!negotiation) {
      throw new NotFoundError('Negotiation', data.negotiationId);
    }
  }

  const [row] = await db
    .insert(visits)
    .values({
      negotiationId: data.negotiationId,
      clientId: data.clientId,
      advisorId: data.advisorId,
      visitTypeId: data.visitTypeId,
      visitDate: new Date(data.visitDate),
      observations: data.observations,
      gpsLatitude: data.gpsLatitude?.toString(),
      gpsLongitude: data.gpsLongitude?.toString(),
      gpsAccuracy: data.gpsAccuracy?.toString(),
      gpsTimestamp: data.gpsTimestamp ? new Date(data.gpsTimestamp) : null,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create visit');
  }

  return getVisitById(row.id);
}

export async function updateVisit(id: string, data: UpdateVisitRequest) {
  await getVisitById(id);

  const updateData: Partial<typeof visits.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.clientId !== undefined) {
    const client = await db.query.businessClients.findFirst({
      where: and(eq(businessClients.id, data.clientId), isNull(businessClients.deletedAt)),
    });

    if (!client) {
      throw new NotFoundError('Business client', data.clientId);
    }
    updateData.clientId = data.clientId;
  }

  if (data.advisorId !== undefined) {
    const advisor = await db.query.employees.findFirst({
      where: eq(employees.userId, data.advisorId),
    });

    if (!advisor) {
      throw new NotFoundError('Advisor', data.advisorId);
    }
    updateData.advisorId = data.advisorId;
  }

  if (data.visitTypeId !== undefined) {
    const visitType = await db.query.visitTypes.findFirst({
      where: eq(visitTypes.id, data.visitTypeId),
    });

    if (!visitType) {
      throw new NotFoundError('Visit type', data.visitTypeId);
    }
    updateData.visitTypeId = data.visitTypeId;
  }

  if (data.negotiationId !== undefined) {
    if (data.negotiationId) {
      const negotiation = await db.query.negotiations.findFirst({
        where: and(eq(negotiations.id, data.negotiationId), isNull(negotiations.deletedAt)),
      });

      if (!negotiation) {
        throw new NotFoundError('Negotiation', data.negotiationId);
      }
    }
    updateData.negotiationId = data.negotiationId;
  }

  if (data.visitDate !== undefined) updateData.visitDate = new Date(data.visitDate);
  if (data.observations !== undefined) updateData.observations = data.observations;
  if (data.gpsLatitude !== undefined) updateData.gpsLatitude = data.gpsLatitude?.toString();
  if (data.gpsLongitude !== undefined) updateData.gpsLongitude = data.gpsLongitude?.toString();
  if (data.gpsAccuracy !== undefined) updateData.gpsAccuracy = data.gpsAccuracy?.toString();
  if (data.gpsTimestamp !== undefined)
    updateData.gpsTimestamp = data.gpsTimestamp ? new Date(data.gpsTimestamp) : null;

  if (Object.keys(updateData).length > 1) {
    await db.update(visits).set(updateData).where(eq(visits.id, id));
  }

  return getVisitById(id);
}

export async function removeVisit(id: string) {
  await getVisitById(id);
  await db.update(visits).set({ deletedAt: new Date() }).where(eq(visits.id, id));
}

export async function verifyVisit(id: string, userId: string, data: VerifyVisitRequest) {
  await getVisitById(id);

  await db
    .update(visits)
    .set({
      isVerified: data.isVerified,
      verifiedBy: userId,
      supervisorComment: data.supervisorComment,
      updatedAt: new Date(),
    })
    .where(eq(visits.id, id));

  return getVisitById(id);
}
