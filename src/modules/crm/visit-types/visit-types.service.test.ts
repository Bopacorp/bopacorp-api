import type {
  CreateVisitTypeRequest,
  ListVisitTypesQuery,
  UpdateVisitTypeRequest,
} from '@bopacorp/shared/crm';
import { visits, visitTypes } from '@db/schema/crm.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    query: { visitTypes: { findFirst: mockFindFirst } },
  },
}));
const service = await import('./visit-types.service.js');
const ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-08-13T12:00:00.000Z');
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    code: 'ON_SITE',
    name: 'On site',
    description: 'Customer premises',
    isActive: true,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-02-03T04:05:06.000Z'),
    ...overrides,
  };
}
function hasValue(expression: unknown, expected: unknown, seen = new WeakSet<object>()): boolean {
  if (expression === expected) return true;
  if (!expression || typeof expression !== 'object' || seen.has(expression)) return false;
  seen.add(expression);
  return Object.values(expression as Record<string, unknown>).some((value) =>
    Array.isArray(value)
      ? value.some((item) => hasValue(item, expected, seen))
      : hasValue(value, expected, seen)
  );
}
function hasColumn(expression: unknown, expected: string, seen = new WeakSet<object>()): boolean {
  if (!expression || typeof expression !== 'object' || seen.has(expression)) return false;
  seen.add(expression);
  const candidate = expression as { name?: unknown };
  return (
    candidate.name === expected ||
    Object.values(candidate).some((value) =>
      Array.isArray(value)
        ? value.some((item) => hasColumn(item, expected, seen))
        : hasColumn(value, expected, seen)
    )
  );
}
function selectBuilder(result: unknown, paginated = false) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  if (paginated) {
    builder.where.mockReturnValue(builder);
    builder.orderBy.mockResolvedValue(result);
  } else builder.where.mockResolvedValue(result);
  return builder;
}

