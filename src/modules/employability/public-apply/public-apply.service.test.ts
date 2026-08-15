import { candidateResumes, candidates, jobApplications } from '@db/schema/employability.js';
import { InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInsert = vi.fn();
const mockTransaction = vi.fn();
const mockFindVacancy = vi.fn();
const mockFindCandidate = vi.fn();
const mockUploadFile = vi.fn();
const mockDeleteFile = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    insert: mockInsert,
    transaction: mockTransaction,
    query: {
      jobVacancies: { findFirst: mockFindVacancy },
      candidates: { findFirst: mockFindCandidate },
    },
  },
}));
vi.mock('@lib/storage.js', () => ({
  uploadFile: mockUploadFile,
  deleteFile: mockDeleteFile,
}));

const service = await import('./public-apply.service.js');

const VACANCY_ID = '11111111-1111-1111-1111-111111111111';
const CANDIDATE_ID = '22222222-2222-2222-2222-222222222222';
const APPLICATION_ID = '33333333-3333-3333-3333-333333333333';
const RESUME_ID = '44444444-4444-4444-4444-444444444444';
const APPLIED_AT = new Date('2026-08-14T12:00:00.000Z');

const applyData = {
  vacancyId: VACANCY_ID,
  candidate: {
    nationalId: '0912345678',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ADA@example.com',
    phone: '0999999999',
    address: 'London',
  },
  coverLetter: 'I would love to join the team',
};

function vacancy() {
  return { id: VACANCY_ID, title: 'Backend Engineer' };
}

function insertResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return values;
}

function transaction(resumeResult: unknown[], applicationResult: unknown[]) {
  let insertCount = 0;
  const tx = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
    insert: vi.fn().mockImplementation(() => {
      const result = insertCount++ === 0 ? resumeResult : applicationResult;
      return {
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(result) }),
      };
    }),
  };
  mockTransaction.mockImplementationOnce(async (callback: (value: typeof tx) => Promise<unknown>) =>
    callback(tx)
  );
  return tx;
}

describe('public apply service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects applications for vacancies that are not publicly available', async () => {
    mockFindVacancy.mockResolvedValue(undefined);

    await expect(
      service.applyJobVacancy(
        applyData as never,
        Buffer.from('pdf'),
        'resume.pdf',
        1024,
        'application/pdf'
      )
    ).rejects.toThrow(NotFoundError);
    expect(mockFindCandidate).not.toHaveBeenCalled();
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('creates a candidate and applies with a transaction-backed resume and application', async () => {
    mockFindVacancy.mockResolvedValue(vacancy());
    mockFindCandidate.mockResolvedValue(undefined);
    insertResult([{ id: CANDIDATE_ID }]);
    mockUploadFile.mockResolvedValue(undefined);
    const tx = transaction(
      [{ id: RESUME_ID }],
      [{ id: APPLICATION_ID, state: 'PENDING', appliedAt: APPLIED_AT }]
    );

    await expect(
      service.applyJobVacancy(
        applyData as never,
        Buffer.from('pdf'),
        'resume',
        1024 * 1024,
        'application/pdf'
      )
    ).resolves.toEqual({
      id: APPLICATION_ID,
      state: 'PENDING',
      appliedAt: APPLIED_AT.toISOString(),
      candidate: {
        id: CANDIDATE_ID,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      },
      vacancy: { id: VACANCY_ID, title: 'Backend Engineer' },
    });
    expect(mockInsert).toHaveBeenCalledWith(candidates);
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.stringMatching(`^candidates/${CANDIDATE_ID}/[0-9a-f-]+\\.resume$`),
      expect.any(Buffer),
      'application/pdf'
    );
    expect(tx.insert).toHaveBeenNthCalledWith(1, candidateResumes);
    expect(tx.insert).toHaveBeenNthCalledWith(2, jobApplications);
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it('reuses an existing candidate and normalizes the email', async () => {
    mockFindVacancy.mockResolvedValue(vacancy());
    mockFindCandidate.mockResolvedValue({ id: CANDIDATE_ID });
    mockUploadFile.mockResolvedValue(undefined);
    transaction(
      [{ id: RESUME_ID }],
      [{ id: APPLICATION_ID, state: 'PENDING', appliedAt: APPLIED_AT }]
    );

    await service.applyJobVacancy(
      applyData as never,
      Buffer.from('pdf'),
      'resume.pdf',
      1024,
      'application/pdf'
    );

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.stringMatching(`^candidates/${CANDIDATE_ID}/[0-9a-f-]+\\.pdf$`),
      expect.any(Buffer),
      'application/pdf'
    );
  });

  it('rejects candidate creation failures before uploading a file', async () => {
    mockFindVacancy.mockResolvedValue(vacancy());
    mockFindCandidate.mockResolvedValue(undefined);
    insertResult([]);

    await expect(
      service.applyJobVacancy(
        applyData as never,
        Buffer.from('pdf'),
        'resume.pdf',
        1024,
        'application/pdf'
      )
    ).rejects.toThrow(InternalServerError);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('cleans up the uploaded file when the transaction fails', async () => {
    mockFindVacancy.mockResolvedValue(vacancy());
    mockFindCandidate.mockResolvedValue({ id: CANDIDATE_ID });
    mockUploadFile.mockResolvedValue(undefined);
    const transactionError = new Error('database failure');
    mockTransaction.mockImplementationOnce(async () => {
      throw transactionError;
    });

    await expect(
      service.applyJobVacancy(
        applyData as never,
        Buffer.from('pdf'),
        'resume.pdf',
        1024,
        'application/pdf'
      )
    ).rejects.toBe(transactionError);
    expect(mockDeleteFile).toHaveBeenCalledWith(
      expect.stringMatching(`^candidates/${CANDIDATE_ID}/`)
    );
  });

  it('cleans up when resume or application metadata cannot be created', async () => {
    mockFindVacancy.mockResolvedValue(vacancy());
    mockFindCandidate.mockResolvedValue({ id: CANDIDATE_ID });
    mockUploadFile.mockResolvedValue(undefined);
    transaction([], [{ id: APPLICATION_ID, state: 'PENDING', appliedAt: APPLIED_AT }]);

    await expect(
      service.applyJobVacancy(
        applyData as never,
        Buffer.from('pdf'),
        'resume.pdf',
        1024,
        'application/pdf'
      )
    ).rejects.toThrow(InternalServerError);
    expect(mockDeleteFile).toHaveBeenCalledWith(
      expect.stringMatching(`^candidates/${CANDIDATE_ID}/`)
    );

    vi.resetAllMocks();
    mockFindVacancy.mockResolvedValue(vacancy());
    mockFindCandidate.mockResolvedValue({ id: CANDIDATE_ID });
    mockUploadFile.mockResolvedValue(undefined);
    transaction([{ id: RESUME_ID }], []);

    await expect(
      service.applyJobVacancy(
        applyData as never,
        Buffer.from('pdf'),
        'resume.pdf',
        1024,
        'application/pdf'
      )
    ).rejects.toThrow(InternalServerError);
    expect(mockDeleteFile).toHaveBeenCalledWith(
      expect.stringMatching(`^candidates/${CANDIDATE_ID}/`)
    );
  });
});
