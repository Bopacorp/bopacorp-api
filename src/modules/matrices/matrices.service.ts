import type {
  ChangeMatrixStateRequest,
  CreateMatrixAttachmentRequest,
  CreateMatrixLineItemRequest,
  CreateOfferMatrixRequest,
  ListMatrixAttachmentsQuery,
  ListMatrixLineItemsQuery,
  ListMatrixStateHistoryQuery,
  ListOfferMatricesQuery,
  UpdateMatrixLineItemRequest,
  UpdateOfferMatrixRequest,
} from '@bopacorp/shared/matrices';
import { users } from '@db/schema/auth.js';
import { catalogItems } from '@db/schema/catalog.js';
import { negotiations } from '@db/schema/crm.js';
import {
  matrixAttachments,
  matrixLineItems,
  matrixStateHistory,
  offerMatrices,
} from '@db/schema/matrices.js';
import { db } from '@lib/db.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { formatDateTime } from '@shared/utils/format.js';
import { and, eq, ilike, isNull, type SQL, sql } from 'drizzle-orm';

// ── Offer Matrices ──

export async function listOfferMatrices(query: ListOfferMatricesQuery) {
  const conditions = [];
  conditions.push(isNull(offerMatrices.deletedAt));

  if (query.state) {
    conditions.push(eq(offerMatrices.state, query.state));
  }

  if (query.negotiationId) {
    conditions.push(eq(offerMatrices.negotiationId, query.negotiationId));
  }

  if (query.creatorId) {
    conditions.push(eq(offerMatrices.creatorId, query.creatorId));
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
      state: offerMatrices.state,
      totalAmount: offerMatrices.totalAmount,
      calculatedSubsidy: offerMatrices.calculatedSubsidy,
      subsidyStrategy: offerMatrices.subsidyStrategy,
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
        state: row.state,
        totalAmount: Number(row.totalAmount),
        calculatedSubsidy: Number(row.calculatedSubsidy),
        subsidyStrategy: row.subsidyStrategy,
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
      approvedBy: true,
    },
  });

  if (!row) {
    throw new NotFoundError('Offer matrix', id);
  }

  const creator = row.creator;
  const creatorProfile = creator?.profile;

  return {
    id: row.id,
    state: row.state,
    observations: row.observations,
    totalAmount: Number(row.totalAmount),
    calculatedSubsidy: Number(row.calculatedSubsidy),
    subsidyStrategy: row.subsidyStrategy,
    approvalDate: row.approvalDate ? formatDateTime(row.approvalDate) : null,
    supervisorMessage: row.supervisorMessage,
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
    approvedBy: row.approvedBy
      ? { id: row.approvedBy.id, username: row.approvedBy.username }
      : null,
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
      totalAmount: data.totalAmount.toString(),
      calculatedSubsidy: data.calculatedSubsidy.toString(),
      subsidyStrategy: data.subsidyStrategy,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create offer matrix');
  }

  await db.insert(matrixStateHistory).values({
    matrixId: row.id,
    newState: 'DRAFT',
    changedBy: userId,
    notes: 'Initial state',
  });

  return getOfferMatrixById(row.id);
}

export async function updateOfferMatrix(id: string, data: UpdateOfferMatrixRequest) {
  const matrix = await getOfferMatrixById(id);

  if (matrix.state !== 'DRAFT') {
    throw new ConflictError('Can only update matrices in DRAFT state');
  }

  const updateData: Partial<typeof offerMatrices.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.observations !== undefined) updateData.observations = data.observations;
  if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount.toString();
  if (data.calculatedSubsidy !== undefined)
    updateData.calculatedSubsidy = data.calculatedSubsidy.toString();
  if (data.subsidyStrategy !== undefined) updateData.subsidyStrategy = data.subsidyStrategy;

  if (Object.keys(updateData).length > 1) {
    await db.update(offerMatrices).set(updateData).where(eq(offerMatrices.id, id));
  }

  return getOfferMatrixById(id);
}

export async function removeOfferMatrix(id: string) {
  const matrix = await getOfferMatrixById(id);

  if (matrix.state === 'APPROVED' || matrix.state === 'PENDING_APPROVAL') {
    throw new ConflictError('Cannot delete approved or pending approval matrices');
  }

  await db.update(offerMatrices).set({ deletedAt: new Date() }).where(eq(offerMatrices.id, id));
}

export async function changeMatrixState(
  id: string,
  userId: string,
  data: ChangeMatrixStateRequest
) {
  const matrix = await getOfferMatrixById(id);

  const currentState = matrix.state;
  const newState = data.state;

  if (currentState === newState) {
    return matrix;
  }

  const validTransitions: Record<string, string[]> = {
    DRAFT: ['PENDING_APPROVAL'],
    PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
    REJECTED: ['DRAFT'],
    APPROVED: [],
  };

  if (!validTransitions[currentState]?.includes(newState)) {
    throw new ConflictError(`Invalid state transition from ${currentState} to ${newState}`);
  }

  const updateData: Partial<typeof offerMatrices.$inferInsert> = {
    state: newState,
    updatedAt: new Date(),
  };

  if (newState === 'APPROVED') {
    updateData.approvalDate = new Date();
    updateData.approvedBy = userId;
  }

  if (data.supervisorMessage !== undefined) {
    updateData.supervisorMessage = data.supervisorMessage;
  }

  await db.update(offerMatrices).set(updateData).where(eq(offerMatrices.id, id));

  await db.insert(matrixStateHistory).values({
    matrixId: id,
    previousState: currentState,
    newState,
    changedBy: userId,
    notes: data.supervisorMessage,
  });

  return getOfferMatrixById(id);
}

