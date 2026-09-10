import { jobVacancies } from '@db/schema/employability.js';
import { InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    query: { jobVacancies: { findFirst: mockFindFirst } },
  },
}));

const service = await import('./vacancies.service.js');

const VACANCY_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function vacancy(overrides: Record<string, unknown> = {}) {
  return {
    id: VACANCY_ID,
    createdBy: USER_ID,
    title: 'Backend Engineer',
    description: 'Build APIs',
    requirements: 'TypeScript',
    isActive: true,
    isPublished: true,
    publicationDate: new Date('2026-08-01T00:00:00.000Z'),
    closingDate: new Date('2026-12-31T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    creator: { id: USER_ID, username: 'admin', email: 'admin@example.com' },
    ...overrides,
  };
}

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VACANCY_ID,
    title: 'Backend Engineer',
    isActive: true,
    isPublished: true,
    publicationDate: new Date('2026-08-01T00:00:00.000Z'),
    closingDate: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    creator: { id: USER_ID, username: 'admin' },
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

function hasQueryValue(
  expression: unknown,
  expected: unknown,
  seen = new WeakSet<object>()
): boolean {
  if (expression === expected) return true;
  if (expression instanceof Date && expected instanceof Date) {
    return expression.getTime() === expected.getTime();
  }
  if (!expression || typeof expression !== 'object' || seen.has(expression)) return false;
  seen.add(expression);
  const candidate = expression as { value?: unknown; queryChunks?: unknown[] };
  if (
    candidate.value === expected ||
    (Array.isArray(candidate.value) && candidate.value.includes(expected))
  ) {
    return true;
  }
  return Object.values(candidate).some((value) =>
    Array.isArray(value)
      ? value.some((child) => hasQueryValue(child, expected, seen))
      : hasQueryValue(value, expected, seen)
  );
}

function hasColumnName(
  expression: unknown,
  expected: string,
  seen = new WeakSet<object>()
): boolean {
  if (!expression || typeof expression !== 'object' || seen.has(expression)) return false;
  seen.add(expression);
  const candidate = expression as { name?: unknown; queryChunks?: unknown[] };
  return (
    candidate.name === expected ||
    candidate.queryChunks?.some((chunk) => hasColumnName(chunk, expected, seen)) === true
  );
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

describe('vacancies service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it('lists vacancies with filters, pagination, and date mapping', async () => {
    mockCount.mockResolvedValue(3);
    const builder = listBuilder([listRow({ closingDate: new Date('2026-12-31T00:00:00.000Z') })]);
    mockSelect.mockReturnValueOnce(builder);

    await expect(
      service.listVacancies({
        page: 2,
        limit: 2,
        isActive: true,
        isPublished: true,
        search: 'backend',
      } as never)
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          publicationDate: '2026-08-01T00:00:00.000Z',
          closingDate: '2026-12-31T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(mockCount).toHaveBeenCalledWith(jobVacancies, expect.anything());
    expect(builder.offset).toHaveBeenCalledWith(2);
  });

  it('maps vacancy details with and without creators and rejects missing records', async () => {
    mockFindFirst.mockResolvedValueOnce(vacancy());
    await expect(service.getVacancyById(VACANCY_ID)).resolves.toEqual(
      expect.objectContaining({
        creator: { id: USER_ID, username: 'admin', email: 'admin@example.com' },
        publicationDate: '2026-08-01T00:00:00.000Z',
      })
    );

    mockFindFirst.mockResolvedValueOnce(
      vacancy({ creator: null, publicationDate: null, closingDate: null })
    );
    await expect(service.getVacancyById(VACANCY_ID)).resolves.toEqual(
      expect.objectContaining({
        creator: { id: '', username: '', email: '' },
        publicationDate: null,
      })
    );

    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.getVacancyById(VACANCY_ID)).rejects.toThrow(NotFoundError);
  });

  it('creates, updates, and removes vacancies', async () => {
    const values = insertResult([vacancy()]);
    mockFindFirst.mockResolvedValueOnce(vacancy());
    await expect(
      service.createVacancy(USER_ID, {
        title: 'Backend Engineer',
        description: 'Build APIs',
        requirements: 'TypeScript',
        isActive: true,
        isPublished: true,
        publicationDate: '2026-08-01T00:00:00.000Z',
        closingDate: '2026-12-31T00:00:00.000Z',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ id: VACANCY_ID }));
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: USER_ID,
        publicationDate: new Date('2026-08-01T00:00:00.000Z'),
      })
    );

    insertResult([]);
    await expect(service.createVacancy(USER_ID, { title: 'Failed' } as never)).rejects.toThrow(
      InternalServerError
    );

    mockFindFirst.mockResolvedValueOnce(vacancy());
    const set = updateResult();
    mockFindFirst.mockResolvedValueOnce(vacancy({ title: 'Updated' }));
    await expect(
      service.updateVacancy(VACANCY_ID, {
        title: 'Updated',
        description: 'Updated description',
        requirements: 'Updated requirements',
        isActive: false,
        isPublished: false,
        publicationDate: null,
        closingDate: null,
      } as never)
    ).resolves.toEqual(expect.objectContaining({ title: 'Updated' }));
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Updated',
        publicationDate: null,
        closingDate: null,
        updatedAt: NOW,
      })
    );

    mockFindFirst.mockResolvedValueOnce(vacancy());
    mockFindFirst.mockResolvedValueOnce(vacancy());
    await expect(service.updateVacancy(VACANCY_ID, {} as never)).resolves.toBeDefined();
    expect(mockUpdate).toHaveBeenCalledOnce();

    mockFindFirst.mockResolvedValueOnce(vacancy());
    const removeSet = updateResult();
    await expect(service.removeVacancy(VACANCY_ID)).resolves.toBeUndefined();
    expect(removeSet).toHaveBeenCalledWith({ deletedAt: NOW });
  });

  it('lists and gets published vacancies with public filters and deterministic pagination', async () => {
    mockCount.mockResolvedValue(3);
    const rowsBuilder = listBuilder([listRow()]);
    mockSelect.mockReturnValueOnce(rowsBuilder);
    await expect(
      service.listPublishedVacancies({
        page: 2,
        limit: 2,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as never)
    ).resolves.toEqual({
      data: [expect.objectContaining({ id: VACANCY_ID })],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });

    const listWhere = rowsBuilder.where.mock.calls[0]?.[0];
    expect(mockCount).toHaveBeenCalledWith(jobVacancies, listWhere);
    expect(hasColumnName(listWhere, 'publication_date')).toBe(true);
    expect(hasColumnName(listWhere, 'closing_date')).toBe(true);
    expect(hasQueryValue(listWhere, NOW)).toBe(true);
    expect(rowsBuilder.limit).toHaveBeenCalledWith(2);
    expect(rowsBuilder.offset).toHaveBeenCalledWith(2);

    const order = rowsBuilder.orderBy.mock.calls[0] ?? [];
    expect(order).toHaveLength(2);
    expect(hasColumnName(order[0], 'created_at')).toBe(true);
    expect(hasQueryValue(order[0], ' desc')).toBe(true);
    expect(hasColumnName(order[1], 'id')).toBe(true);
    expect(hasQueryValue(order[1], ' desc')).toBe(true);

    mockFindFirst.mockResolvedValueOnce(vacancy());
    await expect(service.getPublishedVacancyById(VACANCY_ID)).resolves.toEqual(
      expect.objectContaining({
        creator: { id: USER_ID, username: 'admin' },
        closingDate: '2026-12-31T00:00:00.000Z',
      })
    );
    const detailWhere = mockFindFirst.mock.calls[0]?.[0]?.where;
    expect(hasColumnName(detailWhere, 'publication_date')).toBe(true);
    expect(hasColumnName(detailWhere, 'closing_date')).toBe(true);
    expect(hasQueryValue(detailWhere, NOW)).toBe(true);

    mockFindFirst.mockResolvedValueOnce(
      vacancy({ creator: null, publicationDate: null, closingDate: null })
    );
    await expect(service.getPublishedVacancyById(VACANCY_ID)).resolves.toEqual(
      expect.objectContaining({ creator: { id: '', username: '' }, closingDate: null })
    );

    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.getPublishedVacancyById(VACANCY_ID)).rejects.toThrow(NotFoundError);
  });

  it('honors the requested sort column for published vacancies', async () => {
    mockCount.mockResolvedValue(0);
    const rowsBuilder = listBuilder([]);
    mockSelect.mockReturnValueOnce(rowsBuilder);

    await service.listPublishedVacancies({
      page: 1,
      limit: 10,
      sortBy: 'title',
      sortOrder: 'asc',
    } as never);

    const order = rowsBuilder.orderBy.mock.calls[0] ?? [];
    expect(order).toHaveLength(2);
    expect(hasColumnName(order[0], 'title')).toBe(true);
    expect(hasQueryValue(order[0], ' asc')).toBe(true);
    expect(hasColumnName(order[1], 'id')).toBe(true);
  });
});
