import type { CreateVisitRequest, ListVisitsQuery, UpdateVisitRequest } from '@bopacorp/shared/crm';
import { visits } from '@db/schema/crm.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockVisit = vi.fn();
const mockClient = vi.fn();
const mockEmployee = vi.fn();
const mockType = vi.fn();
const mockNegotiation = vi.fn();
const mockScopedAdvisors = vi.fn();
vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    query: {
      visits: { findFirst: mockVisit },
      businessClients: { findFirst: mockClient },
      employees: { findFirst: mockEmployee },
      visitTypes: { findFirst: mockType },
      negotiations: { findFirst: mockNegotiation },
    },
  },
}));
vi.mock('@shared/utils/scoping.js', () => ({ getSupervisedAdvisorIds: mockScopedAdvisors }));

const service = await import('./visits.service.js');
const ID = '11111111-1111-1111-1111-111111111111';
const ADVISOR = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';
const CLIENT = '44444444-4444-4444-4444-444444444444';
const TYPE = '55555555-5555-5555-5555-555555555555';
const NEGOTIATION = '66666666-6666-6666-6666-666666666666';
const NOW = new Date('2026-08-13T12:00:00.000Z');

function hasValue(expression: unknown, expected: unknown, seen = new WeakSet<object>()): boolean {
  if (expression === expected) return true;
  if (expression instanceof Date && expected instanceof Date) {
    return expression.getTime() === expected.getTime();
  }
  if (!expression || typeof expression !== 'object' || seen.has(expression)) return false;
  seen.add(expression);
  const item = expression as { value?: unknown; queryChunks?: unknown[] };
  if (item.value === expected || (Array.isArray(item.value) && item.value.includes(expected)))
    return true;
  return (
    item.queryChunks?.some((chunk) => hasValue(chunk, expected, seen)) === true ||
    Object.values(item).some((value) =>
      Array.isArray(value)
        ? value.some((child) => hasValue(child, expected, seen))
        : hasValue(value, expected, seen)
    )
  );
}

function hasColumn(expression: unknown, expected: string, seen = new WeakSet<object>()): boolean {
  if (!expression || typeof expression !== 'object' || seen.has(expression)) return false;
  seen.add(expression);
  const item = expression as { name?: unknown };
  return (
    item.name === expected ||
    Object.values(item).some((value) =>
      Array.isArray(value)
        ? value.some((child) => hasColumn(child, expected, seen))
        : hasColumn(value, expected, seen)
    )
  );
}

function selectBuilder(result: unknown) {
  const builder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

function visit(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    visitDate: new Date('2026-02-03T04:05:06.000Z'),
    observations: 'On-site',
    isVerified: false,
    supervisorComment: null,
    gpsLatitude: '1.2345',
    gpsLongitude: '-79.1234',
    gpsAccuracy: '3.5',
    gpsTimestamp: new Date('2026-02-03T04:00:00.000Z'),
    client: { id: CLIENT, businessName: 'Acme', contactName: 'Ana' },
    advisor: {
      userId: ADVISOR,
      user: {
        username: 'advisor',
        email: 'a@test.dev',
        profile: { firstName: 'Ada', lastName: 'Visor' },
      },
    },
    visitType: { id: TYPE, name: 'On-site' },
    verifiedBy: { id: OTHER, username: 'supervisor' },
    negotiation: { id: NEGOTIATION, client: { id: CLIENT, businessName: 'Acme' } },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    visitDate: NOW,
    isVerified: false,
    createdAt: NOW,
    updatedAt: NOW,
    client: { id: CLIENT, businessName: 'Acme' },
    advisorId: ADVISOR,
    advisorUsername: 'advisor',
    advisorFirstName: 'Ada',
    advisorLastName: 'Visor',
    visitType: { id: TYPE, code: 'ON_SITE', name: 'On-site' },
    ...overrides,
  };
}

function updateBuilder() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn(() => ({ where }));
  mockUpdate.mockReturnValueOnce({ set });
  return { set, where };
}

