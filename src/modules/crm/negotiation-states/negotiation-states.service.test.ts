import type {
  CreateNegotiationStateRequest,
  ListNegotiationStatesQuery,
  UpdateNegotiationStateRequest,
} from '@bopacorp/shared/crm';
import { negotiationStates, negotiations } from '@db/schema/crm.js';
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
    query: { negotiationStates: { findFirst: mockFindFirst } },
  },
}));

const service = await import('./negotiation-states.service.js');
const ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-08-13T12:00:00.000Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    code: 'PROSPECTING',
    name: 'Prospecting',
    description: 'Initial contact',
    position: 2,
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
  const candidate = expression as { name?: unknown; queryChunks?: unknown[] };
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

describe('negotiation states service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('filters, paginates, orders, maps rows, and returns an empty page', async () => {
    mockCount.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    const populated = selectBuilder([row()], true);
    const empty = selectBuilder([], true);
    mockSelect.mockReturnValueOnce(populated).mockReturnValueOnce(empty);
    const query: ListNegotiationStatesQuery = { page: 2, limit: 2, isActive: true, search: 'pros' };
    await expect(service.listNegotiationStates(query)).resolves.toEqual({
      data: [expect.objectContaining({ id: ID, createdAt: '2026-01-02T03:04:05.000Z' })],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    const where = populated.where.mock.calls[0]?.[0];
    expect(mockCount).toHaveBeenCalledWith(negotiationStates, where);
    expect(populated.from).toHaveBeenCalledWith(negotiationStates);
    expect(hasColumn(where, 'is_active')).toBe(true);
    expect(hasColumn(where, 'name')).toBe(true);
    expect(hasColumn(where, 'code')).toBe(true);
    expect(hasValue(where, '%pros%')).toBe(true);
    expect(populated.limit).toHaveBeenCalledWith(2);
    expect(populated.offset).toHaveBeenCalledWith(2);
    expect(hasColumn(populated.orderBy.mock.calls[0]?.[0], 'position')).toBe(true);
    await expect(service.listNegotiationStates({ page: 1, limit: 10 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it('maps a detail and rejects a missing state with its id predicate', async () => {
    mockFindFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(undefined);
    await expect(service.getNegotiationStateById(ID)).resolves.toEqual(
      expect.objectContaining({ id: ID })
    );
    await expect(service.getNegotiationStateById(OTHER_ID)).rejects.toThrow(NotFoundError);
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
      service.createNegotiationState({ code: 'PROSPECTING' } as CreateNegotiationStateRequest)
    ).rejects.toThrow(ConflictError);
    expect(duplicate.from).toHaveBeenCalledWith(negotiationStates);
    expect(hasColumn(duplicate.where.mock.calls[0]?.[0], 'code')).toBe(true);

    vi.resetAllMocks();
    const unique = selectBuilder([]);
    const values = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: OTHER_ID }]) }));
    mockSelect.mockReturnValueOnce(unique);
    mockInsert.mockReturnValue({ values });
    mockFindFirst.mockResolvedValue(row({ id: OTHER_ID }));
    const data = {
      code: 'NEW',
      name: 'New',
      description: null,
      isActive: false,
    } as CreateNegotiationStateRequest;
    await expect(service.createNegotiationState(data)).resolves.toEqual(
      expect.objectContaining({
        id: OTHER_ID,
        code: 'PROSPECTING',
        description: 'Initial contact',
      })
    );
    expect(mockInsert).toHaveBeenCalledWith(negotiationStates);
    expect(values).toHaveBeenCalledWith(data);
    const createHydrationWhere = mockFindFirst.mock.calls[0]?.[0]?.where;
    expect(hasColumn(createHydrationWhere, 'id')).toBe(true);
    expect(hasValue(createHydrationWhere, OTHER_ID)).toBe(true);

    vi.resetAllMocks();
    mockSelect.mockReturnValueOnce(selectBuilder([]));
    mockInsert.mockReturnValue({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    });
    await expect(service.createNegotiationState(data)).rejects.toThrow(
      'Failed to create negotiation state'
    );
  });

  it('rejects missing and duplicate updates, writes mutable fields, and skips an empty update', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(
      service.updateNegotiationState(ID, { name: 'Updated' } as UpdateNegotiationStateRequest)
    ).rejects.toThrow(NotFoundError);

    mockFindFirst.mockResolvedValueOnce(row());
    mockSelect.mockReturnValueOnce(selectBuilder([row({ id: OTHER_ID })]));
    await expect(
      service.updateNegotiationState(ID, { code: 'OTHER' } as UpdateNegotiationStateRequest)
    ).rejects.toThrow(ConflictError);

    vi.resetAllMocks();
    mockFindFirst.mockResolvedValueOnce(row());
    const currentCode = selectBuilder([row()]);
    mockSelect.mockReturnValueOnce(currentCode);
    await expect(
      service.updateNegotiationState(ID, { code: 'PROSPECTING' } as UpdateNegotiationStateRequest)
    ).rejects.toThrow(ConflictError);
    const currentCodeWhere = currentCode.where.mock.calls[0]?.[0];
    expect(hasColumn(currentCodeWhere, 'code')).toBe(true);
    expect(hasColumn(currentCodeWhere, 'id')).toBe(true);
    expect(hasValue(currentCodeWhere, ID)).toBe(true);

    vi.resetAllMocks();
    mockFindFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(
        row({ name: 'Updated', code: 'UPDATED', description: 'Updated note' })
      );
    mockSelect.mockReturnValueOnce(selectBuilder([]));
    const where = vi.fn().mockResolvedValue([]);
    const set = vi.fn(() => ({ where }));
    mockUpdate.mockReturnValue({ set });
    const updated = await service.updateNegotiationState(ID, {
      code: 'UPDATED',
      name: 'Updated',
      description: 'Updated note',
      isActive: false,
    } as UpdateNegotiationStateRequest);
    expect(updated).toEqual(
      expect.objectContaining({ code: 'UPDATED', description: 'Updated note' })
    );
    const updateHydrationWhere = mockFindFirst.mock.calls[1]?.[0]?.where;
    expect(hasColumn(updateHydrationWhere, 'id')).toBe(true);
    expect(hasValue(updateHydrationWhere, ID)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(negotiationStates);
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
    await service.updateNegotiationState(ID, {} as UpdateNegotiationStateRequest);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('reads dependent negotiations and deactivates used states or deletes unused states', async () => {
    mockFindFirst.mockResolvedValueOnce(row());
    const used = selectBuilder([{ count: ID }]);
    mockSelect.mockReturnValueOnce(used);
    const where = vi.fn().mockResolvedValue([]);
    const set = vi.fn(() => ({ where }));
    mockUpdate.mockReturnValue({ set });
    await service.removeNegotiationState(ID);
    expect(used.from).toHaveBeenCalledWith(negotiations);
    const usedWhere = used.where.mock.calls[0]?.[0];
    expect(hasColumn(usedWhere, 'state_id')).toBe(true);
    expect(hasValue(usedWhere, ID)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(negotiationStates);
    expect(set).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });
    expect(hasColumn(where.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasValue(where.mock.calls[0]?.[0], ID)).toBe(true);

    vi.resetAllMocks();
    mockFindFirst.mockResolvedValueOnce(row());
    mockSelect.mockReturnValueOnce(selectBuilder([]));
    const deleteWhere = vi.fn().mockResolvedValue([]);
    mockDelete.mockReturnValue({ where: deleteWhere });
    await service.removeNegotiationState(ID);
    expect(mockDelete).toHaveBeenCalledWith(negotiationStates);
    expect(hasColumn(deleteWhere.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasValue(deleteWhere.mock.calls[0]?.[0], ID)).toBe(true);
  });
});
