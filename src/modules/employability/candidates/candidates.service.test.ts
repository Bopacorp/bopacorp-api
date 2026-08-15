import { candidates } from '@db/schema/employability.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: { candidates: { findFirst: mockFindFirst } },
  },
}));

const service = await import('./candidates.service.js');

const CANDIDATE_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: CANDIDATE_ID,
    nationalId: '0912345678',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '0999999999',
    address: 'Main street',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
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

function terminalSelect(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
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

describe('candidates service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  });

  it('lists searched candidates with pagination and timestamp mapping', async () => {
    mockCount.mockResolvedValue(3);
    const builder = listBuilder([candidate()]);
    mockSelect.mockReturnValueOnce(builder);

    await expect(
      service.listCandidates({ page: 2, limit: 2, search: 'ada' } as never)
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: CANDIDATE_ID,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(mockCount).toHaveBeenCalledWith(candidates, expect.anything());
    expect(builder.limit).toHaveBeenCalledWith(2);
    expect(builder.offset).toHaveBeenCalledWith(2);

    mockCount.mockResolvedValue(0);
    mockSelect.mockReturnValueOnce(listBuilder([]));
    await expect(service.listCandidates({ page: 1, limit: 10 } as never)).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it('gets candidates and rejects missing records', async () => {
    mockFindFirst.mockResolvedValueOnce(candidate());
    await expect(service.getCandidateById(CANDIDATE_ID)).resolves.toEqual(
      expect.objectContaining({ id: CANDIDATE_ID, email: 'ada@example.com' })
    );

    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.getCandidateById(OTHER_ID)).rejects.toThrow(NotFoundError);
  });

  it('normalizes email, detects duplicates, creates, and handles failed inserts', async () => {
    mockSelect.mockReturnValueOnce(terminalSelect([candidate()]));
    await expect(
      service.createCandidate({ email: 'ADA@EXAMPLE.COM', nationalId: '0912345678' } as never)
    ).rejects.toThrow(ConflictError);

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    const values = insertResult([{ id: CANDIDATE_ID }]);
    mockFindFirst.mockResolvedValueOnce(candidate({ email: 'ada@example.com' }));
    await expect(
      service.createCandidate({
        email: 'ADA@EXAMPLE.COM',
        nationalId: '0912345678',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '0999999999',
        address: 'Main street',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ email: 'ada@example.com' }));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.com' }));

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    insertResult([]);
    await expect(service.createCandidate({ email: 'new@example.com' } as never)).rejects.toThrow(
      InternalServerError
    );
  });

  it('updates all candidate fields, supports no-op updates, and removes candidates', async () => {
    mockFindFirst.mockResolvedValueOnce(candidate());
    const set = updateResult();
    mockFindFirst.mockResolvedValueOnce(candidate({ email: 'new@example.com' }));
    await expect(
      service.updateCandidate(CANDIDATE_ID, {
        nationalId: '0998765432',
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'NEW@EXAMPLE.COM',
        phone: '0988888888',
        address: 'Updated street',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ email: 'new@example.com' }));
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        nationalId: '0998765432',
        firstName: 'Grace',
        email: 'new@example.com',
        updatedAt: NOW,
      })
    );

    mockFindFirst.mockResolvedValueOnce(candidate());
    mockFindFirst.mockResolvedValueOnce(candidate());
    await expect(service.updateCandidate(CANDIDATE_ID, {} as never)).resolves.toBeDefined();
    expect(mockUpdate).toHaveBeenCalledOnce();

    mockFindFirst.mockResolvedValueOnce(candidate());
    await expect(service.removeCandidate(CANDIDATE_ID)).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith(candidates);

    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.removeCandidate(OTHER_ID)).rejects.toThrow(NotFoundError);
  });
});
