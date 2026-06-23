import type {
  CreateGeoZoneRequest,
  ListGeoZonesQuery,
  UpdateGeoZoneRequest,
} from '@bopacorp/shared/catalog';
import { geoZones } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { eq } from 'drizzle-orm';
import { buildLookupListConditions } from '../catalog.helpers.js';

export async function listGeoZones(query: ListGeoZonesQuery) {
  const where = buildLookupListConditions(query, geoZones);
  return db.select().from(geoZones).where(where).orderBy(geoZones.code);
}

export async function getGeoZoneById(id: string) {
  const [zone] = await db.select().from(geoZones).where(eq(geoZones.id, id));

  if (!zone) {
    throw new NotFoundError('Geo zone', id);
  }

  return zone;
}

export async function createGeoZone(input: CreateGeoZoneRequest) {
  const existing = await db.select().from(geoZones).where(eq(geoZones.code, input.code));

  if (existing.length > 0) {
    throw new ConflictError(`Geo zone with code '${input.code}' already exists`);
  }

  const [zone] = await db.insert(geoZones).values(input).returning();

  if (!zone) {
    throw new InternalServerError();
  }

  return zone;
}

export async function updateGeoZone(id: string, input: UpdateGeoZoneRequest) {
  await getGeoZoneById(id);

  if (input.code) {
    const existing = await db.select().from(geoZones).where(eq(geoZones.code, input.code));

    const existingZone = existing[0];
    if (existingZone && existingZone.id !== id) {
      throw new ConflictError(`Geo zone with code '${input.code}' already exists`);
    }
  }

  const updateData: Partial<typeof geoZones.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(geoZones)
    .set(updateData)
    .where(eq(geoZones.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Geo zone', id);
  }

  return updated;
}

export async function disableGeoZone(id: string) {
  await getGeoZoneById(id);

  await db
    .update(geoZones)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(geoZones.id, id));
}
