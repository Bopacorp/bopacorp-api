import type {
  CreateSegmentRequest,
  ListSegmentsQuery,
  UpdateSegmentRequest,
} from '@bopacorp/shared/catalog';
import { segments } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { eq } from 'drizzle-orm';
import { buildLookupListConditions, getLookupOrderBy } from '../catalog.helpers.js';

export async function listSegments(query: ListSegmentsQuery) {
  const where = buildLookupListConditions(query, segments);
  return db
    .select()
    .from(segments)
    .where(where)
    .orderBy(getLookupOrderBy(segments, query.sortBy, query.sortOrder));
}

export async function getSegmentById(id: string) {
  const [segment] = await db.select().from(segments).where(eq(segments.id, id));

  if (!segment) {
    throw new NotFoundError('Segment', id);
  }

  return segment;
}

export async function createSegment(input: CreateSegmentRequest) {
  const existing = await db.select().from(segments).where(eq(segments.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Segment with code '${input.code}' already exists`);
  }

  const [segment] = await db.insert(segments).values(input).returning();

  if (!segment) {
    throw new InternalServerError();
  }

  return segment;
}

export async function updateSegment(id: string, input: UpdateSegmentRequest) {
  await getSegmentById(id);

  if (input.code) {
    const existing = await db.select().from(segments).where(eq(segments.code, input.code));

    const existingSegment = existing[0];
    if (existingSegment && existingSegment.id !== id) {
      throw new ConflictError(`Segment with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof segments.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(segments)
    .set(updateData)
    .where(eq(segments.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Segment', id);
  }

  return updated;
}

export async function disableSegment(id: string) {
  await getSegmentById(id);

  await db
    .update(segments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(segments.id, id));
}
