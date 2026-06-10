import type {
  CreateReportExportRequest,
  CreateSalesObjectiveRequest,
  ListReportExportsQuery,
  ListSalesObjectivesQuery,
  UpdateSalesObjectiveRequest,
} from '@bopacorp/shared/reports';
import { users } from '@db/schema/auth.js';
import { employees } from '@db/schema/core.js';
import { reportExports, salesObjectives } from '@db/schema/reports.js';
import { db } from '@lib/db.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, sql } from 'drizzle-orm';

// ── Helpers ──

function formatDateTime(d: Date | null): string {
  return d ? d.toISOString() : '';
}

// ── Sales Objectives ──

export async function listObjectives(query: ListSalesObjectivesQuery) {
  const conditions = [];

  if (query.createdBy) {
    conditions.push(eq(salesObjectives.createdBy, query.createdBy));
  }

  if (query.advisorId) {
    conditions.push(eq(salesObjectives.advisorId, query.advisorId));
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

      const advisor = row.advisorId
        ? await db.query.employees.findFirst({
            where: eq(employees.userId, row.advisorId),
            with: { user: { with: { profile: true } } },
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
        advisor: advisor
          ? {
              id: advisor.userId,
              userId: advisor.userId,
              profile: advisor.user?.profile
                ? {
                    firstName: advisor.user.profile.firstName,
                    lastName: advisor.user.profile.lastName,
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
    with: { creator: true, advisor: true },
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
          profile: null,
        }
      : null,
    advisor: row.advisor
      ? {
          id: row.advisor.userId,
          userId: row.advisor.userId,
          profile: null,
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
