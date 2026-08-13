import type {
  CreateBusinessClientRequest,
  ListBusinessClientsQuery,
  UpdateBusinessClientRequest,
} from '@bopacorp/shared/crm';
import { employees } from '@db/schema/core.js';
import { businessClients } from '@db/schema/crm.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockBusinessClientFindFirst = vi.fn();
const mockEmployeeFindFirst = vi.fn();
const mockGetSupervisedAdvisorIds = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    query: {
      businessClients: { findFirst: mockBusinessClientFindFirst },
      employees: { findFirst: mockEmployeeFindFirst },
    },
  },
}));
vi.mock('@shared/utils/scoping.js', () => ({
  getSupervisedAdvisorIds: mockGetSupervisedAdvisorIds,
}));

const service = await import('./business-clients.service.js');

const CLIENT_ID = '11111111-1111-1111-1111-111111111111';
const ADVISOR_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ADVISOR_ID = '33333333-3333-3333-3333-333333333333';
const NOW = new Date('2026-08-13T12:00:00.000Z');

function hasQueryValue(
  expression: unknown,
  expected: unknown,
  seen = new WeakSet<object>()
): boolean {
  if (expression === expected) return true;
  if (!expression || typeof expression !== 'object') return false;
  if (seen.has(expression)) return false;
  seen.add(expression);
  const candidate = expression as {
    value?: unknown;
    queryChunks?: unknown[];
    [key: string]: unknown;
  };
  if (candidate.value === expected) return true;
  if (Array.isArray(candidate.value) && candidate.value.includes(expected)) return true;
  return (
    Object.values(candidate).some((value) => {
      if (value === candidate.value || value === candidate.queryChunks) return false;
      return Array.isArray(value)
        ? value.some((item) => hasQueryValue(item, expected, seen))
        : hasQueryValue(value, expected, seen);
    }) || candidate.queryChunks?.some((chunk) => hasQueryValue(chunk, expected, seen)) === true
  );
}

function hasColumnName(expression: unknown, expected: string): boolean {
  if (!expression || typeof expression !== 'object') return false;
  const candidate = expression as { name?: unknown; queryChunks?: unknown[] };
  return (
    candidate.name === expected ||
    candidate.queryChunks?.some((chunk) => hasColumnName(chunk, expected)) === true
  );
}

function createSelectBuilder(result: unknown, paginated = false) {
  const builder = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  if (paginated) {
    builder.where.mockReturnValue(builder);
    builder.offset.mockReturnValue(builder);
    builder.orderBy.mockResolvedValue(result);
  } else {
    builder.where.mockResolvedValue(result);
  }
  return builder;
}

function setSelectResults(...entries: Array<{ result: unknown; paginated?: boolean }>) {
  return entries.map(({ result, paginated }) => {
    const builder = createSelectBuilder(result, paginated);
    mockSelect.mockReturnValueOnce(builder);
    return builder;
  });
}

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_ID,
    ruc: '0990000001001',
    businessName: 'Acme S.A.',
    contactName: 'Ana Client',
    contactPhone: '0999999999',
    contactEmail: 'ana@acme.test',
    address: 'Main street',
    activeServicesCount: 2,
    currentMonthlyBilling: '1200.50',
    isActive: true,
    advisorId: ADVISOR_ID,
    advisorUsername: 'advisor',
    advisorFirstName: 'Ada',
    advisorLastName: 'Visor',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-02-03T04:05:06.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    ...clientRow(),
    advisor: {
      userId: ADVISOR_ID,
      user: {
        username: 'advisor',
        email: 'advisor@test.dev',
        profile: { firstName: 'Ada', lastName: 'Visor' },
      },
    },
    ...overrides,
  };
}

function requestData(overrides: Record<string, unknown> = {}): CreateBusinessClientRequest {
  return {
    ruc: '0990000001001',
    businessName: 'Acme S.A.',
    contactName: 'Ana Client',
    contactPhone: '0999999999',
    contactEmail: 'ana@acme.test',
    address: 'Main street',
    activeServicesCount: 2,
    currentMonthlyBilling: 1200.5,
    isActive: true,
    ...overrides,
  } as CreateBusinessClientRequest;
}

