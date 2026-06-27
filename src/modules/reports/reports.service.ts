import type {
  CreateReportExportRequest,
  CreateSalesObjectiveRequest,
  ListAdvisorMetricsQuery,
  ListRecentActivityQuery,
  ListReportExportsQuery,
  ListSalesObjectivesQuery,
  UpdateSalesObjectiveRequest,
} from '@bopacorp/shared/reports';
import { roles, userRoles, users } from '@db/schema/auth.js';
import { advisorSupervisors, profiles } from '@db/schema/core.js';
import {
  businessClients,
  negotiationStateHistory,
  negotiationStates,
  negotiations,
  visits,
} from '@db/schema/crm.js';
import { reportExports, salesObjectives } from '@db/schema/reports.js';
import { db } from '@lib/db.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { formatDateTime } from '@shared/utils/format.js';
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

// ── Sales Objectives ──

export async function listObjectives(query: ListSalesObjectivesQuery) {
  const conditions = [];

  if (query.createdBy) {
    conditions.push(eq(salesObjectives.createdBy, query.createdBy));
  }

  if (query.advisorId) {
    conditions.push(eq(salesObjectives.advisorId, query.advisorId));
  }

  if (query.supervisorId) {
    const supervised = await db
      .select({ advisorId: advisorSupervisors.advisorId })
      .from(advisorSupervisors)
      .where(
        and(
          eq(advisorSupervisors.supervisorId, query.supervisorId),
          eq(advisorSupervisors.isActive, true)
        )
      );
    const supervisedIds = supervised.map((r) => r.advisorId);
    if (supervisedIds.length > 0) {
      conditions.push(inArray(salesObjectives.advisorId, supervisedIds));
    } else {
      conditions.push(sql`false`);
    }
  }

  if (query.periodStart) {
    conditions.push(eq(salesObjectives.periodStart, query.periodStart));
  }

  if (query.periodEnd) {
    conditions.push(eq(salesObjectives.periodEnd, query.periodEnd));
  }

  const where = conditions.length > 0 ? and(...conditions) : sql`true`;

  const totalItems = await db.$count(salesObjectives, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(salesObjectives)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(salesObjectives.createdAt);

  const data = await Promise.all(
    rows.map(async (row) => {
      const creator = await db.query.users.findFirst({
        where: eq(users.id, row.createdBy),
      });

      const advisorUser = row.advisorId
        ? await db.query.users.findFirst({
            where: eq(users.id, row.advisorId),
            with: { profile: true },
          })
        : null;

      return {
        id: row.id,
        targetSalesAmount: Number(row.targetSalesAmount),
        targetClosedDeals: row.targetClosedDeals,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        createdBy: creator
          ? {
              id: creator.id,
              username: creator.username,
              email: creator.email,
              profile: null,
            }
          : null,
        advisor: advisorUser
          ? {
              id: advisorUser.id,
              username: advisorUser.username,
              email: advisorUser.email,
              profile: advisorUser.profile
                ? {
                    firstName: advisorUser.profile.firstName,
                    lastName: advisorUser.profile.lastName,
                  }
                : null,
            }
          : null,
        createdAt: formatDateTime(row.createdAt),
        updatedAt: formatDateTime(row.updatedAt),
      };
    })
  );

  return {
    data,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getObjectiveById(id: string) {
  const row = await db.query.salesObjectives.findFirst({
    where: eq(salesObjectives.id, id),
    with: {
      creator: { with: { profile: true } },
      advisor: { with: { user: { with: { profile: true } } } },
    },
  });

  if (!row) {
    throw new NotFoundError('Sales objective', id);
  }

  return {
    id: row.id,
    targetSalesAmount: Number(row.targetSalesAmount),
    targetClosedDeals: row.targetClosedDeals,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    createdBy: row.creator
      ? {
          id: row.creator.id,
          username: row.creator.username,
          email: row.creator.email,
          profile: row.creator.profile
            ? {
                firstName: row.creator.profile.firstName,
                lastName: row.creator.profile.lastName,
              }
            : null,
        }
      : null,
    advisor: row.advisor
      ? {
          id: row.advisor.userId,
          userId: row.advisor.userId,
          profile: row.advisor.user?.profile
            ? {
                firstName: row.advisor.user.profile.firstName,
                lastName: row.advisor.user.profile.lastName,
              }
            : null,
        }
      : null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createObjective(userId: string, data: CreateSalesObjectiveRequest) {
  const [row] = await db
    .insert(salesObjectives)
    .values({
      createdBy: userId,
      advisorId: data.advisorId,
      targetSalesAmount: data.targetSalesAmount.toString(),
      targetClosedDeals: data.targetClosedDeals,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create sales objective');
  }

  return getObjectiveById(row.id);
}

export async function updateObjective(id: string, data: UpdateSalesObjectiveRequest) {
  await getObjectiveById(id);

  const updateData: Partial<typeof salesObjectives.$inferInsert> = {};

  if (data.advisorId !== undefined) updateData.advisorId = data.advisorId;
  if (data.targetSalesAmount !== undefined)
    updateData.targetSalesAmount = data.targetSalesAmount.toString();
  if (data.targetClosedDeals !== undefined) updateData.targetClosedDeals = data.targetClosedDeals;
  if (data.periodStart !== undefined) updateData.periodStart = data.periodStart;
  if (data.periodEnd !== undefined) updateData.periodEnd = data.periodEnd;

  if (Object.keys(updateData).length > 0) {
    await db.update(salesObjectives).set(updateData).where(eq(salesObjectives.id, id));
  }

  return getObjectiveById(id);
}

export async function removeObjective(id: string) {
  await getObjectiveById(id);
  await db.delete(salesObjectives).where(eq(salesObjectives.id, id));
}

// ── Report Exports ──

export async function listExports(query: ListReportExportsQuery) {
  const conditions = [];

  if (query.reportType) {
    conditions.push(eq(reportExports.reportType, query.reportType));
  }

  if (query.generatedBy) {
    conditions.push(eq(reportExports.generatedBy, query.generatedBy));
  }

  const where = conditions.length > 0 ? and(...conditions) : sql`true`;

  const totalItems = await db.$count(reportExports, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(reportExports)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(reportExports.generatedAt);

  const data = await Promise.all(
    rows.map(async (row) => {
      const generator = await db.query.users.findFirst({
        where: eq(users.id, row.generatedBy),
      });

      return {
        id: row.id,
        reportType: row.reportType,
        title: row.title,
        filename: row.filename,
        fileExtension: row.fileExtension,
        fileSizeMb: Number(row.fileSizeMb),
        storagePath: row.storagePath,
        mimeType: row.mimeType,
        generatedAt: formatDateTime(row.generatedAt),
        createdBy: generator
          ? { id: generator.id, username: generator.username }
          : { id: row.generatedBy, username: '' },
        createdAt: formatDateTime(row.createdAt),
      };
    })
  );

  return {
    data,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getExportById(id: string) {
  const row = await db.query.reportExports.findFirst({
    where: eq(reportExports.id, id),
    with: { generator: true },
  });

  if (!row) {
    throw new NotFoundError('Report export', id);
  }

  return {
    id: row.id,
    reportType: row.reportType,
    title: row.title,
    filename: row.filename,
    fileExtension: row.fileExtension,
    fileSizeMb: Number(row.fileSizeMb),
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    generatedAt: formatDateTime(row.generatedAt),
    createdBy: row.generator
      ? {
          id: row.generator.id,
          username: row.generator.username,
          email: row.generator.email,
          profile: null,
        }
      : null,
    createdAt: formatDateTime(row.createdAt),
  };
}

export async function createExport(userId: string, data: CreateReportExportRequest) {
  const [row] = await db
    .insert(reportExports)
    .values({
      generatedBy: userId,
      reportType: data.reportType,
      title: data.title,
      filename: data.filename,
      fileExtension: data.fileExtension,
      fileSizeMb: data.fileSizeMb.toString(),
      storagePath: data.storagePath,
      mimeType: data.mimeType,
      generatedAt: data.generatedAt ? new Date(data.generatedAt) : new Date(),
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create report export');
  }

  return getExportById(row.id);
}

// ── Advisor Metrics ──

function buildDateRangeConditions(
  query: ListAdvisorMetricsQuery,
  dateColumn: typeof negotiations.createdAt | typeof visits.visitDate
) {
  const conditions = [];

  if (query.dateFrom) {
    conditions.push(gte(dateColumn, new Date(query.dateFrom)));
  }

  if (query.dateTo) {
    const endOfDay = new Date(query.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(dateColumn, endOfDay));
  }

  return conditions;
}

export async function listAdvisorMetrics(query: ListAdvisorMetricsQuery) {
  const advisorRole = await db.query.roles.findFirst({
    where: eq(roles.slug, 'advisor'),
  });

  if (!advisorRole) {
    return { data: [] };
  }

  const advisorRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, advisorRole.id));

  let advisorIds = advisorRows.map((r) => r.userId);

  if (query.supervisorId) {
    const supervised = await db
      .select({ advisorId: advisorSupervisors.advisorId })
      .from(advisorSupervisors)
      .where(
        and(
          eq(advisorSupervisors.supervisorId, query.supervisorId),
          eq(advisorSupervisors.isActive, true)
        )
      );
    const supervisedIds = new Set(supervised.map((r) => r.advisorId));
    advisorIds = advisorIds.filter((id) => supervisedIds.has(id));
  }

  if (query.advisorId) {
    advisorIds = advisorIds.filter((id) => id === query.advisorId);
  }

  if (advisorIds.length === 0) {
    return { data: [] };
  }

  const allStates = await db
    .select({
      id: negotiationStates.id,
      code: negotiationStates.code,
      name: negotiationStates.name,
      position: negotiationStates.position,
    })
    .from(negotiationStates)
    .where(eq(negotiationStates.isActive, true))
    .orderBy(negotiationStates.position);

  const closingState = allStates.find((s) => s.code === 'closing');

  const advisorUsers = await db.query.users.findMany({
    where: inArray(users.id, advisorIds),
    with: { profile: true },
  });

  const userMap = new Map(advisorUsers.map((u) => [u.id, u]));

  const negotiationDateConditions = buildDateRangeConditions(query, negotiations.createdAt);

  const negotiationCounts = await db
    .select({
      advisorId: negotiations.advisorId,
      stateId: negotiations.stateId,
      count: sql<number>`count(*)::int`,
    })
    .from(negotiations)
    .where(
      and(
        inArray(negotiations.advisorId, advisorIds),
        isNull(negotiations.deletedAt),
        ...negotiationDateConditions
      )
    )
    .groupBy(negotiations.advisorId, negotiations.stateId);

  const negCountMap = new Map<string, Map<string, number>>();
  for (const row of negotiationCounts) {
    if (!negCountMap.has(row.advisorId)) {
      negCountMap.set(row.advisorId, new Map());
    }
    negCountMap.get(row.advisorId)?.set(row.stateId, row.count);
  }

  const visitDateConditions = buildDateRangeConditions(query, visits.visitDate);

  const visitCounts = await db
    .select({
      advisorId: visits.advisorId,
      count: sql<number>`count(distinct ${visits.clientId})::int`,
    })
    .from(visits)
    .where(
      and(inArray(visits.advisorId, advisorIds), isNull(visits.deletedAt), ...visitDateConditions)
    )
    .groupBy(visits.advisorId);

  const visitMap = new Map(visitCounts.map((r) => [r.advisorId, r.count]));

  const billingRows = await db
    .select({
      advisorId: businessClients.advisorId,
      totalBilled: sql<number>`coalesce(sum(${businessClients.currentMonthlyBilling}), 0)`,
      totalServices: sql<number>`coalesce(sum(${businessClients.activeServicesCount}), 0)`,
    })
    .from(businessClients)
    .where(and(inArray(businessClients.advisorId, advisorIds), isNull(businessClients.deletedAt)))
    .groupBy(businessClients.advisorId);

  const billingMap = new Map(
    billingRows.map((r) => [
      r.advisorId,
      { billed: Number(r.totalBilled), services: Number(r.totalServices) },
    ])
  );

  let closingDaysMap = new Map<string, number>();
  if (closingState) {
    const closingDaysRows = await db
      .select({
        advisorId: negotiations.advisorId,
        avgDays: sql<number>`round(avg(extract(epoch from (${negotiationStateHistory.createdAt} - ${negotiations.createdAt})) / 86400)::numeric, 1)`,
      })
      .from(negotiationStateHistory)
      .innerJoin(negotiations, eq(negotiationStateHistory.negotiationId, negotiations.id))
      .where(
        and(
          eq(negotiationStateHistory.newStateId, closingState.id),
          inArray(negotiations.advisorId, advisorIds),
          isNull(negotiations.deletedAt),
          ...negotiationDateConditions
        )
      )
      .groupBy(negotiations.advisorId);

    closingDaysMap = new Map(closingDaysRows.map((r) => [r.advisorId, Number(r.avgDays)]));
  }

  const data = advisorIds
    .map((advisorId) => {
      const user = userMap.get(advisorId);
      if (!user) return null;

      const negCounts = negCountMap.get(advisorId);
      const billing = billingMap.get(advisorId) ?? { billed: 0, services: 0 };

      const stateCounts = allStates.map((state) => ({
        stateId: state.id,
        stateCode: state.code,
        stateName: state.name,
        count: negCounts?.get(state.id) ?? 0,
      }));

      return {
        advisor: {
          id: user.id,
          username: user.username,
          profile: user.profile
            ? { firstName: user.profile.firstName, lastName: user.profile.lastName }
            : null,
        },
        stateCounts,
        clientsVisited: visitMap.get(advisorId) ?? 0,
        totalBilledAmount: billing.billed,
        averageBillingPerService:
          billing.services > 0 ? Math.round((billing.billed / billing.services) * 100) / 100 : 0,
        avgDaysToClose: closingDaysMap.get(advisorId) ?? null,
      };
    })
    .filter(Boolean);

  return { data };
}

// ── Recent Activity ──

interface DateRangeFilter {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

function buildTimestampRangeConditions(
  filter: DateRangeFilter,
  dateColumn: typeof negotiationStateHistory.createdAt | typeof visits.createdAt
) {
  const conditions = [];
  if (filter.dateFrom) {
    conditions.push(gte(dateColumn, new Date(filter.dateFrom)));
  }
  if (filter.dateTo) {
    const endOfDay = new Date(filter.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(dateColumn, endOfDay));
  }
  return conditions;
}

export async function listRecentActivity(query: ListRecentActivityQuery) {
  const stateChangeConditions = [
    ...buildTimestampRangeConditions(query, negotiationStateHistory.createdAt),
  ];

  const visitConditions = [
    isNull(visits.deletedAt),
    ...buildTimestampRangeConditions(query, visits.createdAt),
  ];

  if (query.advisorId) {
    stateChangeConditions.push(eq(negotiations.advisorId, query.advisorId));
    visitConditions.push(eq(visits.advisorId, query.advisorId));
  }

  const prevState = db
    .select({ id: negotiationStates.id, name: negotiationStates.name })
    .from(negotiationStates)
    .as('prev_state');

  const newState = db
    .select({ id: negotiationStates.id, name: negotiationStates.name })
    .from(negotiationStates)
    .as('new_state');

  const stateChanges = await db
    .select({
      advisorFirstName: profiles.firstName,
      advisorLastName: profiles.lastName,
      clientName: businessClients.businessName,
      prevStateName: prevState.name,
      newStateName: newState.name,
      createdAt: negotiationStateHistory.createdAt,
    })
    .from(negotiationStateHistory)
    .innerJoin(negotiations, eq(negotiationStateHistory.negotiationId, negotiations.id))
    .innerJoin(businessClients, eq(negotiations.clientId, businessClients.id))
    .innerJoin(profiles, eq(negotiations.advisorId, profiles.userId))
    .innerJoin(newState, eq(negotiationStateHistory.newStateId, newState.id))
    .leftJoin(prevState, eq(negotiationStateHistory.previousStateId, prevState.id))
    .where(and(isNull(negotiations.deletedAt), ...stateChangeConditions))
    .orderBy(desc(negotiationStateHistory.createdAt))
    .limit(query.limit * 2);

  const visitRows = await db
    .select({
      advisorFirstName: profiles.firstName,
      advisorLastName: profiles.lastName,
      clientName: businessClients.businessName,
      createdAt: visits.createdAt,
    })
    .from(visits)
    .innerJoin(businessClients, eq(visits.clientId, businessClients.id))
    .innerJoin(profiles, eq(visits.advisorId, profiles.userId))
    .where(and(...visitConditions))
    .orderBy(desc(visits.createdAt))
    .limit(query.limit * 2);

  const combined = [
    ...stateChanges.map((r) => ({
      type: 'state_change' as const,
      advisorName: `${r.advisorFirstName} ${r.advisorLastName}`,
      clientName: r.clientName,
      description: r.prevStateName
        ? `${r.prevStateName} -> ${r.newStateName}`
        : `${r.newStateName}`,
      createdAt: formatDateTime(r.createdAt),
    })),
    ...visitRows.map((r) => ({
      type: 'visit' as const,
      advisorName: `${r.advisorFirstName} ${r.advisorLastName}`,
      clientName: r.clientName,
      description: 'Visited client',
      createdAt: formatDateTime(r.createdAt),
    })),
  ];

  combined.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalItems = combined.length;
  const totalPages = Math.ceil(totalItems / query.limit);
  const offset = (query.page - 1) * query.limit;
  const data = combined.slice(offset, offset + query.limit);

  return {
    data,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}
