import { candidateResumes } from '@db/schema/employability.js';
import { InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockFindCandidate = vi.fn();
const mockFindApplication = vi.fn();
const mockFindResume = vi.fn();
const mockUploadFile = vi.fn();
const mockDownloadFile = vi.fn();
const mockDeleteFile = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
    query: {
      candidates: { findFirst: mockFindCandidate },
      jobApplications: { findFirst: mockFindApplication },
      candidateResumes: { findFirst: mockFindResume },
    },
  },
}));
vi.mock('@lib/storage.js', () => ({
  uploadFile: mockUploadFile,
  downloadFile: mockDownloadFile,
  deleteFile: mockDeleteFile,
}));

const service = await import('./candidate-resumes.service.js');

const RESUME_ID = '11111111-1111-1111-1111-111111111111';
const CANDIDATE_ID = '22222222-2222-2222-2222-222222222222';
const APPLICATION_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_RESUME_ID = '44444444-4444-4444-4444-444444444444';

function resume(overrides: Record<string, unknown> = {}) {
  return {
    id: RESUME_ID,
    candidateId: CANDIDATE_ID,
    applicationId: APPLICATION_ID,
    filename: 'ada-lovelace.pdf',
    fileExtension: 'pdf',
    fileSizeMb: '1.25',
    storagePath: `candidates/${CANDIDATE_ID}/resume.pdf`,
    mimeType: 'application/pdf',
    uploadedAt: new Date('2026-08-10T00:00:00.000Z'),
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    ...overrides,
  };
}

function listBuilder(result: unknown) {
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

function insertResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return values;
}

describe('candidate resumes service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  });

  it('lists filtered and unfiltered resumes with pagination and conversions', async () => {
    mockCount.mockResolvedValue(2);
    const filteredBuilder = listBuilder([resume()]);
    mockSelect.mockReturnValueOnce(filteredBuilder);

    await expect(
      service.listCandidateResumes({
        page: 2,
        limit: 1,
        candidateId: CANDIDATE_ID,
        applicationId: APPLICATION_ID,
      } as never)
    ).resolves.toEqual({
      data: [expect.objectContaining({ fileSizeMb: 1.25, uploadedAt: '2026-08-10T00:00:00.000Z' })],
      meta: { page: 2, limit: 1, totalItems: 2, totalPages: 2 },
    });
    expect(filteredBuilder.offset).toHaveBeenCalledWith(1);

    mockCount.mockResolvedValue(1);
    mockSelect.mockReturnValueOnce(
      listBuilder([resume({ applicationId: null, uploadedAt: null, createdAt: null })])
    );
    await expect(service.listCandidateResumes({ page: 1, limit: 10 } as never)).resolves.toEqual(
      expect.objectContaining({
        data: [expect.objectContaining({ applicationId: null, uploadedAt: '', createdAt: '' })],
      })
    );
  });

  it('maps a resume detail and rejects missing records', async () => {
    mockFindResume.mockResolvedValueOnce(resume());
    await expect(service.getCandidateResumeById(RESUME_ID)).resolves.toEqual(
      expect.objectContaining({
        fileSizeMb: 1.25,
        storagePath: `candidates/${CANDIDATE_ID}/resume.pdf`,
      })
    );

    mockFindResume.mockResolvedValueOnce(undefined);
    await expect(service.getCandidateResumeById(OTHER_RESUME_ID)).rejects.toThrow(NotFoundError);
  });

  it('validates relations, uploads metadata, and removes an orphaned file on insert failure', async () => {
    mockFindCandidate.mockResolvedValueOnce(undefined);
    await expect(
      service.uploadCandidateResume(
        { candidateId: CANDIDATE_ID } as never,
        Buffer.from('pdf'),
        'resume.pdf',
        1024,
        'application/pdf'
      )
    ).rejects.toThrow(NotFoundError);
    expect(mockUploadFile).not.toHaveBeenCalled();

    mockFindCandidate.mockResolvedValueOnce({ id: CANDIDATE_ID });
    mockFindApplication.mockResolvedValueOnce(undefined);
    await expect(
      service.uploadCandidateResume(
        { candidateId: CANDIDATE_ID, applicationId: APPLICATION_ID } as never,
        Buffer.from('pdf'),
        'resume.pdf',
        1024,
        'application/pdf'
      )
    ).rejects.toThrow(NotFoundError);
    expect(mockUploadFile).not.toHaveBeenCalled();

    mockFindCandidate.mockResolvedValueOnce({ id: CANDIDATE_ID });
    mockFindApplication.mockResolvedValueOnce({ id: APPLICATION_ID });
    mockUploadFile.mockResolvedValueOnce(undefined);
    insertResult([]);
    await expect(
      service.uploadCandidateResume(
        { candidateId: CANDIDATE_ID, applicationId: APPLICATION_ID } as never,
        Buffer.from('pdf'),
        'resume',
        1024 * 1024,
        'application/pdf'
      )
    ).rejects.toThrow(InternalServerError);
    expect(mockDeleteFile).toHaveBeenCalledWith(
      expect.stringMatching(`^candidates/${CANDIDATE_ID}/`)
    );
  });

  it('uploads a resume and returns its hydrated metadata', async () => {
    mockFindCandidate.mockResolvedValueOnce({ id: CANDIDATE_ID });
    mockUploadFile.mockResolvedValueOnce(undefined);
    insertResult([{ id: RESUME_ID }]);
    mockFindResume.mockResolvedValueOnce(resume());

    await expect(
      service.uploadCandidateResume(
        { candidateId: CANDIDATE_ID } as never,
        Buffer.from('pdf'),
        'resume.pdf',
        2 * 1024 * 1024,
        'application/pdf'
      )
    ).resolves.toEqual(expect.objectContaining({ id: RESUME_ID, fileSizeMb: 1.25 }));
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.stringMatching(`^candidates/${CANDIDATE_ID}/[0-9a-f-]+\\.pdf$`),
      expect.any(Buffer),
      'application/pdf'
    );
    expect(mockInsert).toHaveBeenCalledWith(candidateResumes);
  });

  it('downloads existing files, rejects absent files, and removes stored resumes', async () => {
    const stream = { pipe: vi.fn() };
    mockFindResume.mockResolvedValueOnce(resume());
    mockDownloadFile.mockResolvedValueOnce(stream);
    await expect(service.downloadCandidateResume(RESUME_ID)).resolves.toEqual({
      stream,
      resume: expect.objectContaining({ id: RESUME_ID }),
    });

    mockFindResume.mockResolvedValueOnce(resume());
    mockDownloadFile.mockResolvedValueOnce(undefined);
    await expect(service.downloadCandidateResume(RESUME_ID)).rejects.toThrow(NotFoundError);

    mockFindResume.mockResolvedValueOnce(resume());
    await expect(service.removeCandidateResume(RESUME_ID)).resolves.toBeUndefined();
    expect(mockDeleteFile).toHaveBeenCalledWith(`candidates/${CANDIDATE_ID}/resume.pdf`);
    expect(mockDelete).toHaveBeenCalledWith(candidateResumes);

    mockFindResume.mockResolvedValueOnce(undefined);
    await expect(service.removeCandidateResume(OTHER_RESUME_ID)).rejects.toThrow(NotFoundError);
  });
});
