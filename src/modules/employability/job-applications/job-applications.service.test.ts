import { jobApplications } from '@db/schema/employability.js';
import { InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFindApplication = vi.fn();
const mockFindResume = vi.fn();
const mockFindVacancy = vi.fn();
const mockFindCandidate = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    query: {
      jobApplications: { findFirst: mockFindApplication },
      candidateResumes: { findFirst: mockFindResume },
      jobVacancies: { findFirst: mockFindVacancy },
      candidates: { findFirst: mockFindCandidate },
    },
  },
}));

const service = await import('./job-applications.service.js');

const APPLICATION_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_APPLICATION_ID = '22222222-2222-2222-2222-222222222222';
const VACANCY_ID = '33333333-3333-3333-3333-333333333333';
const CANDIDATE_ID = '44444444-4444-4444-4444-444444444444';
const OTHER_CANDIDATE_ID = '55555555-5555-5555-5555-555555555555';
const USER_ID = '66666666-6666-6666-6666-666666666666';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function application(overrides: Record<string, unknown> = {}) {
  return {
    id: APPLICATION_ID,
    vacancyId: VACANCY_ID,
    candidateId: CANDIDATE_ID,
    state: 'PENDING',
    coverLetter: 'I am interested',
    reviewNotes: null,
    reviewDate: null,
    appliedAt: new Date('2026-08-10T00:00:00.000Z'),
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    vacancy: { id: VACANCY_ID, title: 'Backend Engineer' },
    candidate: {
      id: CANDIDATE_ID,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    },
    reviewer: { id: USER_ID, username: 'reviewer', email: 'reviewer@example.com' },
    ...overrides,
  };
}

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPLICATION_ID,
    state: 'PENDING',
    appliedAt: new Date('2026-08-10T00:00:00.000Z'),
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    vacancy: { id: VACANCY_ID, title: 'Backend Engineer' },
    candidate: { id: CANDIDATE_ID, firstName: 'Ada', lastName: 'Lovelace' },
    ...overrides,
  };
}

function resume(overrides: Record<string, unknown> = {}) {
  return {
    id: '77777777-7777-7777-7777-777777777777',
    applicationId: APPLICATION_ID,
    candidateId: CANDIDATE_ID,
    filename: 'ada.pdf',
    mimeType: 'application/pdf',
    fileSizeMb: '1.25',
    uploadedAt: new Date('2026-08-09T00:00:00.000Z'),
    ...overrides,
  };
}

function listBuilder(result: unknown) {
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
  builder.where.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

function resumeListBuilder(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

function insertResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return values;
}

function updateResult() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return set;
}