describe('visits service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('scopes advisers, supervisors, and privileged users; filters and maps nullable profiles', async () => {
    mockCount.mockResolvedValueOnce(3).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const adviserRows = selectBuilder([listRow({ advisorFirstName: null, advisorLastName: null })]);
    const supervisorRows = selectBuilder([]);
    const privilegedRows = selectBuilder([listRow()]);
    mockSelect
      .mockReturnValueOnce(adviserRows)
      .mockReturnValueOnce(supervisorRows)
      .mockReturnValueOnce(privilegedRows);
    const query: ListVisitsQuery = {
      page: 2,
      limit: 2,
      isVerified: false,
      clientId: CLIENT,
      visitTypeId: TYPE,
      dateFrom: '2026-02-01',
      dateTo: '2026-02-03',
      search: 'site',
      advisorId: OTHER,
      sortBy: 'visitDate',
      sortOrder: 'desc',
    };
    const result = await service.listVisits(query, {
      id: ADVISOR,
      roles: ['advisor'],
    } as NonNullable<Express.Request['user']>);
    expect(result).toEqual(
      expect.objectContaining({
        data: [expect.objectContaining({ advisor: expect.objectContaining({ profile: null }) })],
        meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
      })
    );
    const adviserWhere = adviserRows.where.mock.calls[0]?.[0];
    expect(mockCount).toHaveBeenCalledWith(visits, adviserWhere);
    for (const value of [ADVISOR, CLIENT, TYPE, false, '%site%'])
      expect(hasValue(adviserWhere, value)).toBe(true);
    expect(hasValue(adviserWhere, OTHER)).toBe(false);
    expect(hasValue(adviserWhere, new Date('2026-02-01'))).toBe(true);
    const expectedEndOfDay = new Date(query.dateTo ?? '');
    expectedEndOfDay.setHours(23, 59, 59, 999);
    expect(hasValue(adviserWhere, expectedEndOfDay)).toBe(true);
    expect(hasColumn(adviserWhere, 'visit_date')).toBe(true);
    expect(adviserRows.limit).toHaveBeenCalledWith(2);
    expect(adviserRows.offset).toHaveBeenCalledWith(2);
    expect(hasColumn(adviserRows.orderBy.mock.calls[0]?.[0], 'visit_date')).toBe(true);

    mockScopedAdvisors.mockResolvedValue([ADVISOR, OTHER]);
    await service.listVisits({ page: 1, limit: 10, advisorId: OTHER }, {
      id: 'supervisor',
      roles: ['supervisor'],
    } as NonNullable<Express.Request['user']>);
    expect(mockScopedAdvisors).toHaveBeenCalledWith('supervisor');
    expect(hasValue(supervisorRows.where.mock.calls[0]?.[0], OTHER)).toBe(true);
    await service.listVisits(
      { page: 1, limit: 10, advisorId: OTHER, sortBy: 'createdAt', sortOrder: 'asc' },
      { id: 'admin', roles: ['admin'] } as NonNullable<Express.Request['user']>
    );
    expect(hasValue(privilegedRows.where.mock.calls[0]?.[0], OTHER)).toBe(true);
    expect(hasColumn(privilegedRows.orderBy.mock.calls[0]?.[0], 'created_at')).toBe(true);
  });

  it('characterizes the authorization risk: supervisors without advisers query all non-deleted visits', async () => {
    mockScopedAdvisors.mockResolvedValue([]);
    mockCount.mockResolvedValue(1);
    const rows = selectBuilder([listRow()]);
    mockSelect.mockReturnValue(rows);

    await service.listVisits({ page: 1, limit: 10 }, {
      id: 'supervisor',
      roles: ['supervisor'],
    } as NonNullable<Express.Request['user']>);

    const where = rows.where.mock.calls[0]?.[0];
    expect(mockScopedAdvisors).toHaveBeenCalledWith('supervisor');
    expect(mockCount).toHaveBeenCalledWith(visits, where);
    expect(hasColumn(where, 'deleted_at')).toBe(true);
    expect(hasValue(where, ADVISOR)).toBe(false);
    expect(hasValue(where, OTHER)).toBe(false);
  });

  it('returns empty pages and maps nullable detail values with decimal GPS fields', async () => {
    mockCount.mockResolvedValue(0);
    const empty = selectBuilder([]);
    mockSelect.mockReturnValue(empty);
    await expect(
      service.listVisits({ page: 1, limit: 10 }, { id: 'admin', roles: ['admin'] } as NonNullable<
        Express.Request['user']
      >)
    ).resolves.toEqual({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
    mockVisit.mockResolvedValueOnce(
      visit({
        advisor: { userId: ADVISOR, user: null },
        verifiedBy: null,
        negotiation: null,
        gpsLatitude: null,
        gpsLongitude: null,
        gpsAccuracy: null,
        gpsTimestamp: null,
      })
    );
    await expect(service.getVisitById(ID)).resolves.toEqual(
      expect.objectContaining({
        gpsLatitude: null,
        gpsLongitude: null,
        gpsAccuracy: null,
        gpsTimestamp: null,
        negotiation: null,
        verifiedBy: null,
        advisor: expect.objectContaining({ profile: null }),
      })
    );
    const where = mockVisit.mock.calls[0]?.[0]?.where;
    expect(hasColumn(where, 'id')).toBe(true);
    expect(hasColumn(where, 'deleted_at')).toBe(true);
    mockVisit.mockResolvedValueOnce(undefined);
    await expect(service.getVisitById(OTHER)).rejects.toThrow(NotFoundError);
  });

  it('validates create dependencies, converts date/GPS values, hydrates, and rejects failed insert', async () => {
    const gpsTimestamp = '2026-02-03T04:00:00.000Z';
    const data = {
      clientId: CLIENT,
      advisorId: ADVISOR,
      visitTypeId: TYPE,
      negotiationId: NEGOTIATION,
      visitDate: '2026-02-03T04:05:06.000Z',
      observations: 'On-site',
      gpsLatitude: 1.2,
      gpsLongitude: -79.4,
      gpsAccuracy: 3.5,
      gpsTimestamp,
    } as CreateVisitRequest;
    mockClient.mockResolvedValue({});
    mockEmployee.mockResolvedValue({});
    mockType.mockResolvedValue({});
    mockNegotiation.mockResolvedValue({});
    const values = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: ID }]) }));
    mockInsert.mockReturnValue({ values });
    mockVisit.mockResolvedValueOnce(visit());
    await expect(service.createVisit(data)).resolves.toEqual(
      expect.objectContaining({ id: ID, gpsLatitude: 1.2345 })
    );
    expect(mockInsert).toHaveBeenCalledWith(visits);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        visitDate: new Date(data.visitDate),
        negotiationId: NEGOTIATION,
        clientId: CLIENT,
        advisorId: ADVISOR,
        visitTypeId: TYPE,
        observations: 'On-site',
        gpsLatitude: '1.2',
        gpsLongitude: '-79.4',
        gpsAccuracy: '3.5',
        gpsTimestamp: new Date(gpsTimestamp),
      })
    );
    expect(hasColumn(mockClient.mock.calls[0]?.[0]?.where, 'deleted_at')).toBe(true);
    vi.resetAllMocks();
    mockClient.mockResolvedValue(undefined);
    await expect(service.createVisit(data)).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockClient.mockResolvedValue({});
    mockEmployee.mockResolvedValue(undefined);
    await expect(service.createVisit(data)).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockClient.mockResolvedValue({});
    mockEmployee.mockResolvedValue({});
    mockType.mockResolvedValue(undefined);
    await expect(service.createVisit(data)).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockClient.mockResolvedValue({});
    mockEmployee.mockResolvedValue({});
    mockType.mockResolvedValue({});
    mockNegotiation.mockResolvedValue(undefined);
    await expect(service.createVisit(data)).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockClient.mockResolvedValue({});
    mockEmployee.mockResolvedValue({});
    mockType.mockResolvedValue({});
    mockNegotiation.mockResolvedValue({});
    mockInsert.mockReturnValue({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    });
    await expect(service.createVisit(data)).rejects.toThrow('Failed to create visit');
  });

  it('validates update dependencies, converts nullable values, writes by id, and retains no-op source behavior', async () => {
    mockVisit.mockResolvedValueOnce(undefined);
    await expect(
      service.updateVisit(ID, { observations: 'x' } as UpdateVisitRequest)
    ).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockVisit.mockResolvedValueOnce(visit());
    mockClient.mockResolvedValue(undefined);
    await expect(
      service.updateVisit(ID, { clientId: CLIENT } as UpdateVisitRequest)
    ).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockVisit.mockResolvedValueOnce(visit());
    mockEmployee.mockResolvedValue(undefined);
    await expect(
      service.updateVisit(ID, { advisorId: ADVISOR } as UpdateVisitRequest)
    ).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockVisit.mockResolvedValueOnce(visit());
    mockType.mockResolvedValue(undefined);
    await expect(
      service.updateVisit(ID, { visitTypeId: TYPE } as UpdateVisitRequest)
    ).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockVisit.mockResolvedValueOnce(visit());
    mockNegotiation.mockResolvedValue(undefined);
    await expect(
      service.updateVisit(ID, { negotiationId: NEGOTIATION } as UpdateVisitRequest)
    ).rejects.toThrow(NotFoundError);
    vi.resetAllMocks();
    mockVisit.mockResolvedValueOnce(visit());
    mockClient.mockResolvedValue({});
    mockEmployee.mockResolvedValue({});
    mockType.mockResolvedValue({});
    const write = updateBuilder();
    mockVisit.mockResolvedValueOnce(visit());
    const updated = await service.updateVisit(ID, {
      clientId: CLIENT,
      advisorId: ADVISOR,
      visitTypeId: TYPE,
      negotiationId: null,
      visitDate: '2026-03-01T00:00:00.000Z',
      gpsLatitude: null,
      gpsLongitude: 2,
      gpsAccuracy: null,
      gpsTimestamp: null,
    } as UpdateVisitRequest);
    expect(updated).toEqual(expect.objectContaining({ id: ID }));
    expect(write.set).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CLIENT,
        advisorId: ADVISOR,
        visitTypeId: TYPE,
        negotiationId: null,
        visitDate: new Date('2026-03-01T00:00:00.000Z'),
        gpsLatitude: undefined,
        gpsLongitude: '2',
        gpsAccuracy: undefined,
        gpsTimestamp: null,
        updatedAt: NOW,
      })
    );
    expect(hasColumn(write.where.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasValue(write.where.mock.calls[0]?.[0], ID)).toBe(true);
    vi.resetAllMocks();
    mockVisit.mockResolvedValueOnce(visit()).mockResolvedValueOnce(visit());
    await service.updateVisit(ID, {} as UpdateVisitRequest);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('soft deletes and verifies visits with deterministic writes then refreshes', async () => {
    mockVisit.mockResolvedValueOnce(visit());
    const remove = updateBuilder();
    await service.removeVisit(ID);
    expect(remove.set).toHaveBeenCalledWith({ deletedAt: NOW });
    expect(hasValue(remove.where.mock.calls[0]?.[0], ID)).toBe(true);
    vi.resetAllMocks();
    mockVisit.mockResolvedValueOnce(visit()).mockResolvedValueOnce(visit({ isVerified: true }));
    const verify = updateBuilder();
    await expect(
      service.verifyVisit(ID, OTHER, { isVerified: true, supervisorComment: 'Reviewed' })
    ).resolves.toEqual(expect.objectContaining({ isVerified: true }));
    expect(verify.set).toHaveBeenCalledWith({
      isVerified: true,
      verifiedBy: OTHER,
      supervisorComment: 'Reviewed',
      updatedAt: NOW,
    });
    expect(hasColumn(verify.where.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasValue(verify.where.mock.calls[0]?.[0], ID)).toBe(true);
  });
});