describe('visit types service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
  });
  afterEach(() => vi.useRealTimers());
  it('filters, pages, sorts requested columns, maps rows, and returns an empty page', async () => {
    mockCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const populated = selectBuilder([row()], true);
    const codeAscending = selectBuilder([], true);
    const createdAtAscending = selectBuilder([], true);
    const empty = selectBuilder([], true);
    mockSelect
      .mockReturnValueOnce(populated)
      .mockReturnValueOnce(codeAscending)
      .mockReturnValueOnce(createdAtAscending)
      .mockReturnValueOnce(empty);
    const query: ListVisitTypesQuery = {
      page: 2,
      limit: 2,
      isActive: true,
      search: 'site',
      sortBy: 'name',
      sortOrder: 'desc',
    };
    await expect(service.listVisitTypes(query)).resolves.toEqual({
      data: [expect.objectContaining({ id: ID, createdAt: '2026-01-02T03:04:05.000Z' })],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    const where = populated.where.mock.calls[0]?.[0];
    expect(mockCount).toHaveBeenCalledWith(visitTypes, where);
    expect(populated.from).toHaveBeenCalledWith(visitTypes);
    expect(hasColumn(where, 'is_active')).toBe(true);
    expect(hasColumn(where, 'name')).toBe(true);
    expect(hasColumn(where, 'code')).toBe(true);
    expect(hasValue(where, '%site%')).toBe(true);
    expect(populated.limit).toHaveBeenCalledWith(2);
    expect(populated.offset).toHaveBeenCalledWith(2);
    expect(hasColumn(populated.orderBy.mock.calls[0]?.[0], 'name')).toBe(true);
    expect(hasValue(populated.orderBy.mock.calls[0]?.[0], ' desc')).toBe(true);
    await service.listVisitTypes({ page: 1, limit: 1, sortBy: 'code', sortOrder: 'asc' });
    expect(hasColumn(codeAscending.orderBy.mock.calls[0]?.[0], 'code')).toBe(true);
    expect(hasValue(codeAscending.orderBy.mock.calls[0]?.[0], ' asc')).toBe(true);
    await service.listVisitTypes({ page: 1, limit: 1, sortOrder: 'asc' });
    expect(hasColumn(createdAtAscending.orderBy.mock.calls[0]?.[0], 'created_at')).toBe(true);
    expect(hasValue(createdAtAscending.orderBy.mock.calls[0]?.[0], ' asc')).toBe(true);
    await expect(service.listVisitTypes({ page: 1, limit: 10, sortOrder: 'asc' })).resolves.toEqual(
      { data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } }
    );
  });
  it('maps a detail and rejects a missing visit type with its id predicate', async () => {
    mockFindFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(undefined);
    await expect(service.getVisitTypeById(ID)).resolves.toEqual(
      expect.objectContaining({ id: ID })
    );
    await expect(service.getVisitTypeById(OTHER_ID)).rejects.toThrow(NotFoundError);
    const where = mockFindFirst.mock.calls[0]?.[0]?.where;
    expect(hasColumn(where, 'id')).toBe(true);
    expect(hasValue(where, ID)).toBe(true);
    const missingWhere = mockFindFirst.mock.calls[1]?.[0]?.where;
    expect(hasColumn(missingWhere, 'id')).toBe(true);
    expect(hasValue(missingWhere, OTHER_ID)).toBe(true);
  });
  it('rejects duplicate create, writes requested values then hydrates, and handles failed inserts', async () => {
    const duplicate = selectBuilder([row()]);
    mockSelect.mockReturnValueOnce(duplicate);
    await expect(
      service.createVisitType({ code: 'ON_SITE' } as CreateVisitTypeRequest)
    ).rejects.toThrow(ConflictError);
    expect(duplicate.from).toHaveBeenCalledWith(visitTypes);
    expect(hasColumn(duplicate.where.mock.calls[0]?.[0], 'code')).toBe(true);
    vi.resetAllMocks();
    const values = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: OTHER_ID }]) }));
    mockSelect.mockReturnValueOnce(selectBuilder([]));
    mockInsert.mockReturnValue({ values });
    mockFindFirst.mockResolvedValue(row({ id: OTHER_ID }));
    const data = {
      code: 'REMOTE',
      name: 'Remote',
      description: null,
      isActive: false,
    } as CreateVisitTypeRequest;
    await expect(service.createVisitType(data)).resolves.toEqual(
      expect.objectContaining({
        id: OTHER_ID,
        code: 'ON_SITE',
        description: 'Customer premises',
      })
    );
    expect(mockInsert).toHaveBeenCalledWith(visitTypes);
    expect(values).toHaveBeenCalledWith(data);
    const createHydrationWhere = mockFindFirst.mock.calls[0]?.[0]?.where;
    expect(hasColumn(createHydrationWhere, 'id')).toBe(true);
    expect(hasValue(createHydrationWhere, OTHER_ID)).toBe(true);
    vi.resetAllMocks();
    mockSelect.mockReturnValueOnce(selectBuilder([]));
    mockInsert.mockReturnValue({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    });
    await expect(service.createVisitType(data)).rejects.toThrow('Failed to create visit type');
  });
  it('rejects missing and duplicate updates, writes current code fields, and skips an empty update', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(
      service.updateVisitType(ID, { name: 'Updated' } as UpdateVisitTypeRequest)
    ).rejects.toThrow(NotFoundError);
    mockFindFirst.mockResolvedValueOnce(row());
    mockSelect.mockReturnValueOnce(selectBuilder([row({ id: OTHER_ID })]));
    await expect(
      service.updateVisitType(ID, { code: 'OTHER' } as UpdateVisitTypeRequest)
    ).rejects.toThrow(ConflictError);

    vi.resetAllMocks();
    mockFindFirst.mockResolvedValueOnce(row());
    const currentCode = selectBuilder([row()]);
    mockSelect.mockReturnValueOnce(currentCode);
    await expect(
      service.updateVisitType(ID, { code: 'ON_SITE' } as UpdateVisitTypeRequest)
    ).rejects.toThrow(ConflictError);
    const currentCodeWhere = currentCode.where.mock.calls[0]?.[0];
    expect(hasColumn(currentCodeWhere, 'code')).toBe(true);
    expect(hasColumn(currentCodeWhere, 'id')).toBe(true);
    expect(hasValue(currentCodeWhere, ID)).toBe(true);

    vi.resetAllMocks();
    mockFindFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(
        row({ code: 'UPDATED', name: 'Updated', description: 'Updated note' })
      );
    mockSelect.mockReturnValueOnce(selectBuilder([]));
    const where = vi.fn().mockResolvedValue([]);
    const set = vi.fn(() => ({ where }));
    mockUpdate.mockReturnValue({ set });
    const updated = await service.updateVisitType(ID, {
      code: 'UPDATED',
      name: 'Updated',
      description: 'Updated note',
      isActive: false,
    } as UpdateVisitTypeRequest);
    expect(updated).toEqual(
      expect.objectContaining({ code: 'UPDATED', description: 'Updated note' })
    );
    const updateHydrationWhere = mockFindFirst.mock.calls[1]?.[0]?.where;
    expect(hasColumn(updateHydrationWhere, 'id')).toBe(true);
    expect(hasValue(updateHydrationWhere, ID)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(visitTypes);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UPDATED',
        name: 'Updated',
        description: 'Updated note',
        isActive: false,
        updatedAt: NOW,
      })
    );
    expect(hasColumn(where.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasValue(where.mock.calls[0]?.[0], ID)).toBe(true);
    vi.resetAllMocks();
    mockFindFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(row());
    await service.updateVisitType(ID, {} as UpdateVisitTypeRequest);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
  it('reads dependent visits and deactivates used types or deletes unused types', async () => {
    mockFindFirst.mockResolvedValueOnce(row());
    const used = selectBuilder([{ count: ID }]);
    mockSelect.mockReturnValueOnce(used);
    const where = vi.fn().mockResolvedValue([]);
    const set = vi.fn(() => ({ where }));
    mockUpdate.mockReturnValue({ set });
    await service.removeVisitType(ID);
    expect(used.from).toHaveBeenCalledWith(visits);
    const usedWhere = used.where.mock.calls[0]?.[0];
    expect(hasColumn(usedWhere, 'visit_type_id')).toBe(true);
    expect(hasValue(usedWhere, ID)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(visitTypes);
    expect(set).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });
    expect(hasColumn(where.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasValue(where.mock.calls[0]?.[0], ID)).toBe(true);
    vi.resetAllMocks();
    mockFindFirst.mockResolvedValueOnce(row());
    mockSelect.mockReturnValueOnce(selectBuilder([]));
    const deleteWhere = vi.fn().mockResolvedValue([]);
    mockDelete.mockReturnValue({ where: deleteWhere });
    await service.removeVisitType(ID);
    expect(mockDelete).toHaveBeenCalledWith(visitTypes);
    expect(hasColumn(deleteWhere.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasValue(deleteWhere.mock.calls[0]?.[0], ID)).toBe(true);
  });
});
