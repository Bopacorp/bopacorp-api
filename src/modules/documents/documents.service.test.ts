import { ForbiddenError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockGetSupervisedAdvisorIds = vi.fn();

vi.mock('@config/env.js', () => ({ env: {} }));
vi.mock('@lib/db.js', () => ({
  db: {
    query: {
      negotiationDocuments: { findFirst: mockFindFirst },
    },
  },
}));
vi.mock('@lib/encryption.js', () => ({ decryptBuffer: vi.fn() }));
vi.mock('@lib/storage.js', () => ({ downloadFile: vi.fn() }));
vi.mock('@lib/audit.js', () => ({ createAuditLog: vi.fn() }));
vi.mock('@modules/notifications/notifications.service.js', () => ({ createNotification: vi.fn() }));
vi.mock('@shared/utils/scoping.js', () => ({
  getSupervisedAdvisorIds: mockGetSupervisedAdvisorIds,
}));

const { getDocumentById } = await import('./documents.service.js');

const DOCUMENT_ID = '11111111-1111-1111-1111-111111111111';
const ADVISOR_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ADVISOR_ID = '33333333-3333-3333-3333-333333333333';
const SUPERVISOR_ID = '44444444-4444-4444-4444-444444444444';

function createDocumentRow() {
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
    negotiation: {
      id: '55555555-5555-5555-5555-555555555555',
      advisorId: ADVISOR_ID,
      client: {
        id: '66666666-6666-6666-6666-666666666666',
        businessName: 'ACME Ecuador',
      },
    },
    documentType: { id: '77777777-7777-7777-7777-777777777777', code: 'ID', name: 'Identity' },
    uploadedBy: {
      id: ADVISOR_ID,
      username: 'advisor',
      email: 'advisor@example.com',
      profile: { firstName: 'Ada', lastName: 'Lovelace' },
    },
    reviewedBy: null,
  };
}

describe('getDocumentById access scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a document to its assigned advisor', async () => {
    mockFindFirst.mockResolvedValue(createDocumentRow());

    const result = await getDocumentById(DOCUMENT_ID, {
      id: ADVISOR_ID,
      roles: ['advisor'],
      permissions: [],
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: DOCUMENT_ID,
        filename: 'identity.pdf',
        negotiation: expect.objectContaining({ id: '55555555-5555-5555-5555-555555555555' }),
      })
    );
    expect(mockGetSupervisedAdvisorIds).not.toHaveBeenCalled();
  });

  it('rejects an advisor attempting to access another advisor document', async () => {
    mockFindFirst.mockResolvedValue(createDocumentRow());

    await expect(
      getDocumentById(DOCUMENT_ID, {
        id: OTHER_ADVISOR_ID,
        roles: ['advisor'],
        permissions: [],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects a supervisor outside the document advisor supervision scope', async () => {
    mockFindFirst.mockResolvedValue(createDocumentRow());
    mockGetSupervisedAdvisorIds.mockResolvedValue([OTHER_ADVISOR_ID]);

    await expect(
      getDocumentById(DOCUMENT_ID, {
        id: SUPERVISOR_ID,
        roles: ['supervisor'],
        permissions: [],
      })
    ).rejects.toThrow(ForbiddenError);
    expect(mockGetSupervisedAdvisorIds).toHaveBeenCalledWith(SUPERVISOR_ID);
  });

  it('rejects a missing document before returning document data', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await expect(
      getDocumentById(DOCUMENT_ID, {
        id: ADVISOR_ID,
        roles: ['advisor'],
        permissions: [],
      })
    ).rejects.toThrow(NotFoundError);
  });
});