describe('business clients service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
    mockUpdate.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) });
  });

  afterEach(() => vi.useRealTimers());

  it('lists an advisor scoped, active, searched, sorted page and maps advisor profile', async () => {
    mockCount.mockResolvedValue(3);
    const [rows] = setSelectResults({ result: [clientRow()], paginated: true });
    const query: ListBusinessClientsQuery = {
      page: 2,
      limit: 2,
      isActive: true,
      search: 'acme',
      sortBy: 'businessName',
      sortOrder: 'desc',
    };
    const result = await service.listBusinessClients(query, {
      id: ADVISOR_ID,
      roles: ['advisor'],
    } as NonNullable<Express.Request['user']>);
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: CLIENT_ID,
          advisor: {
            id: ADVISOR_ID,
            username: 'advisor',
            profile: { firstName: 'Ada', lastName: 'Visor' },
          },
        }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    const where = rows?.where.mock.calls[0]?.[0];
    const order = rows?.orderBy.mock.calls[0]?.[0];
    expect(mockCount).toHaveBeenCalledWith(businessClients, where);
    expect(rows?.from).toHaveBeenCalledWith(businessClients);
    expect(hasColumnName(where, 'deleted_at')).toBe(true);
    expect(hasColumnName(where, 'is_active')).toBe(true);
    expect(hasColumnName(where, 'advisor_id')).toBe(true);
    expect(hasQueryValue(where, ADVISOR_ID)).toBe(true);
    expect(hasQueryValue(where, '%acme%')).toBe(true);
    expect(hasColumnName(order, 'business_name')).toBe(true);
    expect(hasQueryValue(order, ' desc')).toBe(true);
    expect(rows?.limit).toHaveBeenCalledWith(2);
    expect(rows?.offset).toHaveBeenCalledWith(2);
  });

  it('narrows supervisor clients to the requested supervised advisor', async () => {
    mockGetSupervisedAdvisorIds.mockResolvedValue([ADVISOR_ID, OTHER_ADVISOR_ID]);
    mockCount.mockResolvedValue(0);
    const [rows] = setSelectResults({ result: [], paginated: true });
    await expect(
      service.listBusinessClients(
        { page: 1, limit: 10, advisorId: OTHER_ADVISOR_ID, sortOrder: 'asc' },
        { id: '44444444-4444-4444-4444-444444444444', roles: ['supervisor'] } as NonNullable<
          Express.Request['user']
        >
      )
    ).resolves.toEqual({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
    expect(mockGetSupervisedAdvisorIds).toHaveBeenCalledWith(
      '44444444-4444-4444-4444-444444444444'
    );
    expect(hasQueryValue(rows?.where.mock.calls[0]?.[0], OTHER_ADVISOR_ID)).toBe(true);
  });

  it('characterizes the authorization risk when a supervisor requests an outside advisor', async () => {
    mockGetSupervisedAdvisorIds.mockResolvedValue([ADVISOR_ID]);
    mockCount.mockResolvedValue(0);
    const [rows] = setSelectResults({ result: [], paginated: true });
    await service.listBusinessClients(
      { page: 1, limit: 10, advisorId: OTHER_ADVISOR_ID, sortOrder: 'asc' },
      { id: '44444444-4444-4444-4444-444444444444', roles: ['supervisor'] } as NonNullable<
        Express.Request['user']
      >
    );
    const where = rows?.where.mock.calls[0]?.[0];
    expect(hasColumnName(where, 'advisor_id')).toBe(false);
    expect(hasQueryValue(where, OTHER_ADVISOR_ID)).toBe(false);
  });

  it('lets privileged users filter by requested advisor and maps missing advisor profile as null', async () => {
    mockCount.mockResolvedValue(1);
    const [rows] = setSelectResults({
      result: [clientRow({ advisorFirstName: null, advisorLastName: null })],
      paginated: true,
    });
    const result = await service.listBusinessClients(
      { page: 1, limit: 20, advisorId: OTHER_ADVISOR_ID, sortOrder: 'asc' },
      { id: '55555555-5555-5555-5555-555555555555', roles: ['admin'] } as NonNullable<
        Express.Request['user']
      >
    );
    expect(result.data[0]?.advisor).toEqual({ id: ADVISOR_ID, username: 'advisor', profile: null });
    expect(hasQueryValue(rows?.where.mock.calls[0]?.[0], OTHER_ADVISOR_ID)).toBe(true);
  });

  it('maps detail money and nullable relationships and rejects missing details', async () => {
    mockBusinessClientFindFirst.mockResolvedValueOnce(
      detailRow({ currentMonthlyBilling: '10.25', advisor: null })
    );
    await expect(service.getBusinessClientById(CLIENT_ID)).resolves.toEqual(
      expect.objectContaining({ currentMonthlyBilling: 10.25, advisor: null })
    );
    mockBusinessClientFindFirst.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    await expect(service.getBusinessClientById(CLIENT_ID)).rejects.toThrow(NotFoundError);
    await expect(
      service.getBusinessClientById('66666666-6666-6666-6666-666666666666')
    ).rejects.toThrow(NotFoundError);
    expect(mockBusinessClientFindFirst).toHaveBeenCalledTimes(3);
    const where = mockBusinessClientFindFirst.mock.calls[0]?.[0]?.where;
    expect(hasColumnName(where, 'id')).toBe(true);
    expect(hasColumnName(where, 'deleted_at')).toBe(true);
    expect(hasQueryValue(where, CLIENT_ID)).toBe(true);
  });

  it('rejects duplicate RUC before checking advisor or inserting', async () => {
    const [duplicate] = setSelectResults({ result: [clientRow()] });
    await expect(service.createBusinessClient(requestData(), ADVISOR_ID)).rejects.toThrow(
      ConflictError
    );
    const where = duplicate?.where.mock.calls[0]?.[0];
    expect(duplicate?.from).toHaveBeenCalledWith(businessClients);
    expect(hasColumnName(where, 'ruc')).toBe(true);
    expect(hasColumnName(where, 'deleted_at')).toBe(true);
    expect(hasQueryValue(where, '0990000001001')).toBe(true);
    expect(mockEmployeeFindFirst).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('uses the current employee as implicit advisor, serializes billing, and returns hydrated data', async () => {
    setSelectResults({ result: [] });
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ userId: ADVISOR_ID })
      .mockResolvedValueOnce({ userId: ADVISOR_ID });
    const values = vi
      .fn()
      .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: CLIENT_ID }]) });
    mockInsert.mockReturnValue({ values });
    mockBusinessClientFindFirst.mockResolvedValue(detailRow());
    await expect(service.createBusinessClient(requestData(), ADVISOR_ID)).resolves.toEqual(
      expect.objectContaining({ id: CLIENT_ID })
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ advisorId: ADVISOR_ID, currentMonthlyBilling: '1200.5' })
    );
    expect(mockInsert).toHaveBeenCalledWith(businessClients);
  });

  it('permits no advisor for a non-employee, validates explicit advisors, and handles failed insert', async () => {
    setSelectResults({ result: [] });
    mockEmployeeFindFirst.mockResolvedValueOnce(undefined);
    const values = vi
      .fn()
      .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: CLIENT_ID }]) });
    mockInsert.mockReturnValue({ values });
    mockBusinessClientFindFirst.mockResolvedValue(detailRow({ advisor: null }));
    await service.createBusinessClient(requestData(), '77777777-7777-7777-7777-777777777777');
    expect(values).toHaveBeenCalledWith({
      advisorId: undefined,
      ruc: '0990000001001',
      businessName: 'Acme S.A.',
      contactName: 'Ana Client',
      contactPhone: '0999999999',
      contactEmail: 'ana@acme.test',
      address: 'Main street',
      activeServicesCount: 2,
      currentMonthlyBilling: '1200.5',
      isActive: true,
    });

    vi.resetAllMocks();
    setSelectResults({ result: [] });
    mockEmployeeFindFirst.mockResolvedValueOnce({ userId: OTHER_ADVISOR_ID });
    const explicitValues = vi
      .fn()
      .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: CLIENT_ID }]) });
    mockInsert.mockReturnValue({ values: explicitValues });
    mockBusinessClientFindFirst.mockResolvedValueOnce(detailRow());
    await service.createBusinessClient(requestData({ advisorId: OTHER_ADVISOR_ID }), ADVISOR_ID);
    expect(explicitValues).toHaveBeenCalledWith(
      expect.objectContaining({ advisorId: OTHER_ADVISOR_ID })
    );
    const createAdvisorWhere = mockEmployeeFindFirst.mock.calls[0]?.[0]?.where;
    expect(hasQueryValue(createAdvisorWhere, employees.userId)).toBe(true);
    expect(hasColumnName(createAdvisorWhere, 'user_id')).toBe(true);
    expect(hasQueryValue(createAdvisorWhere, OTHER_ADVISOR_ID)).toBe(true);

    vi.resetAllMocks();
    setSelectResults({ result: [] });
    mockEmployeeFindFirst.mockResolvedValueOnce(undefined);
    await expect(
      service.createBusinessClient(requestData({ advisorId: OTHER_ADVISOR_ID }), ADVISOR_ID)
    ).rejects.toThrow(NotFoundError);

    vi.resetAllMocks();
    setSelectResults({ result: [] });
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ userId: ADVISOR_ID })
      .mockResolvedValueOnce({ userId: ADVISOR_ID });
    mockInsert.mockReturnValue({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    });
    await expect(service.createBusinessClient(requestData(), ADVISOR_ID)).rejects.toThrow(
      'Failed to create business client'
    );
  });

  it('updates mutable fields, clears advisor, serializes billing and stamps the update', async () => {
    mockBusinessClientFindFirst
      .mockResolvedValueOnce(detailRow())
      .mockResolvedValueOnce(detailRow({ advisor: null }));
    const where = vi.fn().mockResolvedValue([]);
    const set = vi.fn(() => ({ where }));
    mockUpdate.mockReturnValue({ set });
    const data: UpdateBusinessClientRequest = {
      advisorId: null,
      businessName: 'Updated',
      currentMonthlyBilling: 4.75,
      isActive: false,
    } as UpdateBusinessClientRequest;
    await service.updateBusinessClient(CLIENT_ID, data);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        advisorId: null,
        businessName: 'Updated',
        currentMonthlyBilling: '4.75',
        isActive: false,
        updatedAt: NOW,
      })
    );
    expect(hasColumnName(where.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasQueryValue(where.mock.calls[0]?.[0], CLIENT_ID)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(businessClients);
  });

  it('rejects missing client, conflicting RUC, and an invalid advisor during update', async () => {
    mockBusinessClientFindFirst.mockResolvedValueOnce(undefined);
    await expect(
      service.updateBusinessClient(CLIENT_ID, {
        businessName: 'Updated',
      } as UpdateBusinessClientRequest)
    ).rejects.toThrow(NotFoundError);

    mockBusinessClientFindFirst.mockResolvedValueOnce(detailRow());
    const [duplicate] = setSelectResults({ result: [clientRow({ id: OTHER_ADVISOR_ID })] });
    await expect(
      service.updateBusinessClient(CLIENT_ID, {
        ruc: '0990000001002',
      } as UpdateBusinessClientRequest)
    ).rejects.toThrow(ConflictError);
    const duplicateWhere = duplicate?.where.mock.calls[0]?.[0];
    expect(duplicate?.from).toHaveBeenCalledWith(businessClients);
    expect(hasColumnName(duplicateWhere, 'ruc')).toBe(true);
    expect(hasColumnName(duplicateWhere, 'deleted_at')).toBe(true);
    expect(hasQueryValue(duplicateWhere, '0990000001002')).toBe(true);

    mockBusinessClientFindFirst.mockResolvedValueOnce(detailRow());
    mockEmployeeFindFirst.mockResolvedValueOnce(undefined);
    await expect(
      service.updateBusinessClient(CLIENT_ID, {
        advisorId: OTHER_ADVISOR_ID,
      } as UpdateBusinessClientRequest)
    ).rejects.toThrow(NotFoundError);

    vi.resetAllMocks();
    mockBusinessClientFindFirst
      .mockResolvedValueOnce(detailRow())
      .mockResolvedValueOnce(detailRow({ advisor: { userId: OTHER_ADVISOR_ID } }));
    mockEmployeeFindFirst.mockResolvedValueOnce({ userId: OTHER_ADVISOR_ID });
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    mockUpdate.mockReturnValue({ set });
    await service.updateBusinessClient(CLIENT_ID, {
      advisorId: OTHER_ADVISOR_ID,
    } as UpdateBusinessClientRequest);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ advisorId: OTHER_ADVISOR_ID }));
    const updateAdvisorWhere = mockEmployeeFindFirst.mock.calls[0]?.[0]?.where;
    expect(hasQueryValue(updateAdvisorWhere, employees.userId)).toBe(true);
    expect(hasColumnName(updateAdvisorWhere, 'user_id')).toBe(true);
    expect(hasQueryValue(updateAdvisorWhere, OTHER_ADVISOR_ID)).toBe(true);
  });

  it('allows an unchanged RUC while updating the same client', async () => {
    mockBusinessClientFindFirst
      .mockResolvedValueOnce(detailRow())
      .mockResolvedValueOnce(detailRow());
    setSelectResults({ result: [clientRow({ id: CLIENT_ID })] });
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    mockUpdate.mockReturnValue({ set });
    await expect(
      service.updateBusinessClient(CLIENT_ID, {
        ruc: '0990000001001',
      } as UpdateBusinessClientRequest)
    ).resolves.toEqual(expect.objectContaining({ id: CLIENT_ID }));
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ ruc: '0990000001001' }));
  });

  it('returns hydrated detail without writing for an empty update and soft deletes existing clients', async () => {
    mockBusinessClientFindFirst
      .mockResolvedValueOnce(detailRow())
      .mockResolvedValueOnce(detailRow());
    await service.updateBusinessClient(CLIENT_ID, {} as UpdateBusinessClientRequest);
    expect(mockUpdate).not.toHaveBeenCalled();

    mockBusinessClientFindFirst.mockResolvedValueOnce(detailRow());
    const where = vi.fn().mockResolvedValue([]);
    const set = vi.fn(() => ({ where }));
    mockUpdate.mockReturnValue({ set });
    await service.removeBusinessClient(CLIENT_ID);
    expect(set).toHaveBeenCalledWith({ deletedAt: NOW });
    expect(hasColumnName(where.mock.calls[0]?.[0], 'id')).toBe(true);
    expect(hasQueryValue(where.mock.calls[0]?.[0], CLIENT_ID)).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(businessClients);
  });
});