// ── Matrix Line Items ──

export async function listMatrixLineItems(query: ListMatrixLineItemsQuery) {
  const conditions = [];
  conditions.push(eq(matrixLineItems.matrixId, query.matrixId));

  if (query.itemId) {
    conditions.push(eq(matrixLineItems.itemId, query.itemId));
  }

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(matrixLineItems, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: matrixLineItems.id,
      quantity: matrixLineItems.quantity,
      unitPrice: matrixLineItems.unitPrice,
      total: matrixLineItems.total,
      createdAt: matrixLineItems.createdAt,
      updatedAt: matrixLineItems.updatedAt,
      itemId: matrixLineItems.itemId,
    })
    .from(matrixLineItems)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(matrixLineItems.createdAt);

  const result = await Promise.all(
    rows.map(async (row) => {
      const item = await db.query.catalogItems.findFirst({
        where: eq(catalogItems.id, row.itemId),
      });

      return {
        id: row.id,
        quantity: row.quantity,
        unitPrice: Number(row.unitPrice),
        total: Number(row.total),
        item: item
          ? { id: item.id, name: item.name, code: item.activationCode ?? null }
          : { id: row.itemId, name: '', code: null },
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

export async function getMatrixLineItemById(id: string) {
  const row = await db.query.matrixLineItems.findFirst({
    where: eq(matrixLineItems.id, id),
    with: { item: true },
  });

  if (!row) {
    throw new NotFoundError('Matrix line item', id);
  }

  return {
    id: row.id,
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice),
    total: Number(row.total),
    item: {
      id: row.item.id,
      name: row.item.name,
      code: row.item.activationCode ?? null,
    },
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createMatrixLineItem(data: CreateMatrixLineItemRequest) {
  const matrix = await db.query.offerMatrices.findFirst({
    where: and(eq(offerMatrices.id, data.matrixId), isNull(offerMatrices.deletedAt)),
  });

  if (!matrix) {
    throw new NotFoundError('Offer matrix', data.matrixId);
  }

  const item = await db.query.catalogItems.findFirst({
    where: eq(catalogItems.id, data.itemId),
  });

  if (!item) {
    throw new NotFoundError('Catalog item', data.itemId);
  }

  const existing = await db
    .select()
    .from(matrixLineItems)
    .where(
      and(eq(matrixLineItems.matrixId, data.matrixId), eq(matrixLineItems.itemId, data.itemId))
    );

  if (existing.length > 0) {
    throw new ConflictError('Line item already exists for this matrix');
  }

  const calculatedTotal = data.quantity * data.unitPrice;

  const [row] = await db
    .insert(matrixLineItems)
    .values({
      matrixId: data.matrixId,
      itemId: data.itemId,
      quantity: data.quantity,
      unitPrice: data.unitPrice.toString(),
      total: calculatedTotal.toString(),
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create matrix line item');
  }

  return getMatrixLineItemById(row.id);
}

export async function updateMatrixLineItem(id: string, data: UpdateMatrixLineItemRequest) {
  const lineItem = await getMatrixLineItemById(id);

  const updateData: Partial<typeof matrixLineItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice.toString();

  if (data.quantity !== undefined || data.unitPrice !== undefined) {
    const quantity = data.quantity ?? lineItem.quantity;
    const unitPrice = data.unitPrice ?? lineItem.unitPrice;
    updateData.total = (quantity * unitPrice).toString();
  }

  if (Object.keys(updateData).length > 1) {
    await db.update(matrixLineItems).set(updateData).where(eq(matrixLineItems.id, id));
  }

  return getMatrixLineItemById(id);
}

export async function removeMatrixLineItem(id: string) {
  await getMatrixLineItemById(id);
  await db.delete(matrixLineItems).where(eq(matrixLineItems.id, id));
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

// ── Matrix State History ──

export async function listMatrixStateHistory(query: ListMatrixStateHistoryQuery) {
  const conditions = [];
  conditions.push(eq(matrixStateHistory.matrixId, query.matrixId));

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(matrixStateHistory, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: matrixStateHistory.id,
      previousState: matrixStateHistory.previousState,
      newState: matrixStateHistory.newState,
      notes: matrixStateHistory.notes,
      createdAt: matrixStateHistory.createdAt,
      changedBy: matrixStateHistory.changedBy,
    })
    .from(matrixStateHistory)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(matrixStateHistory.createdAt);

  const result = await Promise.all(
    rows.map(async (row) => {
      const changer = await db.query.users.findFirst({
        where: eq(users.id, row.changedBy),
      });

      return {
        id: row.id,
        previousState: row.previousState,
        newState: row.newState,
        notes: row.notes,
        createdAt: formatDateTime(row.createdAt),
        changedBy: changer
          ? { id: changer.id, username: changer.username }
          : { id: row.changedBy, username: '' },
      };
    })
  );

  return {
    data: result,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}
