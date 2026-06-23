import type {
  CreateJobVacancyRequest,
  ListJobVacanciesQuery,
  PublicJobVacancyResponse,
  UpdateJobVacancyRequest,
} from '@bopacorp/shared/employability';
import { users } from '@db/schema/auth.js';
import { jobVacancies } from '@db/schema/employability.js';
import { db } from '@lib/db.js';
import { InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, gte, ilike, isNull, or } from 'drizzle-orm';

export async function listVacancies(query: ListJobVacanciesQuery) {
  const conditions = [isNull(jobVacancies.deletedAt)];

  if (query.isActive !== undefined) {
    conditions.push(eq(jobVacancies.isActive, query.isActive));
  }

  if (query.isPublished !== undefined) {
    conditions.push(eq(jobVacancies.isPublished, query.isPublished));
  }

  if (query.search) {
    conditions.push(ilike(jobVacancies.title, `%${query.search}%`));
  }

  const where = and(...conditions);

  const totalItems = await db.$count(jobVacancies, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: jobVacancies.id,
      title: jobVacancies.title,
      isActive: jobVacancies.isActive,
      isPublished: jobVacancies.isPublished,
      publicationDate: jobVacancies.publicationDate,
      closingDate: jobVacancies.closingDate,
      createdAt: jobVacancies.createdAt,
      updatedAt: jobVacancies.updatedAt,
      creator: { id: users.id, username: users.username },
    })
    .from(jobVacancies)
    .innerJoin(users, eq(jobVacancies.createdBy, users.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(jobVacancies.createdAt);

  return {
    data: rows.map((row) => ({
      ...row,
      publicationDate: row.publicationDate ? row.publicationDate.toISOString() : null,
      closingDate: row.closingDate ? row.closingDate.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getVacancyById(id: string) {
  const vacancy = await db.query.jobVacancies.findFirst({
    where: and(eq(jobVacancies.id, id), isNull(jobVacancies.deletedAt)),
    with: { creator: true },
  });

  if (!vacancy) {
    throw new NotFoundError('Job vacancy', id);
  }

  const creator = vacancy.creator;

  return {
    id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    requirements: vacancy.requirements,
    isActive: vacancy.isActive,
    isPublished: vacancy.isPublished,
    publicationDate: vacancy.publicationDate ? vacancy.publicationDate.toISOString() : null,
    closingDate: vacancy.closingDate ? vacancy.closingDate.toISOString() : null,
    creator: creator
      ? { id: creator.id, username: creator.username, email: creator.email }
      : { id: '', username: '', email: '' },
    createdAt: vacancy.createdAt ? vacancy.createdAt.toISOString() : '',
    updatedAt: vacancy.updatedAt ? vacancy.updatedAt.toISOString() : '',
  };
}

export async function createVacancy(userId: string, data: CreateJobVacancyRequest) {
  const [vacancy] = await db
    .insert(jobVacancies)
    .values({
      createdBy: userId,
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      isActive: data.isActive,
      isPublished: data.isPublished,
      publicationDate: data.publicationDate ? new Date(data.publicationDate) : undefined,
      closingDate: data.closingDate ? new Date(data.closingDate) : undefined,
    })
    .returning();

  if (!vacancy) {
    throw new InternalServerError('Failed to create job vacancy');
  }

  return getVacancyById(vacancy.id);
}

export async function updateVacancy(id: string, data: UpdateJobVacancyRequest) {
  await getVacancyById(id);

  const updateData: Partial<typeof jobVacancies.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.requirements !== undefined) updateData.requirements = data.requirements;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;
  if (data.publicationDate !== undefined)
    updateData.publicationDate = data.publicationDate ? new Date(data.publicationDate) : null;
  if (data.closingDate !== undefined)
    updateData.closingDate = data.closingDate ? new Date(data.closingDate) : null;

  if (Object.keys(updateData).length > 1) {
    await db.update(jobVacancies).set(updateData).where(eq(jobVacancies.id, id));
  }

  return getVacancyById(id);
}

export async function removeVacancy(id: string) {
  await getVacancyById(id);
  await db.update(jobVacancies).set({ deletedAt: new Date() }).where(eq(jobVacancies.id, id));
}

export async function listPublishedVacancies(query: ListJobVacanciesQuery) {
  const now = new Date();
  const where = and(
    eq(jobVacancies.isPublished, true),
    eq(jobVacancies.isActive, true),
    isNull(jobVacancies.deletedAt),
    or(isNull(jobVacancies.closingDate), gte(jobVacancies.closingDate, now))
  );

  const totalItems = await db.$count(jobVacancies, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: jobVacancies.id,
      title: jobVacancies.title,
      isActive: jobVacancies.isActive,
      isPublished: jobVacancies.isPublished,
      publicationDate: jobVacancies.publicationDate,
      closingDate: jobVacancies.closingDate,
      createdAt: jobVacancies.createdAt,
      updatedAt: jobVacancies.updatedAt,
      creator: { id: users.id, username: users.username },
    })
    .from(jobVacancies)
    .innerJoin(users, eq(jobVacancies.createdBy, users.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(jobVacancies.createdAt);

  return {
    data: rows.map((row) => ({
      ...row,
      publicationDate: row.publicationDate ? row.publicationDate.toISOString() : null,
      closingDate: row.closingDate ? row.closingDate.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getPublishedVacancyById(id: string): Promise<PublicJobVacancyResponse> {
  const now = new Date();
  const vacancy = await db.query.jobVacancies.findFirst({
    where: and(
      eq(jobVacancies.id, id),
      isNull(jobVacancies.deletedAt),
      eq(jobVacancies.isPublished, true),
      eq(jobVacancies.isActive, true),
      or(isNull(jobVacancies.closingDate), gte(jobVacancies.closingDate, now))
    ),
    with: { creator: true },
  });

  if (!vacancy) {
    throw new NotFoundError('Job vacancy', id);
  }

  const creator = vacancy.creator;

  return {
    id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    requirements: vacancy.requirements,
    publicationDate: vacancy.publicationDate ? vacancy.publicationDate.toISOString() : null,
    closingDate: vacancy.closingDate ? vacancy.closingDate.toISOString() : null,
    creator: creator ? { id: creator.id, username: creator.username } : { id: '', username: '' },
    createdAt: vacancy.createdAt ? vacancy.createdAt.toISOString() : '',
    updatedAt: vacancy.updatedAt ? vacancy.updatedAt.toISOString() : '',
  };
}
