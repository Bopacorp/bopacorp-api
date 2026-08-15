import type {
  CreateMatrixAttachmentRequest,
  CreateOfferMatrixRequest,
  ListMatrixAttachmentsQuery,
  ListOfferMatricesQuery,
} from '@bopacorp/shared/matrices';
import { matrixAttachments, offerMatrices } from '@db/schema/matrices.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCount,
  mockDelete,
  mockDownloadFile,
  mockDecryptBuffer,
  mockInsert,
  mockOfferMatrixFindFirst,
  mockMatrixAttachmentFindFirst,
  mockNegotiationFindFirst,
  mockSelect,
  mockUpdate,
  mockUserFindFirst,
} = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockDelete: vi.fn(),
  mockDownloadFile: vi.fn(),
  mockDecryptBuffer: vi.fn(),
  mockInsert: vi.fn(),
  mockOfferMatrixFindFirst: vi.fn(),
  mockMatrixAttachmentFindFirst: vi.fn(),
  mockNegotiationFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockUserFindFirst: vi.fn(),
}));

vi.mock('@config/env.js', () => ({
  env: { DOCUMENTS_STORAGE_BUCKET: 'documents-test-bucket' },
}));
vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    delete: mockDelete,
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    query: {
      matrixAttachments: { findFirst: mockMatrixAttachmentFindFirst },
      negotiations: { findFirst: mockNegotiationFindFirst },
      offerMatrices: { findFirst: mockOfferMatrixFindFirst },
      users: { findFirst: mockUserFindFirst },
    },
  },
}));
vi.mock('@lib/encryption.js', () => ({ decryptBuffer: mockDecryptBuffer }));
vi.mock('@lib/storage.js', () => ({ downloadFile: mockDownloadFile }));

const service = await import('./matrices.service.js');

const MATRIX_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_MATRIX_ID = '22222222-2222-2222-2222-222222222222';
const NEGOTIATION_ID = '33333333-3333-3333-3333-333333333333';
const CLIENT_ID = '44444444-4444-4444-4444-444444444444';
const CREATOR_ID = '55555555-5555-5555-5555-555555555555';
const UPLOADER_ID = '66666666-6666-6666-6666-666666666666';
const ATTACHMENT_ID = '77777777-7777-7777-7777-777777777777';
const MISSING_ID = '88888888-8888-8888-8888-888888888888';
const NOW = new Date('2026-08-15T12:00:00.000Z');

function offerMatrixRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MATRIX_ID,
    negotiationId: NEGOTIATION_ID,
    creatorId: CREATOR_ID,
    observations: 'Initial proposal',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function hydratedOfferMatrix(overrides: Record<string, unknown> = {}) {
  return {
    ...offerMatrixRow(),
    negotiation: {
      id: NEGOTIATION_ID,
      client: { id: CLIENT_ID, businessName: 'Acme Corp' },
    },
    creator: {
      id: CREATOR_ID,
      username: 'creator',
      email: 'creator@example.test',
      profile: { firstName: 'Ada', lastName: 'Lovelace' },
    },
    ...overrides,
  };
}

function attachmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTACHMENT_ID,
    matrixId: MATRIX_ID,
    uploadedBy: UPLOADER_ID,
    attachmentType: 'OFFER_MATRIX',
    description: 'Signed proposal',
    filename: 'proposal.pdf',
    fileExtension: 'pdf',
    fileSizeMb: '2.50',
    storagePath: 'matrices/proposal.pdf',
    mimeType: 'application/pdf',
    encryptionMetadata: null,
    uploadedAt: new Date('2026-08-03T10:00:00.000Z'),
    createdAt: new Date('2026-08-03T10:00:00.000Z'),
    ...overrides,
  };
}

function hydratedAttachment(overrides: Record<string, unknown> = {}) {
  return {
    ...attachmentRow(),
    uploadedBy: { id: UPLOADER_ID, username: 'uploader' },
    ...overrides,
  };
}

function paginatedSelect(result: unknown) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

function insertReturning(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return values;
}

function updateWhere() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return set;
}

function deleteWhere() {
  const where = vi.fn().mockResolvedValue([]);
  mockDelete.mockReturnValueOnce({ where });
  return where;
}

function fileBody(bytes: number[]) {
  return { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array(bytes)) };
}

