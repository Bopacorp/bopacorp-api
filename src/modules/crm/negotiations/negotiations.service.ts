import type {
  ChangeNegotiationStateRequest,
  CreateNegotiationRequest,
  ListNegotiationsQuery,
  UpdateNegotiationRequest,
} from '@bopacorp/shared/crm';
import { env } from '@config/env.js';
import { users } from '@db/schema/auth.js';
import { employees, profiles } from '@db/schema/core.js';
import {
  businessClients,
  negotiationStateHistory,
  negotiationStates,
  negotiations,
} from '@db/schema/crm.js';
import { documentStateHistory, documentTypes, negotiationDocuments } from '@db/schema/documents.js';
import { offerMatrices } from '@db/schema/matrices.js';
import { salesTargets } from '@db/schema/reports.js';
import { db } from '@lib/db.js';
import { deleteFile } from '@lib/storage.js';
import { uploadEncryptedDocument } from '@modules/document-uploads/document-uploads.service.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@shared/errors/http-error.js';
import type { AnyColumn } from 'drizzle-orm';
import { and, asc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { formatDateTime, getOrderBy } from '../crm.helpers.js';

function getSortColumn(sortBy?: string): AnyColumn {
  const map: Record<string, AnyColumn> = {
    startDate: negotiations.startDate,
    estimatedCloseDate: negotiations.estimatedCloseDate,
    createdAt: negotiations.createdAt,
    updatedAt: negotiations.updatedAt,
  };
  return (sortBy && map[sortBy]) || negotiations.createdAt;
}

export async function listNegotiations(
  query: ListNegotiationsQuery,
  user: NonNullable<Express.Request['user']>
) {
  const advisorId = user.roles.includes('advisor') ? user.id : query.advisorId;

  const conditions = [];
  conditions.push(isNull(negotiations.deletedAt));

  if (query.isActive !== undefined) {
    conditions.push(eq(negotiations.isActive, query.isActive));
  }

  if (query.clientId) {
    conditions.push(eq(negotiations.clientId, query.clientId));
  }

  if (advisorId) {
    conditions.push(eq(negotiations.advisorId, advisorId));
  }

  if (query.stateId) {
    conditions.push(eq(negotiations.stateId, query.stateId));
  }

  if (query.tierCode) {
    const [target] = await db
      .select({ minBilling: salesTargets.minBilling, maxBilling: salesTargets.maxBilling })
      .from(salesTargets)
      .where(eq(salesTargets.tierCode, query.tierCode))
      .limit(1);

    if (target) {
      conditions.push(gte(businessClients.currentMonthlyBilling, target.minBilling));
      if (target.maxBilling !== null) {
        conditions.push(lte(businessClients.currentMonthlyBilling, target.maxBilling));
      }
    } else {
      conditions.push(sql`false`);
    }
  }

  if (query.search) {
    conditions.push(
      or(
        ilike(negotiations.observations, `%${query.search}%`),
        ilike(businessClients.businessName, `%${query.search}%`)
      )
    );
  }

  const where = and(...conditions) ?? sql`true`;

  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(negotiations)
    .innerJoin(businessClients, eq(negotiations.clientId, businessClients.id))
    .where(where);
  const totalItems = countRow?.count ?? 0;
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: negotiations.id,
      startDate: negotiations.startDate,
      estimatedCloseDate: negotiations.estimatedCloseDate,
      isActive: negotiations.isActive,
      createdAt: negotiations.createdAt,
      updatedAt: negotiations.updatedAt,
      client: { id: businessClients.id, businessName: businessClients.businessName },
      advisorId: users.id,
      advisorUsername: users.username,
      advisorFirstName: profiles.firstName,
      advisorLastName: profiles.lastName,
      state: {
        id: negotiationStates.id,
        code: negotiationStates.code,
        name: negotiationStates.name,
      },
    })
    .from(negotiations)
    .innerJoin(businessClients, eq(negotiations.clientId, businessClients.id))
    .innerJoin(users, eq(negotiations.advisorId, users.id))
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .innerJoin(negotiationStates, eq(negotiations.stateId, negotiationStates.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(getOrderBy(getSortColumn(query.sortBy), query.sortOrder));

  return {
    data: rows.map((row) => ({
      id: row.id,
      startDate: row.startDate,
      estimatedCloseDate: row.estimatedCloseDate,
      isActive: row.isActive,
      client: row.client,
      advisor: {
        id: row.advisorId,
        username: row.advisorUsername,
        profile:
          row.advisorFirstName && row.advisorLastName
            ? { firstName: row.advisorFirstName, lastName: row.advisorLastName }
            : null,
      },
      state: row.state,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getNegotiationById(id: string) {
  const row = await db.query.negotiations.findFirst({
    where: and(eq(negotiations.id, id), isNull(negotiations.deletedAt)),
    with: {
      client: true,
      advisor: { with: { user: { with: { profile: true } } } },
      state: true,
    },
  });

  if (!row) {
    throw new NotFoundError('Negotiation', id);
  }

  const advisor = row.advisor;
  const user = advisor?.user;
  const profile = user?.profile;

  return {
    id: row.id,
    startDate: row.startDate,
    estimatedCloseDate: row.estimatedCloseDate,
    observations: row.observations,
    isActive: row.isActive,
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
    state: {
      id: row.state.id,
      code: row.state.code,
      name: row.state.name,
    },
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createNegotiation(userId: string, data: CreateNegotiationRequest) {
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

  let resolvedStateId: string;

  if (data.stateId) {
    const state = await db.query.negotiationStates.findFirst({
      where: eq(negotiationStates.id, data.stateId),
    });
    if (!state) {
      throw new NotFoundError('Negotiation state', data.stateId);
    }
    resolvedStateId = state.id;
  } else {
    const [firstState] = await db
      .select({ id: negotiationStates.id })
      .from(negotiationStates)
      .where(eq(negotiationStates.isActive, true))
      .orderBy(asc(negotiationStates.position))
      .limit(1);
    if (!firstState) {
      throw new NotFoundError('Negotiation state', 'default');
    }
    resolvedStateId = firstState.id;
  }

  const [row] = await db
    .insert(negotiations)
    .values({
      clientId: data.clientId,
      advisorId: data.advisorId,
      stateId: resolvedStateId,
      startDate: data.startDate ?? new Date().toISOString().slice(0, 10),
      estimatedCloseDate: data.estimatedCloseDate ?? null,
      observations: data.observations,
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create negotiation');
  }

  await db.insert(negotiationStateHistory).values({
    negotiationId: row.id,
    newStateId: resolvedStateId,
    changedBy: userId,
    notes: 'Initial state',
  });

  await db.insert(offerMatrices).values({
    negotiationId: row.id,
    creatorId: userId,
  });

  return getNegotiationById(row.id);
}

export async function updateNegotiation(id: string, data: UpdateNegotiationRequest) {
  await getNegotiationById(id);

  const updateData: Partial<typeof negotiations.$inferInsert> = {
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

  if (data.stateId !== undefined) {
    const state = await db.query.negotiationStates.findFirst({
      where: eq(negotiationStates.id, data.stateId),
    });

    if (!state) {
      throw new NotFoundError('Negotiation state', data.stateId);
    }
    updateData.stateId = data.stateId;
  }

  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.estimatedCloseDate !== undefined)
    updateData.estimatedCloseDate = data.estimatedCloseDate ?? null;
  if (data.observations !== undefined) updateData.observations = data.observations;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(negotiations).set(updateData).where(eq(negotiations.id, id));
  }

  return getNegotiationById(id);
}

export async function removeNegotiation(id: string) {
  await getNegotiationById(id);
  await db.update(negotiations).set({ deletedAt: new Date() }).where(eq(negotiations.id, id));
}

export async function changeNegotiationState(
  id: string,
  userId: string,
  data: ChangeNegotiationStateRequest
) {
  const negotiation = await getNegotiationById(id);

  const newState = await db.query.negotiationStates.findFirst({
    where: eq(negotiationStates.id, data.stateId),
  });

  if (!newState) {
    throw new NotFoundError('Negotiation state', data.stateId);
  }

  if (negotiation.state.id === data.stateId) {
    return negotiation;
  }

  await db
    .update(negotiations)
    .set({ stateId: data.stateId, updatedAt: new Date() })
    .where(eq(negotiations.id, id));

  await db.insert(negotiationStateHistory).values({
    negotiationId: id,
    previousStateId: negotiation.state.id,
    newStateId: data.stateId,
    changedBy: userId,
    notes: data.notes,
  });

  return getNegotiationById(id);
}

export async function getNegotiationHistory(id: string) {
  await getNegotiationById(id);

  const historyRows = await db.query.negotiationStateHistory.findMany({
    where: eq(negotiationStateHistory.negotiationId, id),
    with: {
      previousState: true,
      newState: true,
      changedBy: true,
    },
    orderBy: negotiationStateHistory.createdAt,
  });

  return historyRows.map((h) => ({
    id: h.id,
    previousState: h.previousState
      ? {
          id: h.previousState.id,
          code: h.previousState.code,
          name: h.previousState.name,
        }
      : null,
    newState: {
      id: h.newState.id,
      code: h.newState.code,
      name: h.newState.name,
    },
    changedBy: {
      id: h.changedBy.id,
      username: h.changedBy.username,
    },
    notes: h.notes,
    createdAt: formatDateTime(h.createdAt),
  }));
}

export async function closeWithDocuments(
  negotiationId: string,
  user: NonNullable<Express.Request['user']>,
  files: Express.Multer.File[],
  documentTypeIds: string[],
  notes?: string
) {
  if (files.length !== documentTypeIds.length) {
    throw new BadRequestError('Each file must have a corresponding document type ID');
  }

  const negotiation = await getNegotiationById(negotiationId);

  if (user.roles.includes('advisor') && negotiation.advisor.id !== user.id) {
    throw new ForbiddenError('You can only close your own negotiations');
  }

  const closingState = await db.query.negotiationStates.findFirst({
    where: eq(negotiationStates.code, 'closing'),
  });
  if (!closingState) {
    throw new NotFoundError('Negotiation state', 'closing');
  }

  if (negotiation.state.id === closingState.id) {
    throw new ConflictError('Negotiation is already in closing state');
  }

  const requestedTypes = await db
    .select({ id: documentTypes.id, code: documentTypes.code, name: documentTypes.name })
    .from(documentTypes)
    .where(inArray(documentTypes.id, documentTypeIds));

  if (requestedTypes.length !== new Set(documentTypeIds).size) {
    throw new BadRequestError('One or more document type IDs are invalid');
  }

  const mandatoryTypes = await db
    .select({ id: documentTypes.id, code: documentTypes.code, name: documentTypes.name })
    .from(documentTypes)
    .where(and(eq(documentTypes.isMandatory, true), eq(documentTypes.isActive, true)));

  const existingDocs = await db
    .select({ documentTypeId: negotiationDocuments.documentTypeId })
    .from(negotiationDocuments)
    .where(
      and(
        eq(negotiationDocuments.negotiationId, negotiationId),
        isNull(negotiationDocuments.deletedAt)
      )
    );

  const coveredTypeIds = new Set([
    ...existingDocs.map((d) => d.documentTypeId),
    ...documentTypeIds,
  ]);

  const missingTypes = mandatoryTypes.filter((t) => !coveredTypeIds.has(t.id));
  if (missingTypes.length > 0) {
    const names = missingTypes.map((t) => t.name).join(', ');
    throw new BadRequestError(`Missing mandatory documents: ${names}`);
  }

  const uploadResults: Awaited<ReturnType<typeof uploadEncryptedDocument>>[] = [];
  const uploadedPaths: string[] = [];

  try {
    for (const file of files) {
      const result = await uploadEncryptedDocument(file, user.id);
      uploadResults.push(result);
      uploadedPaths.push(result.storagePath);
    }
  } catch (error) {
    await Promise.allSettled(
      uploadedPaths.map((path) => deleteFile(path, env.DOCUMENTS_STORAGE_BUCKET))
    );
    throw error;
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .select({ id: negotiations.id })
        .from(negotiations)
        .where(eq(negotiations.id, negotiationId))
        .for('update');

      for (let i = 0; i < uploadResults.length; i++) {
        const upload = uploadResults[i];
        const typeId = documentTypeIds[i];
        if (!upload || !typeId) continue;

        const [doc] = await tx
          .insert(negotiationDocuments)
          .values({
            negotiationId,
            documentTypeId: typeId,
            uploadedBy: user.id,
            filename: upload.filename,
            fileExtension: upload.fileExtension,
            fileSizeMb: upload.fileSizeMb.toString(),
            storagePath: upload.storagePath,
            mimeType: upload.mimeType,
            encryptionMetadata: upload.encryptionMetadata,
          })
          .returning({ id: negotiationDocuments.id });

        if (doc) {
          await tx.insert(documentStateHistory).values({
            documentId: doc.id,
            newState: 'PENDING_APPROVAL',
            changedBy: user.id,
            notes: 'Document uploaded',
          });
        }
      }

      await tx
        .update(negotiations)
        .set({ stateId: closingState.id, updatedAt: new Date() })
        .where(eq(negotiations.id, negotiationId));

      await tx.insert(negotiationStateHistory).values({
        negotiationId,
        previousStateId: negotiation.state.id,
        newStateId: closingState.id,
        changedBy: user.id,
        notes,
      });
    });
  } catch (error) {
    await Promise.allSettled(
      uploadedPaths.map((path) => deleteFile(path, env.DOCUMENTS_STORAGE_BUCKET))
    );
    throw error;
  }

  return getNegotiationById(negotiationId);
}
