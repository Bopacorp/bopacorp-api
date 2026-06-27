import type {
  CreateReportExportRequest,
  ListAdvisorMetricsQuery,
  ListAdvisorPerformanceQuery,
  ListRecentActivityQuery,
  ListReportExportsQuery,
  UpdateSalesTargetRequest,
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
import { reportExports, salesTargets } from '@db/schema/reports.js';
import { db } from '@lib/db.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { formatDateTime } from '@shared/utils/format.js';
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

// ── Sales Targets ──

export async function listTargets() {
  const rows = await db
    .select()
    .from(salesTargets)
    .where(eq(salesTargets.isActive, true))
    .orderBy(desc(salesTargets.minBilling));

  return {
    data: rows.map((row) => ({
      id: row.id,
      tierCode: row.tierCode,
      tierLabel: row.tierLabel,
      minBilling: Number(row.minBilling),
      maxBilling: row.maxBilling ? Number(row.maxBilling) : null,
      minCloses: row.minCloses,
      isActive: row.isActive,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
  };
}

export async function updateTarget(id: string, data: UpdateSalesTargetRequest) {
  const existing = await db.select().from(salesTargets).where(eq(salesTargets.id, id)).limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Sales target', id);
  }

  const updateData: Partial<typeof salesTargets.$inferInsert> = {};

  if (data.tierLabel !== undefined) updateData.tierLabel = data.tierLabel;
  if (data.minBilling !== undefined) updateData.minBilling = data.minBilling.toString();
  if (data.maxBilling !== undefined)
    updateData.maxBilling = data.maxBilling !== null ? data.maxBilling.toString() : null;
  if (data.minCloses !== undefined) updateData.minCloses = data.minCloses;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date();
    await db.update(salesTargets).set(updateData).where(eq(salesTargets.id, id));
  }

  const [updated] = await db.select().from(salesTargets).where(eq(salesTargets.id, id));

  if (!updated) {
    throw new NotFoundError('Sales target', id);
  }

  return {
    id: updated.id,
    tierCode: updated.tierCode,
    tierLabel: updated.tierLabel,
    minBilling: Number(updated.minBilling),
    maxBilling: updated.maxBilling ? Number(updated.maxBilling) : null,
    minCloses: updated.minCloses,
    isActive: updated.isActive,
    createdAt: formatDateTime(updated.createdAt),
    updatedAt: formatDateTime(updated.updatedAt),
  };
}

// ── Advisor Performance ──

async function getAdvisorIds(supervisorId?: string | undefined) {
  const advisorRole = await db.query.roles.findFirst({
    where: eq(roles.slug, 'advisor'),
  });

  if (!advisorRole) return [];

  const advisorRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, advisorRole.id));

  let advisorIds = advisorRows.map((r) => r.userId);

  if (supervisorId) {
    const supervised = await db
      .select({ advisorId: advisorSupervisors.advisorId })
      .from(advisorSupervisors)
      .where(
        and(
          eq(advisorSupervisors.supervisorId, supervisorId),
          eq(advisorSupervisors.isActive, true)
        )
      );
    const supervisedIds = new Set(supervised.map((r) => r.advisorId));
    advisorIds = advisorIds.filter((id) => supervisedIds.has(id));
  }

  return advisorIds;
}

export async function getAdvisorPerformance(query: ListAdvisorPerformanceQuery) {
  const targets = await db
    .select()
    .from(salesTargets)
    .where(eq(salesTargets.isActive, true))
    .orderBy(desc(salesTargets.minBilling));

  if (targets.length === 0) {
    return { data: [] };
  }

  const advisorIds = await getAdvisorIds(query.supervisorId);
  if (advisorIds.length === 0) {
    return { data: [] };
  }

  const closingState = await db
    .select({ id: negotiationStates.id })
    .from(negotiationStates)
    .where(and(eq(negotiationStates.code, 'closing'), eq(negotiationStates.isActive, true)))
    .limit(1);

  const closingRow = closingState[0];
  if (!closingRow) {
    return { data: [] };
  }

  const closingStateId = closingRow.id;

  const dateConditions = [];
  if (query.dateFrom) {
    dateConditions.push(gte(negotiationStateHistory.createdAt, new Date(query.dateFrom)));
  }
  if (query.dateTo) {
    const endOfDay = new Date(query.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    dateConditions.push(lte(negotiationStateHistory.createdAt, endOfDay));
  }

  const tierCaseFragments = targets.map((t) => {
    const min = Number(t.minBilling);
    const max = t.maxBilling ? Number(t.maxBilling) : null;
    if (max === null) {
      return sql`WHEN ${businessClients.currentMonthlyBilling} >= ${min} THEN ${t.tierCode}`;
    }
    return sql`WHEN ${businessClients.currentMonthlyBilling} >= ${min} AND ${businessClients.currentMonthlyBilling} <= ${max} THEN ${t.tierCode}`;
  });

  const tierCaseExpr = sql`CASE ${sql.join(tierCaseFragments, sql` `)} ELSE 'UNKNOWN' END`;

  const closedCounts = await db
    .select({
      advisorId: negotiations.advisorId,
      tierCode: sql<string>`${tierCaseExpr}`.as('tier_code'),
      count: sql<number>`count(*)::int`.as('closed_count'),
    })
    .from(negotiationStateHistory)
    .innerJoin(negotiations, eq(negotiationStateHistory.negotiationId, negotiations.id))
    .innerJoin(businessClients, eq(negotiations.clientId, businessClients.id))
    .where(
      and(
        eq(negotiationStateHistory.newStateId, closingStateId),
        inArray(negotiations.advisorId, advisorIds),
        isNull(negotiations.deletedAt),
        isNull(businessClients.deletedAt),
        ...dateConditions
      )
    )
    .groupBy(negotiations.advisorId, sql`tier_code`);

  const countMap = new Map<string, Map<string, number>>();
  for (const row of closedCounts) {
    if (!countMap.has(row.advisorId)) {
      countMap.set(row.advisorId, new Map());
    }
    countMap.get(row.advisorId)?.set(row.tierCode, row.count);
  }

  const advisorUsers = await db.query.users.findMany({
    where: inArray(users.id, advisorIds),
    with: { profile: true },
  });

  const data = advisorUsers.map((user) => {
    const advisorCounts = countMap.get(user.id);

    const tiers = targets.map((t) => {
      const closedCount = advisorCounts?.get(t.tierCode) ?? 0;
      return {
        tierCode: t.tierCode,
        tierLabel: t.tierLabel,
        closedCount,
        minCloses: t.minCloses,
        met: closedCount >= t.minCloses,
      };
    });

    const totalClosed = tiers.reduce((sum, t) => sum + t.closedCount, 0);
    const totalRequired = tiers.reduce((sum, t) => sum + t.minCloses, 0);

    return {
      advisor: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile: user.profile
          ? { firstName: user.profile.firstName, lastName: user.profile.lastName }
          : null,
      },
      tiers,
      totalClosed,
      totalRequired,
      overallMet: tiers.every((t) => t.met),
    };
  });

  return { data };
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
  let advisorIds = await getAdvisorIds(query.supervisorId);

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
