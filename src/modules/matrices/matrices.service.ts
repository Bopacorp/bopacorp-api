import type {
  CreateMatrixAttachmentRequest,
  CreateOfferMatrixRequest,
  ListMatrixAttachmentsQuery,
  ListOfferMatricesQuery,
  UpdateOfferMatrixRequest,
} from '@bopacorp/shared/matrices';
import { users } from '@db/schema/auth.js';
import { negotiations } from '@db/schema/crm.js';
import { matrixAttachments, offerMatrices } from '@db/schema/matrices.js';
import { db } from '@lib/db.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { formatDateTime } from '@shared/utils/format.js';
import { and, eq, ilike, isNull, type SQL, sql } from 'drizzle-orm';

// ── Offer Matrices ──

export async function listOfferMatrices(query: ListOfferMatricesQuery) {
  const conditions = [];
  conditions.push(isNull(offerMatrices.deletedAt));

  if (query.negotiationId) {
    conditions.push(eq(offerMatrices.negotiationId, query.negotiationId));
  }

  if (query.search) {
    conditions.push(ilike(offerMatrices.observations, `%${query.search}%`));
  }

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(offerMatrices, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: offerMatrices.id,
      createdAt: offerMatrices.createdAt,
      updatedAt: offerMatrices.updatedAt,
      negotiationId: offerMatrices.negotiationId,
      creatorId: offerMatrices.creatorId,
    })
    .from(offerMatrices)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(offerMatrices.createdAt);

  const result = await Promise.all(
    rows.map(async (row) => {
      const negotiation = await db.query.negotiations.findFirst({
        where: eq(negotiations.id, row.negotiationId),
        with: { client: true },
      });

      const creator = await db.query.users.findFirst({
        where: eq(users.id, row.creatorId),
      });

      return {
        id: row.id,
        negotiation: negotiation
          ? {
              id: negotiation.id,
              client: {
                id: negotiation.client.id,
                businessName: negotiation.client.businessName,
              },
            }
          : { id: row.negotiationId, client: { id: '', businessName: '' } },
        creator: creator
          ? { id: creator.id, username: creator.username }
          : { id: row.creatorId, username: '' },
        createdAt: formatDateTime(row.createdAt),
        updatedAt: formatDateTime(row.updatedAt),
      };
    })
  );

  return {
    data: result,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getOfferMatrixById(id: string) {
  const row = await db.query.offerMatrices.findFirst({
    where: and(eq(offerMatrices.id, id), isNull(offerMatrices.deletedAt)),
    with: {
      negotiation: { with: { client: true } },
      creator: { with: { profile: true } },
    },
  });

  if (!row) {
    throw new NotFoundError('Offer matrix', id);
  }

  const creator = row.creator;
  const creatorProfile = creator?.profile;

  return {
    id: row.id,
    observations: row.observations,
    negotiation: {
      id: row.negotiation.id,
      client: {
        id: row.negotiation.client.id,
        businessName: row.negotiation.client.businessName,
      },
    },
    creator: {
      id: creator.id,
      username: creator.username,
      email: creator.email,
      profile: creatorProfile
        ? {
            firstName: creatorProfile.firstName,
            lastName: creatorProfile.lastName,
          }
        : null,
    },
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createOfferMatrix(userId: string, data: CreateOfferMatrixRequest) {
  const negotiation = await db.query.negotiations.findFirst({
    where: and(eq(negotiations.id, data.negotiationId), isNull(negotiations.deletedAt)),
  });

  if (!negotiation) {
    throw new NotFoundError('Negotiation', data.negotiationId);
  }

  const [row] = await db
    .insert(offerMatrices)
    .values({
      negotiationId: data.negotiationId,
      creatorId: userId,
      observations: data.observations,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create offer matrix');
  }

  return getOfferMatrixById(row.id);
}

export async function updateOfferMatrix(id: string, data: UpdateOfferMatrixRequest) {
  await getOfferMatrixById(id);

  const updateData: Partial<typeof offerMatrices.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.observations !== undefined) updateData.observations = data.observations;

  if (Object.keys(updateData).length > 1) {
    await db.update(offerMatrices).set(updateData).where(eq(offerMatrices.id, id));
  }

  return getOfferMatrixById(id);
}

export async function removeOfferMatrix(id: string) {
  await getOfferMatrixById(id);
  await db.update(offerMatrices).set({ deletedAt: new Date() }).where(eq(offerMatrices.id, id));
}

// ── Matrix Attachments ──

export async function listMatrixAttachments(query: ListMatrixAttachmentsQuery) {
  const conditions = [];
  conditions.push(eq(matrixAttachments.matrixId, query.matrixId));

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(matrixAttachments, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: matrixAttachments.id,
      attachmentType: matrixAttachments.attachmentType,
      description: matrixAttachments.description,
      filename: matrixAttachments.filename,
      fileExtension: matrixAttachments.fileExtension,
      fileSizeMb: matrixAttachments.fileSizeMb,
      storagePath: matrixAttachments.storagePath,
      mimeType: matrixAttachments.mimeType,
      uploadedAt: matrixAttachments.uploadedAt,
      uploadedBy: matrixAttachments.uploadedBy,
    })
    .from(matrixAttachments)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(matrixAttachments.uploadedAt);

  const result = await Promise.all(
    rows.map(async (row) => {
      const uploader = await db.query.users.findFirst({
        where: eq(users.id, row.uploadedBy),
      });

      return {
        id: row.id,
        attachmentType: row.attachmentType,
        description: row.description,
        filename: row.filename,
        fileExtension: row.fileExtension,
        fileSizeMb: Number(row.fileSizeMb),
        storagePath: row.storagePath,
        mimeType: row.mimeType,
        uploadedAt: formatDateTime(row.uploadedAt),
        uploadedBy: uploader
          ? { id: uploader.id, username: uploader.username }
          : { id: row.uploadedBy, username: '' },
      };
    })
  );

  return {
    data: result,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getMatrixAttachmentById(id: string) {
  const row = await db.query.matrixAttachments.findFirst({
    where: eq(matrixAttachments.id, id),
    with: { uploadedBy: true },
  });

  if (!row) {
    throw new NotFoundError('Matrix attachment', id);
  }

  return {
    id: row.id,
    attachmentType: row.attachmentType,
    description: row.description,
    filename: row.filename,
    fileExtension: row.fileExtension,
    fileSizeMb: Number(row.fileSizeMb),
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    uploadedAt: formatDateTime(row.uploadedAt),
    uploadedBy: { id: row.uploadedBy.id, username: row.uploadedBy.username },
  };
}

export async function createMatrixAttachment(userId: string, data: CreateMatrixAttachmentRequest) {
  const matrix = await db.query.offerMatrices.findFirst({
    where: and(eq(offerMatrices.id, data.matrixId), isNull(offerMatrices.deletedAt)),
  });

  if (!matrix) {
    throw new NotFoundError('Offer matrix', data.matrixId);
  }

  const [row] = await db
    .insert(matrixAttachments)
    .values({
      matrixId: data.matrixId,
      uploadedBy: userId,
      attachmentType: data.attachmentType,
      description: data.description,
      filename: data.filename,
      fileExtension: data.fileExtension,
      fileSizeMb: data.fileSizeMb.toString(),
      storagePath: data.storagePath,
      mimeType: data.mimeType,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create matrix attachment');
  }

  return getMatrixAttachmentById(row.id);
}

export async function removeMatrixAttachment(id: string) {
  await getMatrixAttachmentById(id);
  await db.delete(matrixAttachments).where(eq(matrixAttachments.id, id));
}
