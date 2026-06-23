import type {
  CreateCandidateRequest,
  ListCandidatesQuery,
  UpdateCandidateRequest,
} from '@bopacorp/shared/employability';
import { candidates } from '@db/schema/employability.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, ilike, or } from 'drizzle-orm';

export async function listCandidates(query: ListCandidatesQuery) {
  const conditions = [];

  if (query.search) {
    conditions.push(
      or(
        ilike(candidates.firstName, `%${query.search}%`),
        ilike(candidates.lastName, `%${query.search}%`),
        ilike(candidates.email, `%${query.search}%`),
        ilike(candidates.nationalId, `%${query.search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalItems = await db.$count(candidates, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(candidates)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(candidates.createdAt);

  return {
    data: rows.map((row) => ({
      id: row.id,
      nationalId: row.nationalId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      address: row.address,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getCandidateById(id: string) {
  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, id),
  });

  if (!candidate) {
    throw new NotFoundError('Candidate', id);
  }

  return {
    id: candidate.id,
    nationalId: candidate.nationalId,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    phone: candidate.phone,
    address: candidate.address,
    createdAt: candidate.createdAt ? candidate.createdAt.toISOString() : '',
    updatedAt: candidate.updatedAt ? candidate.updatedAt.toISOString() : '',
  };
}

export async function createCandidate(data: CreateCandidateRequest) {
  const normalizedEmail = data.email.toLowerCase();

  const existing = await db
    .select()
    .from(candidates)
    .where(or(eq(candidates.email, normalizedEmail), eq(candidates.nationalId, data.nationalId)));

  if (existing.length > 0) {
    throw new ConflictError('Candidate with this email or national ID already exists');
  }

  const [candidate] = await db
    .insert(candidates)
    .values({
      nationalId: data.nationalId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: normalizedEmail,
      phone: data.phone,
      address: data.address,
    })
    .returning();

  if (!candidate) {
    throw new InternalServerError('Failed to create candidate');
  }

  return getCandidateById(candidate.id);
}

export async function updateCandidate(id: string, data: UpdateCandidateRequest) {
  await getCandidateById(id);

  const updateData: Partial<typeof candidates.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.nationalId !== undefined) updateData.nationalId = data.nationalId;
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;

  if (Object.keys(updateData).length > 1) {
    await db.update(candidates).set(updateData).where(eq(candidates.id, id));
  }

  return getCandidateById(id);
}

export async function removeCandidate(id: string) {
  await getCandidateById(id);
  await db.delete(candidates).where(eq(candidates.id, id));
}