describe('matrices service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('lists offer matrices with filters, pagination, relations, and fallbacks', async () => {
    const query: ListOfferMatricesQuery = {
      page: 2,
      limit: 5,
      search: 'proposal',
      negotiationId: NEGOTIATION_ID,
    };
    const builder = paginatedSelect([offerMatrixRow()]);
    mockCount.mockResolvedValueOnce(6);
    mockSelect.mockReturnValueOnce(builder);
    mockNegotiationFindFirst.mockResolvedValueOnce({
      id: NEGOTIATION_ID,
      client: { id: CLIENT_ID, businessName: 'Acme Corp' },
    });
    mockUserFindFirst.mockResolvedValueOnce({ id: CREATOR_ID, username: 'creator' });

    await expect(service.listOfferMatrices(query)).resolves.toEqual({
      data: [
        {
          id: MATRIX_ID,
          negotiation: {
            id: NEGOTIATION_ID,
            client: { id: CLIENT_ID, businessName: 'Acme Corp' },
          },
          creator: { id: CREATOR_ID, username: 'creator' },
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-02T10:00:00.000Z',
        },
      ],
      meta: { page: 2, limit: 5, totalItems: 6, totalPages: 2 },
    });
    expect(mockCount).toHaveBeenCalledWith(offerMatrices, expect.anything());
    expect(builder.from).toHaveBeenCalledWith(expect.objectContaining({}));
    expect(builder.limit).toHaveBeenCalledWith(5);
    expect(builder.offset).toHaveBeenCalledWith(5);
    expect(mockNegotiationFindFirst).toHaveBeenCalledOnce();
    expect(mockUserFindFirst).toHaveBeenCalledOnce();

    const fallbackBuilder = paginatedSelect([offerMatrixRow({ id: OTHER_MATRIX_ID })]);
    mockCount.mockResolvedValueOnce(1);
    mockSelect.mockReturnValueOnce(fallbackBuilder);
    mockNegotiationFindFirst.mockResolvedValueOnce(undefined);
    mockUserFindFirst.mockResolvedValueOnce(undefined);

    await expect(
      service.listOfferMatrices({ page: 1, limit: 10 } as ListOfferMatricesQuery)
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: OTHER_MATRIX_ID,
          negotiation: { id: NEGOTIATION_ID, client: { id: '', businessName: '' } },
          creator: { id: CREATOR_ID, username: '' },
        }),
      ],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
  });

  it('maps offer matrix details and rejects missing matrices', async () => {
    mockOfferMatrixFindFirst
      .mockResolvedValueOnce(hydratedOfferMatrix())
      .mockResolvedValueOnce(
        hydratedOfferMatrix({ creator: { ...hydratedOfferMatrix().creator, profile: null } })
      )
      .mockResolvedValueOnce(undefined);

    await expect(service.getOfferMatrixById(MATRIX_ID)).resolves.toEqual({
      id: MATRIX_ID,
      observations: 'Initial proposal',
      negotiation: {
        id: NEGOTIATION_ID,
        client: { id: CLIENT_ID, businessName: 'Acme Corp' },
      },
      creator: {
        id: CREATOR_ID,
        username: 'creator',
        email: 'creator@example.test',
        profile: { firstName: 'Ada', lastName: 'Lovelace' },
      },
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-02T10:00:00.000Z',
    });
    await expect(service.getOfferMatrixById(MATRIX_ID)).resolves.toEqual(
      expect.objectContaining({ creator: expect.objectContaining({ profile: null }) })
    );
    await expect(service.getOfferMatrixById(MISSING_ID)).rejects.toThrow(NotFoundError);
  });

  it('validates the negotiation, creates a matrix, and hydrates it', async () => {
    const data: CreateOfferMatrixRequest = {
      negotiationId: NEGOTIATION_ID,
      observations: 'New proposal',
    };
    mockNegotiationFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.createOfferMatrix(CREATOR_ID, data)).rejects.toThrow(NotFoundError);
    expect(mockInsert).not.toHaveBeenCalled();

    mockNegotiationFindFirst.mockResolvedValueOnce({ id: NEGOTIATION_ID });
    const values = insertReturning([{ id: MATRIX_ID }]);
    mockOfferMatrixFindFirst.mockResolvedValueOnce(hydratedOfferMatrix());
    await expect(service.createOfferMatrix(CREATOR_ID, data)).resolves.toEqual(
      expect.objectContaining({ id: MATRIX_ID })
    );
    expect(values).toHaveBeenCalledWith({
      negotiationId: NEGOTIATION_ID,
      creatorId: CREATOR_ID,
      observations: 'New proposal',
    });

    mockNegotiationFindFirst.mockResolvedValueOnce({ id: NEGOTIATION_ID });
    insertReturning([]);
    await expect(service.createOfferMatrix(CREATOR_ID, data)).rejects.toThrow(
      'Failed to create offer matrix'
    );
  });

  it('updates observations, skips empty updates, and rejects missing matrices', async () => {
    mockOfferMatrixFindFirst
      .mockResolvedValueOnce(hydratedOfferMatrix())
      .mockResolvedValueOnce(hydratedOfferMatrix({ observations: 'Updated proposal' }));
    const set = updateWhere();
    await expect(
      service.updateOfferMatrix(MATRIX_ID, { observations: 'Updated proposal' })
    ).resolves.toEqual(expect.objectContaining({ observations: 'Updated proposal' }));
    expect(set).toHaveBeenCalledWith({ updatedAt: NOW, observations: 'Updated proposal' });

    vi.resetAllMocks();
    mockOfferMatrixFindFirst.mockResolvedValueOnce(hydratedOfferMatrix());
    mockOfferMatrixFindFirst.mockResolvedValueOnce(hydratedOfferMatrix());
    await expect(service.updateOfferMatrix(MATRIX_ID, {})).resolves.toEqual(
      expect.objectContaining({ id: MATRIX_ID })
    );
    expect(mockUpdate).not.toHaveBeenCalled();

    vi.resetAllMocks();
    mockOfferMatrixFindFirst.mockResolvedValueOnce(undefined);
    await expect(
      service.updateOfferMatrix(MISSING_ID, { observations: 'Updated' })
    ).rejects.toThrow(NotFoundError);
  });

  it('soft deletes existing matrices and rejects missing ones', async () => {
    mockOfferMatrixFindFirst.mockResolvedValueOnce(hydratedOfferMatrix());
    const set = updateWhere();
    await expect(service.removeOfferMatrix(MATRIX_ID)).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith({ deletedAt: NOW });

    vi.resetAllMocks();
    mockOfferMatrixFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.removeOfferMatrix(MISSING_ID)).rejects.toThrow(NotFoundError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('lists matrix attachments with decimal conversion and uploader fallback', async () => {
    const query: ListMatrixAttachmentsQuery = { matrixId: MATRIX_ID, page: 1, limit: 10 };
    const builder = paginatedSelect([attachmentRow()]);
    mockCount.mockResolvedValueOnce(1);
    mockSelect.mockReturnValueOnce(builder);
    mockUserFindFirst.mockResolvedValueOnce({ id: UPLOADER_ID, username: 'uploader' });

    await expect(service.listMatrixAttachments(query)).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: ATTACHMENT_ID,
          fileSizeMb: 2.5,
          uploadedBy: { id: UPLOADER_ID, username: 'uploader' },
          uploadedAt: '2026-08-03T10:00:00.000Z',
        }),
      ],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    expect(builder.from).toHaveBeenCalledWith(matrixAttachments);
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(builder.offset).toHaveBeenCalledWith(0);

    const fallbackBuilder = paginatedSelect([attachmentRow({ id: MISSING_ID })]);
    mockCount.mockResolvedValueOnce(1);
    mockSelect.mockReturnValueOnce(fallbackBuilder);
    mockUserFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.listMatrixAttachments(query)).resolves.toEqual(
      expect.objectContaining({
        data: [expect.objectContaining({ uploadedBy: { id: UPLOADER_ID, username: '' } })],
      })
    );
  });

  it('maps attachment details and rejects missing attachments', async () => {
    mockMatrixAttachmentFindFirst
      .mockResolvedValueOnce(hydratedAttachment())
      .mockResolvedValueOnce(undefined);

    await expect(service.getMatrixAttachmentById(ATTACHMENT_ID)).resolves.toEqual({
      id: ATTACHMENT_ID,
      attachmentType: 'OFFER_MATRIX',
      description: 'Signed proposal',
      filename: 'proposal.pdf',
      fileExtension: 'pdf',
      fileSizeMb: 2.5,
      storagePath: 'matrices/proposal.pdf',
      mimeType: 'application/pdf',
      uploadedAt: '2026-08-03T10:00:00.000Z',
      uploadedBy: { id: UPLOADER_ID, username: 'uploader' },
    });
    await expect(service.getMatrixAttachmentById(MISSING_ID)).rejects.toThrow(NotFoundError);
  });

  it('validates the matrix, creates an attachment, and hydrates it', async () => {
    const data: CreateMatrixAttachmentRequest = {
      matrixId: MATRIX_ID,
      attachmentType: 'OFFER_MATRIX',
      description: 'Signed proposal',
      filename: 'proposal.pdf',
      fileExtension: 'pdf',
      fileSizeMb: 2.5,
      storagePath: 'matrices/proposal.pdf',
      mimeType: 'application/pdf',
      encryptionMetadata: { iv: 'iv', authTag: 'tag' },
    };
    mockOfferMatrixFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.createMatrixAttachment(UPLOADER_ID, data)).rejects.toThrow(NotFoundError);
    expect(mockInsert).not.toHaveBeenCalled();

    mockOfferMatrixFindFirst.mockResolvedValueOnce({ id: MATRIX_ID });
    const values = insertReturning([{ id: ATTACHMENT_ID }]);
    mockMatrixAttachmentFindFirst.mockResolvedValueOnce(hydratedAttachment());
    await expect(service.createMatrixAttachment(UPLOADER_ID, data)).resolves.toEqual(
      expect.objectContaining({ id: ATTACHMENT_ID })
    );
    expect(values).toHaveBeenCalledWith({
      matrixId: MATRIX_ID,
      uploadedBy: UPLOADER_ID,
      attachmentType: 'OFFER_MATRIX',
      description: 'Signed proposal',
      filename: 'proposal.pdf',
      fileExtension: 'pdf',
      fileSizeMb: '2.5',
      storagePath: 'matrices/proposal.pdf',
      mimeType: 'application/pdf',
      encryptionMetadata: { iv: 'iv', authTag: 'tag' },
    });

    mockOfferMatrixFindFirst.mockResolvedValueOnce({ id: MATRIX_ID });
    insertReturning([]);
    await expect(service.createMatrixAttachment(UPLOADER_ID, data)).rejects.toThrow(
      'Failed to create matrix attachment'
    );
  });

  it('removes existing attachments and rejects missing ones', async () => {
    mockMatrixAttachmentFindFirst.mockResolvedValueOnce(hydratedAttachment());
    const where = deleteWhere();
    await expect(service.removeMatrixAttachment(ATTACHMENT_ID)).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith(matrixAttachments);
    expect(where).toHaveBeenCalled();

    vi.resetAllMocks();
    mockMatrixAttachmentFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.removeMatrixAttachment(MISSING_ID)).rejects.toThrow(NotFoundError);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('downloads plaintext attachments from the configured bucket', async () => {
    mockMatrixAttachmentFindFirst.mockResolvedValueOnce(attachmentRow());
    const body = fileBody([1, 2, 3]);
    mockDownloadFile.mockResolvedValueOnce(body);

    await expect(service.downloadMatrixAttachment(ATTACHMENT_ID)).resolves.toEqual({
      buffer: Buffer.from([1, 2, 3]),
      filename: 'proposal.pdf',
      mimeType: 'application/pdf',
    });
    expect(mockDownloadFile).toHaveBeenCalledWith('matrices/proposal.pdf', 'documents-test-bucket');
    expect(body.transformToByteArray).toHaveBeenCalledOnce();
    expect(mockDecryptBuffer).not.toHaveBeenCalled();
  });

  it('decrypts encrypted attachments and handles missing files', async () => {
    const metadata = { iv: 'iv', authTag: 'tag' };
    const encryptedRow = attachmentRow({ encryptionMetadata: metadata });
    const body = fileBody([4, 5]);
    const decryptedBuffer = Buffer.from('decrypted');
    mockMatrixAttachmentFindFirst.mockResolvedValueOnce(encryptedRow);
    mockDownloadFile.mockResolvedValueOnce(body);
    mockDecryptBuffer.mockReturnValueOnce(decryptedBuffer);

    await expect(service.downloadMatrixAttachment(ATTACHMENT_ID)).resolves.toEqual({
      buffer: decryptedBuffer,
      filename: 'proposal.pdf',
      mimeType: 'application/pdf',
    });
    expect(mockDecryptBuffer).toHaveBeenCalledWith(Buffer.from([4, 5]), metadata);

    vi.resetAllMocks();
    mockMatrixAttachmentFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.downloadMatrixAttachment(MISSING_ID)).rejects.toThrow(NotFoundError);
    expect(mockDownloadFile).not.toHaveBeenCalled();

    vi.resetAllMocks();
    mockMatrixAttachmentFindFirst.mockResolvedValueOnce(attachmentRow());
    mockDownloadFile.mockResolvedValueOnce(undefined);
    await expect(service.downloadMatrixAttachment(ATTACHMENT_ID)).rejects.toThrow(NotFoundError);
  });
});
