import type {
  ChangeDocumentStateRequest,
  CreateDocumentTypeRequest,
  CreateNegotiationDocumentRequest,
  ListDocumentStateHistoryQuery,
  ListDocumentTypesQuery,
  ListNegotiationDocumentsQuery,
  UpdateDocumentTypeRequest,
  UpdateNegotiationDocumentRequest,
} from '@bopacorp/shared/documents';
import { env } from '@config/env.js';
import { users } from '@db/schema/auth.js';
import { negotiations } from '@db/schema/crm.js';
import { documentStateHistory, documentTypes, negotiationDocuments } from '@db/schema/documents.js';
import { db } from '@lib/db.js';
import { decryptBuffer } from '@lib/encryption.js';
import { downloadFile } from '@lib/storage.js';
import { ConflictError, ForbiddenError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, ilike, isNull, or, type SQL, sql } from 'drizzle-orm';

// ── Helpers ──

function formatDateTime(d: Date | null): string {
  return d ? d.toISOString() : '';
}

// ── Document Types ──

export async function listDocumentTypes(query: ListDocumentTypesQuery) {
  const conditions = [];

  if (query.isActive !== undefined) {
    conditions.push(eq(documentTypes.isActive, query.isActive));
  }

  if (query.isMandatory !== undefined) {
    conditions.push(eq(documentTypes.isMandatory, query.isMandatory));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(or(ilike(documentTypes.name, term), ilike(documentTypes.code, term)));
  }

  const where = conditions.length > 0 ? and(...conditions) : sql`true`;

  const totalItems = await db.$count(documentTypes, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(documentTypes)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(documentTypes.createdAt);

  return {
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isMandatory: row.isMandatory,
      isActive: row.isActive,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getDocumentTypeById(id: string) {
  const row = await db.query.documentTypes.findFirst({
    where: eq(documentTypes.id, id),
  });

  if (!row) {
    throw new NotFoundError('Document type', id);
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isMandatory: row.isMandatory,
    isActive: row.isActive,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createDocumentType(data: CreateDocumentTypeRequest) {
  const existing = await db.select().from(documentTypes).where(eq(documentTypes.code, data.code));

  if (existing.length > 0) {
    throw new ConflictError('Document type with this code already exists');
  }

  const [row] = await db
    .insert(documentTypes)
    .values({
      code: data.code,
      name: data.name,
      description: data.description,
      isMandatory: data.isMandatory,
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create document type');
  }

  return getDocumentTypeById(row.id);
}

export async function updateDocumentType(id: string, data: UpdateDocumentTypeRequest) {
  await getDocumentTypeById(id);

  const updateData: Partial<typeof documentTypes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) {
    const existing = await db
      .select()
      .from(documentTypes)
      .where(and(eq(documentTypes.code, data.code), eq(documentTypes.id, id)));

    if (existing.length > 0) {
      throw new ConflictError('Document type with this code already exists');
    }
    updateData.code = data.code;
  }

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isMandatory !== undefined) updateData.isMandatory = data.isMandatory;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(documentTypes).set(updateData).where(eq(documentTypes.id, id));
  }

  return getDocumentTypeById(id);
}

export async function removeDocumentType(id: string) {
  await getDocumentTypeById(id);

  const inUse = await db
    .select({ count: negotiationDocuments.id })
    .from(negotiationDocuments)
    .where(eq(negotiationDocuments.documentTypeId, id));

  if (inUse.length > 0) {
    await db
      .update(documentTypes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(documentTypes.id, id));
    return;
  }

  await db.delete(documentTypes).where(eq(documentTypes.id, id));
}

// ── Negotiation Documents ──

export async function listDocuments(
  query: ListNegotiationDocumentsQuery,
  user: NonNullable<Express.Request['user']>
) {
  const advisorId = user.roles.includes('advisor') ? user.id : query.advisorId;

  const conditions = [];
  conditions.push(isNull(negotiationDocuments.deletedAt));

  if (query.state) {
    conditions.push(eq(negotiationDocuments.state, query.state));
  }

  if (query.negotiationId) {
    conditions.push(eq(negotiationDocuments.negotiationId, query.negotiationId));
  }

  if (query.documentTypeId) {
    conditions.push(eq(negotiationDocuments.documentTypeId, query.documentTypeId));
  }

  if (query.uploadedBy) {
    conditions.push(eq(negotiationDocuments.uploadedBy, query.uploadedBy));
  }

  if (advisorId) {
    conditions.push(eq(negotiations.advisorId, advisorId));
  }

  if (query.search) {
    conditions.push(ilike(negotiationDocuments.filename, `%${query.search}%`));
  }

  const where = and(...conditions) ?? sql`true`;

  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(negotiationDocuments)
    .innerJoin(negotiations, eq(negotiationDocuments.negotiationId, negotiations.id))
    .where(where);
  const totalItems = countRow?.count ?? 0;
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: negotiationDocuments.id,
      state: negotiationDocuments.state,
      filename: negotiationDocuments.filename,
      fileExtension: negotiationDocuments.fileExtension,
      fileSizeMb: negotiationDocuments.fileSizeMb,
      uploadedAt: negotiationDocuments.uploadedAt,
      createdAt: negotiationDocuments.createdAt,
      updatedAt: negotiationDocuments.updatedAt,
      negotiationId: negotiationDocuments.negotiationId,
      documentTypeId: negotiationDocuments.documentTypeId,
      uploadedBy: negotiationDocuments.uploadedBy,
    })
    .from(negotiationDocuments)
    .innerJoin(negotiations, eq(negotiationDocuments.negotiationId, negotiations.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(negotiationDocuments.createdAt);

  const result = await Promise.all(
    rows.map(async (row) => {
      const negotiation = await db.query.negotiations.findFirst({
        where: eq(negotiations.id, row.negotiationId),
        with: { client: true },
      });

      const documentType = await db.query.documentTypes.findFirst({
        where: eq(documentTypes.id, row.documentTypeId),
      });

      const uploader = await db.query.users.findFirst({
        where: eq(users.id, row.uploadedBy),
      });

      return {
        id: row.id,
        state: row.state,
        filename: row.filename,
        fileExtension: row.fileExtension,
        fileSizeMb: Number(row.fileSizeMb),
        uploadedAt: formatDateTime(row.uploadedAt),
        negotiation: negotiation
          ? {
              id: negotiation.id,
              client: {
                id: negotiation.client.id,
                businessName: negotiation.client.businessName,
              },
            }
          : { id: row.negotiationId, client: { id: '', businessName: '' } },
        documentType: documentType
          ? { id: documentType.id, name: documentType.name }
          : { id: row.documentTypeId, name: '' },
        uploadedBy: uploader
          ? { id: uploader.id, username: uploader.username }
          : { id: row.uploadedBy, username: '' },
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

export async function getDocumentById(id: string, user?: NonNullable<Express.Request['user']>) {
  const row = await db.query.negotiationDocuments.findFirst({
    where: and(eq(negotiationDocuments.id, id), isNull(negotiationDocuments.deletedAt)),
    with: {
      negotiation: { with: { client: true } },
      documentType: true,
      uploadedBy: { with: { profile: true } },
      reviewedBy: true,
    },
  });

  if (!row) {
    throw new NotFoundError('Negotiation document', id);
  }

  if (user?.roles.includes('advisor') && row.negotiation.advisorId !== user.id) {
    throw new ForbiddenError('You can only access documents from your own negotiations');
  }

  const uploader = row.uploadedBy;
  const uploaderProfile = uploader?.profile;

  return {
    id: row.id,
    state: row.state,
    filename: row.filename,
    fileExtension: row.fileExtension,
    fileSizeMb: Number(row.fileSizeMb),
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    reviewDate: row.reviewDate ? formatDateTime(row.reviewDate) : null,
    coordinatorMessage: row.coordinatorMessage,
    uploadedAt: formatDateTime(row.uploadedAt),
    negotiation: {
      id: row.negotiation.id,
      client: {
        id: row.negotiation.client.id,
        businessName: row.negotiation.client.businessName,
      },
    },
    documentType: {
      id: row.documentType.id,
      code: row.documentType.code,
      name: row.documentType.name,
    },
    uploadedBy: {
      id: uploader.id,
      username: uploader.username,
      email: uploader.email,
      profile: uploaderProfile
        ? {
            firstName: uploaderProfile.firstName,
            lastName: uploaderProfile.lastName,
          }
        : null,
    },
    reviewedBy: row.reviewedBy
      ? { id: row.reviewedBy.id, username: row.reviewedBy.username }
      : null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createDocument(userId: string, data: CreateNegotiationDocumentRequest) {
  const negotiation = await db.query.negotiations.findFirst({
    where: eq(negotiations.id, data.negotiationId),
  });

  if (!negotiation) {
    throw new NotFoundError('Negotiation', data.negotiationId);
  }

  const documentType = await db.query.documentTypes.findFirst({
    where: eq(documentTypes.id, data.documentTypeId),
  });

  if (!documentType) {
    throw new NotFoundError('Document type', data.documentTypeId);
  }

  const [row] = await db
    .insert(negotiationDocuments)
    .values({
      negotiationId: data.negotiationId,
      documentTypeId: data.documentTypeId,
      uploadedBy: userId,
      filename: data.filename,
      fileExtension: data.fileExtension,
      fileSizeMb: data.fileSizeMb.toString(),
      storagePath: data.storagePath,
      mimeType: data.mimeType,
      encryptionMetadata: data.encryptionMetadata,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create negotiation document');
  }

  await db.insert(documentStateHistory).values({
    documentId: row.id,
    newState: 'PENDING_APPROVAL',
    changedBy: userId,
    notes: 'Document uploaded',
  });

  return getDocumentById(row.id);
}

export async function updateDocument(id: string, data: UpdateNegotiationDocumentRequest) {
  await getDocumentById(id);

  const updateData: Partial<typeof negotiationDocuments.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.filename !== undefined) updateData.filename = data.filename;
  if (data.storagePath !== undefined) updateData.storagePath = data.storagePath;
  if (data.mimeType !== undefined) updateData.mimeType = data.mimeType;

  if (Object.keys(updateData).length > 1) {
    await db.update(negotiationDocuments).set(updateData).where(eq(negotiationDocuments.id, id));
  }

  return getDocumentById(id);
}

export async function removeDocument(id: string) {
  await getDocumentById(id);
  await db
    .update(negotiationDocuments)
    .set({ deletedAt: new Date() })
    .where(eq(negotiationDocuments.id, id));
}

export async function changeDocumentState(
  id: string,
  userId: string,
  data: ChangeDocumentStateRequest
) {
  const document = await getDocumentById(id);

  const currentState = document.state;
  const newState = data.state;

  if (currentState === newState) {
    return document;
  }

  const validTransitions: Record<string, string[]> = {
    PENDING_APPROVAL: ['ACCEPTED', 'REJECTED'],
    REJECTED: ['PENDING_APPROVAL'],
    ACCEPTED: [],
  };

  if (!validTransitions[currentState]?.includes(newState)) {
    throw new ConflictError(`Invalid state transition from ${currentState} to ${newState}`);
  }

  const updateData: Partial<typeof negotiationDocuments.$inferInsert> = {
    state: newState,
    updatedAt: new Date(),
  };

  if (newState === 'ACCEPTED' || newState === 'REJECTED') {
    updateData.reviewDate = new Date();
    updateData.reviewedBy = userId;
  }

  if (data.coordinatorMessage !== undefined) {
    updateData.coordinatorMessage = data.coordinatorMessage;
  }

  await db.update(negotiationDocuments).set(updateData).where(eq(negotiationDocuments.id, id));

  await db.insert(documentStateHistory).values({
    documentId: id,
    previousState: currentState,
    newState,
    changedBy: userId,
    notes: data.coordinatorMessage,
  });

  return getDocumentById(id);
}

export async function downloadDocument(id: string, user?: NonNullable<Express.Request['user']>) {
  const row = await db.query.negotiationDocuments.findFirst({
    where: and(eq(negotiationDocuments.id, id), isNull(negotiationDocuments.deletedAt)),
    with: { negotiation: true },
  });

  if (!row) {
    throw new NotFoundError('Negotiation document', id);
  }

  if (user?.roles.includes('advisor') && row.negotiation.advisorId !== user.id) {
    throw new ForbiddenError('You can only access documents from your own negotiations');
  }

  if (!row.encryptionMetadata) {
    throw new ConflictError('Document is not encrypted or encryption metadata is missing');
  }

  const encryptedBody = await downloadFile(row.storagePath, env.DOCUMENTS_STORAGE_BUCKET);
  if (!encryptedBody) {
    throw new NotFoundError('Document file in storage', row.storagePath);
  }

  const encryptedBuffer = Buffer.from(await encryptedBody.transformToByteArray());
  const buffer = decryptBuffer(encryptedBuffer, row.encryptionMetadata);

  return {
    buffer,
    filename: row.filename,
    mimeType: row.mimeType,
  };
}

// ── Document State History ──

export async function listDocumentHistory(query: ListDocumentStateHistoryQuery) {
  const conditions = [];
  conditions.push(eq(documentStateHistory.documentId, query.documentId));

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(documentStateHistory, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: documentStateHistory.id,
      previousState: documentStateHistory.previousState,
      newState: documentStateHistory.newState,
      notes: documentStateHistory.notes,
      createdAt: documentStateHistory.createdAt,
      changedBy: documentStateHistory.changedBy,
    })
    .from(documentStateHistory)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(documentStateHistory.createdAt);

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