describe('job applications service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockUpdate.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }));
  });

  it('lists applications with filters, linked resumes, fallback resumes, and no resumes', async () => {
    mockCount.mockResolvedValue(3);
    const rows = [
      listRow(),
      listRow({
        id: OTHER_APPLICATION_ID,
        candidate: { id: OTHER_CANDIDATE_ID, firstName: 'Grace', lastName: 'Hopper' },
      }),
      listRow({
        id: '88888888-8888-8888-8888-888888888888',
        candidate: {
          id: '99999999-9999-9999-9999-999999999999',
          firstName: 'No',
          lastName: 'Resume',
        },
        appliedAt: null,
      }),
    ];
    mockSelect.mockReturnValueOnce(listBuilder(rows));
    mockSelect.mockReturnValueOnce(
      resumeListBuilder([
        resume(),
        resume({
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          applicationId: null,
          candidateId: OTHER_CANDIDATE_ID,
        }),
      ])
    );

    await expect(
      service.listJobApplications({
        page: 2,
        limit: 2,
        vacancyId: VACANCY_ID,
        candidateId: CANDIDATE_ID,
        state: 'PENDING',
        reviewedBy: USER_ID,
      } as never)
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: APPLICATION_ID,
          hasResume: true,
          appliedAt: '2026-08-10T00:00:00.000Z',
        }),
        expect.objectContaining({ id: OTHER_APPLICATION_ID, hasResume: true }),
        expect.objectContaining({ hasResume: false, appliedAt: null }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(mockCount).toHaveBeenCalledWith(jobApplications, expect.anything());

    mockCount.mockResolvedValue(0);
    mockSelect.mockReturnValueOnce(listBuilder([]));
    await expect(service.listJobApplications({ page: 1, limit: 10 } as never)).resolves.toEqual(
      expect.objectContaining({
        data: [],
        meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
      })
    );
  });

  it('maps application details with relationships and resume presence', async () => {
    mockFindApplication.mockResolvedValueOnce(application());
    mockFindResume.mockResolvedValueOnce(resume());
    await expect(service.getJobApplicationById(APPLICATION_ID)).resolves.toEqual(
      expect.objectContaining({
        id: APPLICATION_ID,
        reviewer: { id: USER_ID, username: 'reviewer', email: 'reviewer@example.com' },
        resume: expect.objectContaining({ fileSizeMb: 1.25 }),
      })
    );

    mockFindApplication.mockResolvedValueOnce(
      application({
        vacancy: null,
        candidate: null,
        reviewer: null,
        reviewDate: null,
        appliedAt: null,
      })
    );
    mockFindResume.mockResolvedValueOnce(undefined);
    await expect(service.getJobApplicationById(APPLICATION_ID)).resolves.toEqual(
      expect.objectContaining({
        vacancy: { id: '', title: '' },
        candidate: { id: '', firstName: '', lastName: '', email: '' },
        reviewer: null,
        resume: null,
      })
    );

    mockFindApplication.mockResolvedValueOnce(undefined);
    await expect(service.getJobApplicationById(OTHER_APPLICATION_ID)).rejects.toThrow(
      NotFoundError
    );
  });

  it('creates applications after validating relations and hydrates the result', async () => {
    mockFindVacancy.mockResolvedValueOnce({ id: VACANCY_ID });
    mockFindCandidate.mockResolvedValueOnce({ id: CANDIDATE_ID });
    insertResult([{ id: APPLICATION_ID }]);
    mockFindApplication.mockResolvedValueOnce(application());
    mockFindResume.mockResolvedValueOnce(undefined);
    await expect(
      service.createJobApplication({
        vacancyId: VACANCY_ID,
        candidateId: CANDIDATE_ID,
        coverLetter: 'Hello',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ id: APPLICATION_ID, resume: null }));

    mockFindVacancy.mockResolvedValueOnce(undefined);
    await expect(
      service.createJobApplication({ vacancyId: VACANCY_ID, candidateId: CANDIDATE_ID } as never)
    ).rejects.toThrow(NotFoundError);

    mockFindVacancy.mockResolvedValueOnce({ id: VACANCY_ID });
    mockFindCandidate.mockResolvedValueOnce(undefined);
    await expect(
      service.createJobApplication({ vacancyId: VACANCY_ID, candidateId: CANDIDATE_ID } as never)
    ).rejects.toThrow(NotFoundError);

    mockFindVacancy.mockResolvedValueOnce({ id: VACANCY_ID });
    mockFindCandidate.mockResolvedValueOnce({ id: CANDIDATE_ID });
    insertResult([]);
    await expect(
      service.createJobApplication({ vacancyId: VACANCY_ID, candidateId: CANDIDATE_ID } as never)
    ).rejects.toThrow(InternalServerError);
  });

  it('updates review metadata and applied date during state transitions', async () => {
    mockFindApplication.mockResolvedValueOnce(application({ state: 'DRAFT', appliedAt: null }));
    const set = updateResult();
    mockFindApplication.mockResolvedValueOnce(application({ state: 'PENDING', appliedAt: NOW }));
    mockFindResume.mockResolvedValueOnce(undefined);
    await expect(
      service.updateJobApplication(APPLICATION_ID, USER_ID, {
        state: 'PENDING',
        reviewNotes: 'Reviewed',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ state: 'PENDING' }));
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'PENDING',
        appliedAt: NOW,
        reviewedBy: USER_ID,
        reviewDate: NOW,
        reviewNotes: 'Reviewed',
      })
    );

    mockFindApplication.mockResolvedValueOnce(application({ state: 'PENDING', appliedAt: NOW }));
    const noReviewSet = updateResult();
    mockFindApplication.mockResolvedValueOnce(application());
    mockFindResume.mockResolvedValueOnce(undefined);
    await expect(
      service.updateJobApplication(APPLICATION_ID, USER_ID, {} as never)
    ).resolves.toBeDefined();
    expect(noReviewSet).toHaveBeenCalledWith({ updatedAt: NOW });

    mockFindApplication.mockResolvedValueOnce(undefined);
    await expect(
      service.updateJobApplication(OTHER_APPLICATION_ID, USER_ID, {} as never)
    ).rejects.toThrow(NotFoundError);
  });

  it('removes applications and rejects missing records', async () => {
    mockFindApplication.mockResolvedValueOnce(application());
    await expect(service.removeJobApplication(APPLICATION_ID)).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(jobApplications);

    mockFindApplication.mockResolvedValueOnce(undefined);
    await expect(service.removeJobApplication(OTHER_APPLICATION_ID)).rejects.toThrow(NotFoundError);
  });
});
