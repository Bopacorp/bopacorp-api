import { documentTypes } from '@db/schema/documents.js';
import { ConflictError, ForbiddenError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockCount = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockExecute = vi.fn();
const mockFindDocumentType = vi.fn();
const mockFindDocument = vi.fn();
const mockFindDocuments = vi.fn();
const mockFindNegotiation = vi.fn();
const mockFindClient = vi.fn();
const mockFindUser = vi.fn();
const mockScopedAdvisors = vi.fn();
const mockDownloadFile = vi.fn();
const mockDecryptBuffer = vi.fn();
const mockNotification = vi.fn();
const mockArchive = {
  append: vi.fn(),
  finalize: vi.fn(),
  pipe: vi.fn(),
};

function MockZipArchive() {
  return mockArchive;
}

vi.mock('@config/env.js', () => ({ env: { DOCUMENTS_STORAGE_BUCKET: 'documents' } }));
vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    execute: mockExecute,
    query: {
      documentTypes: { findFirst: mockFindDocumentType },
      negotiationDocuments: { findFirst: mockFindDocument, findMany: mockFindDocuments },
      negotiations: { findFirst: mockFindNegotiation },
      businessClients: { findFirst: mockFindClient },
      users: { findFirst: mockFindUser },
    },
  },
}));
vi.mock('@lib/encryption.js', () => ({ decryptBuffer: mockDecryptBuffer }));
vi.mock('@lib/storage.js', () => ({ downloadFile: mockDownloadFile }));
vi.mock('@modules/notifications/notifications.service.js', () => ({
  createNotification: mockNotification,
}));
vi.mock('@shared/utils/scoping.js', () => ({ getSupervisedAdvisorIds: mockScopedAdvisors }));
vi.mock('archiver', () => ({ ZipArchive: MockZipArchive }));

const service = await import('./documents.service.js');

const DOCUMENT_TYPE_ID = '11111111-1111-1111-1111-111111111111';
const DOCUMENT_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_DOCUMENT_ID = '33333333-3333-3333-3333-333333333333';
const NEGOTIATION_ID = '44444444-4444-4444-4444-444444444444';
const CLIENT_ID = '55555555-5555-5555-5555-555555555555';
const ADVISOR_ID = '66666666-6666-6666-6666-666666666666';
const OTHER_ADVISOR_ID = '77777777-7777-7777-7777-777777777777';
const SUPERVISOR_ID = '88888888-8888-8888-8888-888888888888';
const COORDINATOR_ID = '99999999-9999-9999-9999-999999999999';
const UPLOADER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const HISTORY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function user(id: string = UPLOADER_ID, overrides: Record<string, unknown> = {}) {
  return {
    id,
    username: 'uploader',
    email: 'uploader@example.com',
    profile: { firstName: 'Ada', lastName: 'Lovelace' },
    ...overrides,
  };
}

function documentType(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_TYPE_ID,
    code: 'ID',
    name: 'Identity',
    description: 'Identity document',
    isMandatory: true,
    isActive: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    ...overrides,
  };
}

function negotiation(overrides: Record<string, unknown> = {}) {
  return {
    id: NEGOTIATION_ID,
    clientId: CLIENT_ID,
    advisorId: ADVISOR_ID,
    client: { id: CLIENT_ID, businessName: 'ACME Ecuador' },
    ...overrides,
  };
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_ID,
    state: 'PENDING_APPROVAL',
    filename: 'identity.pdf',
    fileExtension: 'pdf',
    fileSizeMb: '1.25',
    storagePath: 'documents/advisor/identity.pdf',
    mimeType: 'application/pdf',
    reviewDate: null,
    coordinatorMessage: null,
    uploadedAt: new Date('2026-08-01T10:00:00.000Z'),
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    negotiation: negotiation(),
    documentType: documentType(),
    uploadedBy: user(),
    reviewedBy: null,
    ...overrides,
  };
}

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_ID,
    state: 'PENDING_APPROVAL',
    filename: 'identity.pdf',
    fileExtension: 'pdf',
    fileSizeMb: '1.25',
    uploadedAt: new Date('2026-08-01T10:00:00.000Z'),
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    negotiationId: NEGOTIATION_ID,
    documentTypeId: DOCUMENT_TYPE_ID,
    uploadedBy: UPLOADER_ID,
    ...overrides,
  };
}

function downloadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_ID,
    filename: 'identity.pdf',
    storagePath: 'documents/identity.pdf',
    mimeType: 'application/pdf',
    encryptionMetadata: { iv: 'iv', authTag: 'tag' },
    negotiation: { id: NEGOTIATION_ID, advisorId: ADVISOR_ID },
    ...overrides,
  };
}

function historyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: HISTORY_ID,
    previousState: null,
    newState: 'PENDING_APPROVAL',
    notes: 'Document uploaded',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    changedBy: UPLOADER_ID,
    ...overrides,
  };
}

function selectBuilder(result: unknown, paginated = false) {
  const builder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  if (paginated) {
    builder.where.mockReturnValue(builder);
    builder.orderBy.mockResolvedValue(result);
  } else {
    builder.where.mockResolvedValue(result);
  }
  return builder;
}

function terminalSelect(result: unknown) {
  const builder = selectBuilder(result);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function paginatedSelect(result: unknown) {
  const builder = selectBuilder(result, true);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function insertBuilder(result: unknown = []) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return { values, returning };
}

function updateBuilder() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return { set, where };
}

function appUser(id: string, roles: string[] = []) {
  return { id, roles, permissions: [] } as NonNullable<Express.Request['user']>;
}

describe('documents service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockUpdate.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }));
    mockDelete.mockImplementation(() => ({ where: vi.fn().mockResolvedValue([]) }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists and retrieves document types with filters, mapping, and missing errors', async () => {
    mockCount.mockResolvedValueOnce(3);
    paginatedSelect([documentType()]);
    await expect(
      service.listDocumentTypes({
        page: 2,
        limit: 1,
        isActive: true,
        isMandatory: true,
        search: 'identity',
      } as never)
    ).resolves.toEqual({
      data: [expect.objectContaining({ id: DOCUMENT_TYPE_ID, code: 'ID', name: 'Identity' })],
      meta: { page: 2, limit: 1, totalItems: 3, totalPages: 3 },
    });

    mockCount.mockResolvedValueOnce(0);
    paginatedSelect([]);
    await expect(service.listDocumentTypes({ page: 1, limit: 10 } as never)).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });

    mockFindDocumentType.mockResolvedValueOnce(documentType());
    await expect(service.getDocumentTypeById(DOCUMENT_TYPE_ID)).resolves.toEqual(
      expect.objectContaining({ id: DOCUMENT_TYPE_ID, createdAt: '2026-08-01T10:00:00.000Z' })
    );

    mockFindDocumentType.mockResolvedValueOnce(undefined);
    await expect(service.getDocumentTypeById(OTHER_DOCUMENT_ID)).rejects.toThrow(NotFoundError);
  });

  it('handles document type CRUD success, conflicts, no-op updates, and removal modes', async () => {
    terminalSelect([documentType()]);
    await expect(
      service.createDocumentType({
        code: 'ID',
        name: 'Identity',
        isMandatory: true,
        isActive: true,
      })
    ).rejects.toThrow(ConflictError);

    terminalSelect([]);
    const createInsert = insertBuilder([{ id: DOCUMENT_TYPE_ID }]);
    mockFindDocumentType.mockResolvedValueOnce(documentType());
    await expect(
      service.createDocumentType({
        code: 'ID',
        name: 'Identity',
        isMandatory: true,
        isActive: true,
      })
    ).resolves.toEqual(expect.objectContaining({ id: DOCUMENT_TYPE_ID }));
    expect(createInsert.values).toHaveBeenCalled();

    terminalSelect([]);
    insertBuilder([]);
    await expect(
      service.createDocumentType({ code: 'NEW', name: 'New', isMandatory: false, isActive: true })
    ).rejects.toThrow('Failed to create document type');

    mockFindDocumentType.mockResolvedValueOnce(documentType());
    terminalSelect([]);
    const update = updateBuilder();
    mockFindDocumentType.mockResolvedValueOnce(documentType({ code: 'NEW', name: 'Updated' }));
    await expect(
      service.updateDocumentType(DOCUMENT_TYPE_ID, {
        code: 'NEW',
        name: 'Updated',
        description: 'Updated description',
        isMandatory: false,
        isActive: false,
      })
    ).resolves.toEqual(expect.objectContaining({ code: 'NEW', name: 'Updated' }));
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NEW',
        name: 'Updated',
        isMandatory: false,
        isActive: false,
        updatedAt: NOW,
      })
    );

    mockFindDocumentType.mockResolvedValueOnce(documentType());
    mockFindDocumentType.mockResolvedValueOnce(documentType());
    await expect(service.updateDocumentType(DOCUMENT_TYPE_ID, {})).resolves.toBeDefined();
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    mockFindDocumentType.mockResolvedValueOnce(undefined);
    await expect(service.updateDocumentType(DOCUMENT_TYPE_ID, { name: 'Missing' })).rejects.toThrow(
      NotFoundError
    );

    mockFindDocumentType.mockResolvedValueOnce(documentType());
    terminalSelect([documentType()]);
    const disable = updateBuilder();
    await expect(service.removeDocumentType(DOCUMENT_TYPE_ID)).resolves.toBeUndefined();
    expect(disable.set).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });

    mockFindDocumentType.mockResolvedValueOnce(documentType());
    terminalSelect([]);
    await expect(service.removeDocumentType(DOCUMENT_TYPE_ID)).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith(documentTypes);

    mockFindDocumentType.mockResolvedValueOnce(undefined);
    await expect(service.removeDocumentType(OTHER_DOCUMENT_ID)).rejects.toThrow(NotFoundError);
  });

  it('lists negotiation documents for scoped users and maps relation fallbacks', async () => {
    mockScopedAdvisors.mockResolvedValue([ADVISOR_ID, OTHER_ADVISOR_ID]);
    const rows = [
      listRow(),
      listRow({
        id: OTHER_DOCUMENT_ID,
        negotiationId: OTHER_DOCUMENT_ID,
        documentTypeId: OTHER_DOCUMENT_ID,
        uploadedBy: OTHER_ADVISOR_ID,
        uploadedAt: null,
        updatedAt: null,
      }),
    ];
    terminalSelect([{ count: 2 }]);
    const rowBuilder = paginatedSelect(rows);
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindNegotiation.mockResolvedValueOnce(undefined);
    mockFindDocumentType.mockResolvedValueOnce(documentType());
    mockFindDocumentType.mockResolvedValueOnce(undefined);
    mockFindUser.mockResolvedValueOnce(user());
    mockFindUser.mockResolvedValueOnce(undefined);

    await expect(
      service.listDocuments(
        {
          page: 2,
          limit: 2,
          search: 'identity',
          negotiationId: NEGOTIATION_ID,
          documentTypeId: DOCUMENT_TYPE_ID,
          state: 'PENDING_APPROVAL',
          uploadedBy: UPLOADER_ID,
          advisorId: ADVISOR_ID,
        } as never,
        appUser(SUPERVISOR_ID, ['supervisor'])
      )
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: DOCUMENT_ID,
          fileSizeMb: 1.25,
          negotiation: {
            id: NEGOTIATION_ID,
            client: { id: CLIENT_ID, businessName: 'ACME Ecuador' },
          },
          documentType: { id: DOCUMENT_TYPE_ID, name: 'Identity' },
        }),
        expect.objectContaining({
          id: OTHER_DOCUMENT_ID,
          uploadedAt: '',
          negotiation: { id: OTHER_DOCUMENT_ID, client: { id: '', businessName: '' } },
          documentType: { id: OTHER_DOCUMENT_ID, name: '' },
          uploadedBy: { id: OTHER_ADVISOR_ID, username: '' },
        }),
      ],
      meta: { page: 2, limit: 2, totalItems: 2, totalPages: 1 },
    });
    expect(rowBuilder.offset).toHaveBeenCalledWith(2);

    terminalSelect([{ count: 0 }]);
    paginatedSelect([]);
    await expect(
      service.listDocuments({ page: 1, limit: 10 } as never, appUser(UPLOADER_ID))
    ).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });

    terminalSelect([{ count: 0 }]);
    paginatedSelect([]);
    await expect(
      service.listDocuments(
        { page: 1, limit: 10, advisorId: ADVISOR_ID } as never,
        appUser(UPLOADER_ID, ['manager'])
      )
    ).resolves.toEqual(expect.objectContaining({ data: [] }));
  });

  it('returns documents with access checks and complete nullable relation mapping', async () => {
    mockFindDocument.mockResolvedValueOnce(
      documentRow({
        reviewDate: NOW,
        uploadedBy: user(UPLOADER_ID, { profile: null }),
        reviewedBy: user(OTHER_ADVISOR_ID, { profile: null }),
      })
    );
    await expect(
      service.getDocumentById(DOCUMENT_ID, appUser(ADVISOR_ID, ['advisor']))
    ).resolves.toEqual(
      expect.objectContaining({
        fileSizeMb: 1.25,
        reviewDate: NOW.toISOString(),
        uploadedBy: expect.objectContaining({ profile: null }),
        reviewedBy: { id: OTHER_ADVISOR_ID, username: 'uploader' },
      })
    );

    mockFindDocument.mockResolvedValueOnce(documentRow());
    await expect(
      service.getDocumentById(DOCUMENT_ID, appUser(OTHER_ADVISOR_ID, ['advisor']))
    ).rejects.toThrow(ForbiddenError);

    mockFindDocument.mockResolvedValueOnce(documentRow());
    mockScopedAdvisors.mockResolvedValueOnce([OTHER_ADVISOR_ID]);
    await expect(
      service.getDocumentById(DOCUMENT_ID, appUser(SUPERVISOR_ID, ['supervisor']))
    ).rejects.toThrow(ForbiddenError);

    mockFindDocument.mockResolvedValueOnce(documentRow());
    mockScopedAdvisors.mockResolvedValueOnce([ADVISOR_ID]);
    await expect(
      service.getDocumentById(DOCUMENT_ID, appUser(SUPERVISOR_ID, ['supervisor']))
    ).resolves.toBeDefined();

    mockFindDocument.mockResolvedValueOnce(undefined);
    await expect(service.getDocumentById(OTHER_DOCUMENT_ID)).rejects.toThrow(NotFoundError);
  });

  it('creates negotiation documents, history, and coordinator notifications', async () => {
    mockFindNegotiation.mockResolvedValueOnce({ id: NEGOTIATION_ID, clientId: CLIENT_ID });
    mockFindDocumentType.mockResolvedValueOnce({ id: DOCUMENT_TYPE_ID, name: 'Identity' });
    const documentInsert = insertBuilder([{ id: DOCUMENT_ID }]);
    const historyInsert = insertBuilder();
    mockFindClient.mockResolvedValueOnce({ id: CLIENT_ID, businessName: 'ACME Ecuador' });
    terminalSelect([{ userId: COORDINATOR_ID }]);
    mockNotification.mockResolvedValueOnce(undefined);
    mockFindDocument.mockResolvedValueOnce(documentRow());

    const data = {
      negotiationId: NEGOTIATION_ID,
      documentTypeId: DOCUMENT_TYPE_ID,
      filename: 'identity.pdf',
      fileExtension: 'pdf',
      fileSizeMb: 1.25,
      storagePath: 'documents/identity.pdf',
      mimeType: 'application/pdf',
      encryptionMetadata: { iv: 'iv', authTag: 'tag' },
    };
    await expect(service.createDocument(UPLOADER_ID, data as never)).resolves.toEqual(
      expect.objectContaining({ id: DOCUMENT_ID })
    );
    expect(documentInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({ uploadedBy: UPLOADER_ID, fileSizeMb: '1.25' })
    );
    expect(historyInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: DOCUMENT_ID, newState: 'PENDING_APPROVAL' })
    );
    expect(mockNotification).toHaveBeenCalledWith({
      recipientId: COORDINATOR_ID,
      title: 'Documento por revisar',
      message: 'ACME Ecuador - Identity',
      referenceType: 'document',
      referenceId: DOCUMENT_ID,
    });

    mockFindNegotiation.mockResolvedValueOnce(undefined);
    await expect(service.createDocument(UPLOADER_ID, data as never)).rejects.toThrow(NotFoundError);

    mockFindNegotiation.mockResolvedValueOnce({ id: NEGOTIATION_ID, clientId: CLIENT_ID });
    mockFindDocumentType.mockResolvedValueOnce(undefined);
    await expect(service.createDocument(UPLOADER_ID, data as never)).rejects.toThrow(NotFoundError);

    mockFindNegotiation.mockResolvedValueOnce({ id: NEGOTIATION_ID, clientId: CLIENT_ID });
    mockFindDocumentType.mockResolvedValueOnce({ id: DOCUMENT_TYPE_ID, name: 'Identity' });
    insertBuilder([]);
    await expect(service.createDocument(UPLOADER_ID, data as never)).rejects.toThrow(
      'Failed to create negotiation document'
    );
  });

  it('updates and removes documents, including no-op and missing paths', async () => {
    mockFindDocument.mockResolvedValueOnce(documentRow());
    const update = updateBuilder();
    mockFindDocument.mockResolvedValueOnce(documentRow({ filename: 'updated.pdf' }));
    await expect(
      service.updateDocument(DOCUMENT_ID, {
        filename: 'updated.pdf',
        storagePath: 'documents/updated.pdf',
        mimeType: 'application/pdf',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ filename: 'updated.pdf' }));
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'updated.pdf',
        storagePath: 'documents/updated.pdf',
        updatedAt: NOW,
      })
    );

    mockFindDocument.mockResolvedValueOnce(documentRow());
    mockFindDocument.mockResolvedValueOnce(documentRow());
    await expect(service.updateDocument(DOCUMENT_ID, {} as never)).resolves.toBeDefined();

    mockFindDocument.mockResolvedValueOnce(documentRow());
    const remove = updateBuilder();
    await expect(service.removeDocument(DOCUMENT_ID)).resolves.toBeUndefined();
    expect(remove.set).toHaveBeenCalledWith({ deletedAt: NOW });

    mockFindDocument.mockResolvedValueOnce(undefined);
    await expect(service.removeDocument(OTHER_DOCUMENT_ID)).rejects.toThrow(NotFoundError);
  });

  it('enforces state transitions, writes history, and notifies advisors', async () => {
    mockFindDocument.mockResolvedValueOnce(documentRow());
    await expect(
      service.changeDocumentState(DOCUMENT_ID, COORDINATOR_ID, {
        state: 'PENDING_APPROVAL',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ state: 'PENDING_APPROVAL' }));
    expect(mockUpdate).not.toHaveBeenCalled();

    mockFindDocument.mockResolvedValueOnce(documentRow({ state: 'ACCEPTED' }));
    await expect(
      service.changeDocumentState(DOCUMENT_ID, COORDINATOR_ID, { state: 'REJECTED' } as never)
    ).rejects.toThrow(ConflictError);

    mockFindDocument.mockResolvedValueOnce(documentRow());
    const acceptedUpdate = updateBuilder();
    const acceptedHistory = insertBuilder();
    mockFindNegotiation.mockResolvedValueOnce({ id: NEGOTIATION_ID, advisorId: ADVISOR_ID });
    mockNotification.mockResolvedValueOnce(undefined);
    mockFindDocument.mockResolvedValueOnce(documentRow({ state: 'ACCEPTED', reviewDate: NOW }));
    await expect(
      service.changeDocumentState(DOCUMENT_ID, COORDINATOR_ID, {
        state: 'ACCEPTED',
        coordinatorMessage: 'Approved',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ state: 'ACCEPTED' }));
    expect(acceptedUpdate.set).toHaveBeenCalledWith({
      state: 'ACCEPTED',
      updatedAt: NOW,
      reviewDate: NOW,
      reviewedBy: COORDINATOR_ID,
      coordinatorMessage: 'Approved',
    });
    expect(acceptedHistory.values).toHaveBeenCalledWith({
      documentId: DOCUMENT_ID,
      previousState: 'PENDING_APPROVAL',
      newState: 'ACCEPTED',
      changedBy: COORDINATOR_ID,
      notes: 'Approved',
    });
    expect(mockNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: ADVISOR_ID,
        title: 'Documento aprobado',
      })
    );

    mockFindDocument.mockResolvedValueOnce(documentRow({ state: 'REJECTED' }));
    const pendingUpdate = updateBuilder();
    insertBuilder();
    mockFindDocument.mockResolvedValueOnce(documentRow({ state: 'PENDING_APPROVAL' }));
    await expect(
      service.changeDocumentState(DOCUMENT_ID, COORDINATOR_ID, {
        state: 'PENDING_APPROVAL',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ state: 'PENDING_APPROVAL' }));
    expect(pendingUpdate.set).toHaveBeenCalledWith({ state: 'PENDING_APPROVAL', updatedAt: NOW });

    mockFindDocument.mockResolvedValueOnce(documentRow());
    updateBuilder();
    insertBuilder();
    mockFindNegotiation.mockResolvedValueOnce(undefined);
    mockFindDocument.mockResolvedValueOnce(documentRow({ state: 'REJECTED' }));
    await expect(
      service.changeDocumentState(DOCUMENT_ID, COORDINATOR_ID, { state: 'REJECTED' } as never)
    ).resolves.toBeDefined();
    expect(mockNotification).toHaveBeenCalledTimes(1);
  });

  it('downloads encrypted documents with access and storage error handling', async () => {
    mockFindDocument.mockResolvedValueOnce(undefined);
    await expect(service.downloadDocument(DOCUMENT_ID)).rejects.toThrow(NotFoundError);

    mockFindDocument.mockResolvedValueOnce(downloadRow());
    await expect(
      service.downloadDocument(DOCUMENT_ID, appUser(OTHER_ADVISOR_ID, ['advisor']))
    ).rejects.toThrow(ForbiddenError);

    mockFindDocument.mockResolvedValueOnce(downloadRow());
    mockScopedAdvisors.mockResolvedValueOnce([OTHER_ADVISOR_ID]);
    await expect(
      service.downloadDocument(DOCUMENT_ID, appUser(SUPERVISOR_ID, ['supervisor']))
    ).rejects.toThrow(ForbiddenError);

    mockFindDocument.mockResolvedValueOnce(downloadRow({ encryptionMetadata: null }));
    await expect(service.downloadDocument(DOCUMENT_ID)).rejects.toThrow(ConflictError);

    mockFindDocument.mockResolvedValueOnce(downloadRow());
    mockDownloadFile.mockResolvedValueOnce(undefined);
    await expect(service.downloadDocument(DOCUMENT_ID)).rejects.toThrow(NotFoundError);

    mockFindDocument.mockResolvedValueOnce(downloadRow());
    const body = { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) };
    mockDownloadFile.mockResolvedValueOnce(body);
    mockDecryptBuffer.mockReturnValueOnce(Buffer.from('plain'));
    await expect(
      service.downloadDocument(DOCUMENT_ID, appUser(ADVISOR_ID, ['advisor']))
    ).resolves.toEqual({
      buffer: Buffer.from('plain'),
      filename: 'identity.pdf',
      mimeType: 'application/pdf',
    });
    expect(mockDownloadFile).toHaveBeenCalledWith('documents/identity.pdf', 'documents');
  });

  it('downloads negotiation documents into an archive and skips failed files', async () => {
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindDocuments.mockResolvedValueOnce([
      {
        filename: 'identity.pdf',
        storagePath: 'documents/identity.pdf',
        encryptionMetadata: { iv: 'iv', authTag: 'tag' },
        documentType: { name: 'Identity' },
      },
      {
        filename: 'empty.pdf',
        storagePath: 'documents/empty.pdf',
        encryptionMetadata: null,
        documentType: { name: 'Empty' },
      },
      {
        filename: 'missing.pdf',
        storagePath: 'documents/missing.pdf',
        encryptionMetadata: { iv: 'iv', authTag: 'tag' },
        documentType: { name: 'Missing' },
      },
      {
        filename: 'broken.pdf',
        storagePath: 'documents/broken.pdf',
        encryptionMetadata: { iv: 'iv', authTag: 'tag' },
        documentType: { name: 'Broken' },
      },
    ]);
    mockDownloadFile.mockResolvedValueOnce({
      transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1])),
    });
    mockDownloadFile.mockResolvedValueOnce(undefined);
    mockDownloadFile.mockRejectedValueOnce(new Error('storage failure'));
    mockDecryptBuffer.mockReturnValueOnce(Buffer.from('plain'));

    await expect(
      service.downloadNegotiationDocuments(
        NEGOTIATION_ID,
        appUser(ADVISOR_ID, ['advisor']),
        'ACCEPTED'
      )
    ).resolves.toEqual({ archive: mockArchive, negotiationId: NEGOTIATION_ID });
    expect(mockArchive.append).toHaveBeenCalledWith(Buffer.from('plain'), {
      name: 'Identity_identity.pdf',
    });
    expect(mockArchive.finalize).toHaveBeenCalledOnce();

    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindDocuments.mockResolvedValueOnce([]);
    await expect(
      service.downloadNegotiationDocuments(
        NEGOTIATION_ID,
        appUser(ADVISOR_ID, ['advisor']),
        'UNKNOWN'
      )
    ).rejects.toThrow(NotFoundError);

    mockFindNegotiation.mockResolvedValueOnce(undefined);
    await expect(
      service.downloadNegotiationDocuments(NEGOTIATION_ID, appUser(ADVISOR_ID), undefined)
    ).rejects.toThrow(NotFoundError);

    mockFindNegotiation.mockResolvedValueOnce(negotiation({ advisorId: OTHER_ADVISOR_ID }));
    await expect(
      service.downloadNegotiationDocuments(
        NEGOTIATION_ID,
        appUser(ADVISOR_ID, ['advisor']),
        undefined
      )
    ).rejects.toThrow(ForbiddenError);

    mockFindNegotiation.mockResolvedValueOnce(negotiation({ advisorId: OTHER_ADVISOR_ID }));
    mockScopedAdvisors.mockResolvedValueOnce([ADVISOR_ID]);
    await expect(
      service.downloadNegotiationDocuments(
        NEGOTIATION_ID,
        appUser(SUPERVISOR_ID, ['supervisor']),
        undefined
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it('maps pending summaries and document history with user fallbacks', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          advisor_id: ADVISOR_ID,
          first_name: 'Ada',
          last_name: 'Lovelace',
          pending_upload: 2,
          pending_review: 3,
        },
      ],
    });
    await expect(service.getPendingSummary()).resolves.toEqual([
      {
        advisor: { id: ADVISOR_ID, firstName: 'Ada', lastName: 'Lovelace' },
        pendingUpload: 2,
        pendingReview: 3,
        totalPending: 5,
      },
    ]);

    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(service.getPendingSummary()).resolves.toEqual([]);

    mockCount.mockResolvedValueOnce(2);
    const builder = paginatedSelect([
      historyRow(),
      historyRow({ id: OTHER_DOCUMENT_ID, changedBy: OTHER_ADVISOR_ID }),
    ]);
    mockFindUser.mockResolvedValueOnce(user());
    mockFindUser.mockResolvedValueOnce(undefined);
    await expect(
      service.listDocumentHistory({ documentId: DOCUMENT_ID, page: 2, limit: 1 } as never)
    ).resolves.toEqual({
      data: [
        expect.objectContaining({ changedBy: { id: UPLOADER_ID, username: 'uploader' } }),
        expect.objectContaining({ changedBy: { id: OTHER_ADVISOR_ID, username: '' } }),
      ],
      meta: { page: 2, limit: 1, totalItems: 2, totalPages: 2 },
    });
    expect(builder.offset).toHaveBeenCalledWith(1);
  });
});
