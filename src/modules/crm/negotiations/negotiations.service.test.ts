import { BadRequestError, ConflictError, ForbiddenError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockFindNegotiation = vi.fn();
const mockFindClient = vi.fn();
const mockFindEmployee = vi.fn();
const mockFindState = vi.fn();
const mockFindHistory = vi.fn();
const mockScopedAdvisors = vi.fn();
const mockUpload = vi.fn();
const mockDeleteFile = vi.fn();
const mockNotification = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    transaction: mockTransaction,
    query: {
      negotiations: { findFirst: mockFindNegotiation },
      businessClients: { findFirst: mockFindClient },
      employees: { findFirst: mockFindEmployee },
      negotiationStates: { findFirst: mockFindState },
      negotiationStateHistory: { findMany: mockFindHistory },
    },
  },
}));
vi.mock('@config/env.js', () => ({ env: { DOCUMENTS_STORAGE_BUCKET: 'documents' } }));
vi.mock('@lib/storage.js', () => ({ deleteFile: mockDeleteFile }));
vi.mock('@modules/document-uploads/document-uploads.service.js', () => ({
  uploadEncryptedDocument: mockUpload,
}));
vi.mock('@modules/notifications/notifications.service.js', () => ({
  createNotification: mockNotification,
}));
vi.mock('@shared/utils/scoping.js', () => ({ getSupervisedAdvisorIds: mockScopedAdvisors }));

const ID = '11111111-1111-1111-1111-111111111111';
const ADVISOR = '22222222-2222-2222-2222-222222222222';
const OTHER_ADVISOR = '33333333-3333-3333-3333-333333333333';
const STATE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STATE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TYPE = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
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

function selectBuilder(result: unknown, paginated = false) {
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
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  if (paginated) {
    builder.where.mockReturnValue(builder);
    builder.orderBy.mockResolvedValue(result);
  } else {
    builder.where.mockResolvedValue(result);
  }
  return builder;
}

function selects(...results: Array<{ result: unknown; paginated?: boolean }>) {
  return results.map(({ result, paginated }) => {
    const builder = selectBuilder(result, paginated);
    mockSelect.mockReturnValueOnce(builder);
    return builder;
  });
}

function limitedSelect(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockResolvedValue(result);
  mockSelect.mockReturnValueOnce(builder);
  return builder;
}

function insertBuilder(result: unknown = []) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn(() => ({ returning }));
  mockInsert.mockReturnValueOnce({ values });
  return { values, returning };
}

function negotiation(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    startDate: '2026-01-01',
    estimatedCloseDate: null,
    observations: 'Follow up',
    isActive: true,
    client: { id: 'client', businessName: 'Acme', contactName: 'Ana' },
    advisor: {
      userId: ADVISOR,
      user: {
        username: 'advisor',
        email: 'a@test.dev',
        profile: { firstName: 'Ada', lastName: 'Visor' },
      },
    },
    state: { id: STATE_A, code: 'prospecting', name: 'Prospecting' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    startDate: '2026-01-01',
    estimatedCloseDate: null,
    isActive: true,
    client: { id: 'client', businessName: 'Acme' },
    advisorId: ADVISOR,
    advisorUsername: 'advisor',
    advisorFirstName: 'Ada',
    advisorLastName: 'Visor',
    state: { id: STATE_A, code: 'prospecting', name: 'Prospecting' },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function updateBuilder() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn(() => ({ where }));
  mockUpdate.mockReturnValueOnce({ set });
  return { set, where };
}

const service = await import('./negotiations.service.js');

describe('negotiations service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('lists a scoped adviser page and maps related fields', async () => {
    const [count, rows] = selects(
      { result: [{ count: 3 }] },
      { result: [listRow()], paginated: true }
    );
    const result = await service.listNegotiations(
      { page: 2, limit: 2, isActive: true, search: 'Acme', sortBy: 'startDate', sortOrder: 'asc' },
      { id: ADVISOR, roles: ['advisor'] } as NonNullable<Express.Request['user']>
    );
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: ID,
          advisor: {
            id: ADVISOR,
            username: 'advisor',
            profile: { firstName: 'Ada', lastName: 'Visor' },
          },
        }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(result.data[0]).toMatchObject({
      createdAt: '2026-08-13T12:00:00.000Z',
      updatedAt: '2026-08-13T12:00:00.000Z',
    });
    expect(count.from).toHaveBeenCalled();
    expect(hasQueryValue(count.where.mock.calls[0]?.[0], ADVISOR)).toBe(true);
    expect(hasQueryValue(count.where.mock.calls[0]?.[0], '%Acme%')).toBe(true);
    expect(hasQueryValue(count.where.mock.calls[0]?.[0], true)).toBe(true);
    expect(hasQueryValue(rows.where.mock.calls[0]?.[0], ADVISOR)).toBe(true);
    expect(rows.limit).toHaveBeenCalledWith(2);
    expect(rows.offset).toHaveBeenCalledWith(2);
  });

  it('uses supervisor IDs and privileged advisor/tier filters', async () => {
    mockScopedAdvisors.mockResolvedValue([ADVISOR, OTHER_ADVISOR]);
    selects({ result: [{ count: 0 }] }, { result: [], paginated: true });
    await service.listNegotiations({ page: 1, limit: 10, advisorId: ADVISOR }, {
      id: 'supervisor',
      roles: ['supervisor'],
    } as NonNullable<Express.Request['user']>);
    expect(mockScopedAdvisors).toHaveBeenCalledWith('supervisor');
    expect(hasQueryValue(mockSelect.mock.results[0]?.value.where.mock.calls[0]?.[0], ADVISOR)).toBe(
      true
    );
    expect(hasQueryValue(mockSelect.mock.results[1]?.value.where.mock.calls[0]?.[0], ADVISOR)).toBe(
      true
    );
    limitedSelect([{ minBilling: '100', maxBilling: '500' }]);
    selects({ result: [{ count: 0 }] }, { result: [], paginated: true });
    await service.listNegotiations(
      {
        page: 1,
        limit: 10,
        advisorId: OTHER_ADVISOR,
        tierCode: 'T1',
        clientId: 'client',
        stateId: STATE_A,
      },
      { id: 'admin', roles: ['admin'] } as NonNullable<Express.Request['user']>
    );
    expect(mockSelect).toHaveBeenCalledTimes(5);
    expect(
      hasQueryValue(mockSelect.mock.results[3]?.value.where.mock.calls[0]?.[0], OTHER_ADVISOR)
    ).toBe(true);
    expect(
      hasQueryValue(mockSelect.mock.results[4]?.value.where.mock.calls[0]?.[0], OTHER_ADVISOR)
    ).toBe(true);
    expect(mockScopedAdvisors).toHaveBeenCalledTimes(1);
  });

  it('maps nullable advisor profiles and forces an empty result for an unknown tier', async () => {
    const [, nullableRows] = selects(
      { result: [{ count: 1 }] },
      { result: [listRow({ advisorFirstName: null, advisorLastName: null })], paginated: true }
    );
    const nullableResult = await service.listNegotiations({ page: 1, limit: 10 }, {
      id: 'admin',
      roles: ['admin'],
    } as NonNullable<Express.Request['user']>);
    expect(nullableResult.data[0]?.advisor.profile).toBeNull();
    expect(nullableRows.where).toHaveBeenCalled();
    limitedSelect([]);
    const [count] = selects({ result: [{ count: 0 }] }, { result: [], paginated: true });
    await service.listNegotiations({ page: 1, limit: 10, tierCode: 'UNKNOWN' }, {
      id: 'admin',
      roles: ['admin'],
    } as NonNullable<Express.Request['user']>);
    expect(hasQueryValue(count.where.mock.calls[0]?.[0], 'false')).toBe(true);
  });

  it('characterizes the current unscoped supervisor behavior when no adviser IDs are assigned', async () => {
    mockScopedAdvisors.mockResolvedValue([]);
    const [count, rows] = selects({ result: [{ count: 0 }] }, { result: [], paginated: true });
    await service.listNegotiations({ page: 1, limit: 10 }, {
      id: 'supervisor',
      roles: ['supervisor'],
    } as NonNullable<Express.Request['user']>);
    expect(hasQueryValue(count.where.mock.calls[0]?.[0], 'supervisor')).toBe(false);
    expect(hasQueryValue(rows.where.mock.calls[0]?.[0], 'supervisor')).toBe(false);
  });

  it('keeps privileged list queries unscoped when advisorId is absent', async () => {
    const [count, rows] = selects({ result: [{ count: 0 }] }, { result: [], paginated: true });
    await service.listNegotiations({ page: 1, limit: 10 }, {
      id: 'admin',
      roles: ['admin'],
    } as NonNullable<Express.Request['user']>);
    expect(hasQueryValue(count.where.mock.calls[0]?.[0], 'admin')).toBe(false);
    expect(hasQueryValue(rows.where.mock.calls[0]?.[0], 'admin')).toBe(false);
  });

  it('returns a detail projection and rejects a missing negotiation', async () => {
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    const detail = await service.getNegotiationById(ID);
    expect(detail).toEqual(
      expect.objectContaining({ id: ID, client: expect.objectContaining({ businessName: 'Acme' }) })
    );
    expect(detail).toMatchObject({
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    mockFindNegotiation.mockResolvedValueOnce(undefined);
    await expect(service.getNegotiationById(ID)).rejects.toMatchObject({
      name: 'NotFoundError',
      message: `Negotiation with id '${ID}' not found`,
    });
  });

  it('creates after dependencies using default state, history, and matrix', async () => {
    mockFindClient.mockResolvedValue({ id: 'client' });
    mockFindEmployee.mockResolvedValue({ userId: ADVISOR });
    limitedSelect([{ id: STATE_A }]);
    const created = insertBuilder([{ id: ID }]);
    const history = insertBuilder();
    const matrix = insertBuilder();
    mockFindNegotiation.mockResolvedValue(negotiation());
    const result = await service.createNegotiation('creator', {
      clientId: 'client',
      advisorId: ADVISOR,
      observations: 'Note',
      isActive: true,
    } as never);
    expect(created.values).toHaveBeenCalledWith(
      expect.objectContaining({ stateId: STATE_A, startDate: '2026-08-13' })
    );
    expect(history.values).toHaveBeenCalledWith(
      expect.objectContaining({
        negotiationId: ID,
        newStateId: STATE_A,
        changedBy: 'creator',
        notes: 'Initial state',
      })
    );
    expect(matrix.values).toHaveBeenCalledWith({ negotiationId: ID, creatorId: 'creator' });
    expect(result.id).toBe(ID);
  });

  it('rejects missing creation dependencies and absent default state', async () => {
    mockFindClient.mockResolvedValueOnce(undefined);
    await expect(
      service.createNegotiation('creator', { clientId: 'client', advisorId: ADVISOR } as never)
    ).rejects.toMatchObject({ message: "Business client with id 'client' not found" });
    mockFindClient.mockResolvedValueOnce({ id: 'client' });
    mockFindEmployee.mockResolvedValueOnce(undefined);
    await expect(
      service.createNegotiation('creator', { clientId: 'client', advisorId: ADVISOR } as never)
    ).rejects.toMatchObject({ message: `Advisor with id '${ADVISOR}' not found` });
    mockFindClient.mockResolvedValueOnce({ id: 'client' });
    mockFindEmployee.mockResolvedValueOnce({ userId: ADVISOR });
    limitedSelect([]);
    await expect(
      service.createNegotiation('creator', { clientId: 'client', advisorId: ADVISOR } as never)
    ).rejects.toMatchObject({ message: "Negotiation state with id 'default' not found" });
  });

  it('uses an explicit state and rejects an unknown explicit state', async () => {
    mockFindClient.mockResolvedValue({ id: 'client' });
    mockFindEmployee.mockResolvedValue({ userId: ADVISOR });
    mockFindState.mockResolvedValueOnce({ id: STATE_B });
    const created = insertBuilder([{ id: ID }]);
    insertBuilder();
    insertBuilder();
    mockFindNegotiation.mockResolvedValueOnce(
      negotiation({ state: { id: STATE_B, code: 'qualified', name: 'Qualified' } })
    );
    await service.createNegotiation('creator', {
      clientId: 'client',
      advisorId: ADVISOR,
      stateId: STATE_B,
    } as never);
    expect(created.values).toHaveBeenCalledWith(expect.objectContaining({ stateId: STATE_B }));
    mockFindClient.mockResolvedValueOnce({ id: 'client' });
    mockFindEmployee.mockResolvedValueOnce({ userId: ADVISOR });
    mockFindState.mockResolvedValueOnce(undefined);
    await expect(
      service.createNegotiation('creator', {
        clientId: 'client',
        advisorId: ADVISOR,
        stateId: STATE_B,
      } as never)
    ).rejects.toMatchObject({ message: `Negotiation state with id '${STATE_B}' not found` });
  });

  it('validates update dependencies, writes nullable fields, and soft deletes', async () => {
    mockFindNegotiation
      .mockResolvedValueOnce(negotiation())
      .mockResolvedValueOnce(negotiation({ estimatedCloseDate: null }));
    mockFindClient.mockResolvedValue({ id: 'new-client' });
    mockFindEmployee.mockResolvedValue({ userId: OTHER_ADVISOR });
    mockFindState.mockResolvedValue({ id: STATE_B });
    const update = updateBuilder();
    await service.updateNegotiation(ID, {
      clientId: 'new-client',
      advisorId: OTHER_ADVISOR,
      stateId: STATE_B,
      estimatedCloseDate: null,
      observations: 'Updated',
    } as never);
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'new-client',
        advisorId: OTHER_ADVISOR,
        stateId: STATE_B,
        estimatedCloseDate: null,
      })
    );
    expect(hasQueryValue(update.where.mock.calls[0]?.[0], ID)).toBe(true);
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    const remove = updateBuilder();
    await service.removeNegotiation(ID);
    expect(remove.set).toHaveBeenCalledWith({ deletedAt: NOW });
    expect(hasQueryValue(remove.where.mock.calls[0]?.[0], ID)).toBe(true);
  });

  it('rejects missing update dependencies and does not write for an empty update', async () => {
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindClient.mockResolvedValueOnce(undefined);
    await expect(
      service.updateNegotiation(ID, { clientId: 'missing' } as never)
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: "Business client with id 'missing' not found",
    });
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindEmployee.mockResolvedValueOnce(undefined);
    await expect(
      service.updateNegotiation(ID, { advisorId: OTHER_ADVISOR } as never)
    ).rejects.toMatchObject({ message: `Advisor with id '${OTHER_ADVISOR}' not found` });
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce(undefined);
    await expect(
      service.updateNegotiation(ID, { stateId: STATE_B } as never)
    ).rejects.toMatchObject({
      message: `Negotiation state with id '${STATE_B}' not found`,
    });
    mockFindNegotiation.mockResolvedValueOnce(negotiation()).mockResolvedValueOnce(negotiation());
    await service.updateNegotiation(ID, {} as never);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('changes state, maps history, and keeps same-state changes as no-op', async () => {
    mockFindNegotiation
      .mockResolvedValueOnce(negotiation())
      .mockResolvedValueOnce(
        negotiation({ state: { id: STATE_B, code: 'qualified', name: 'Qualified' } })
      );
    mockFindState.mockResolvedValueOnce({ id: STATE_B });
    const update = updateBuilder();
    const history = insertBuilder();
    await service.changeNegotiationState(ID, ADVISOR, {
      stateId: STATE_B,
      notes: 'ready',
    } as never);
    expect(update.set).toHaveBeenCalledWith(expect.objectContaining({ stateId: STATE_B }));
    expect(history.values).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStateId: STATE_A,
        newStateId: STATE_B,
        changedBy: ADVISOR,
        notes: 'ready',
      })
    );
    expect(hasQueryValue(update.where.mock.calls[0]?.[0], ID)).toBe(true);
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce({ id: STATE_A });
    const updatesBeforeNoop = mockUpdate.mock.calls.length;
    const insertsBeforeNoop = mockInsert.mock.calls.length;
    await expect(
      service.changeNegotiationState(ID, ADVISOR, { stateId: STATE_A } as never)
    ).resolves.toMatchObject({ id: ID });
    expect(mockUpdate).toHaveBeenCalledTimes(updatesBeforeNoop);
    expect(mockInsert).toHaveBeenCalledTimes(insertsBeforeNoop);
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindHistory.mockResolvedValueOnce([
      {
        id: 'history',
        previousState: { id: STATE_A, code: 'prospecting', name: 'Prospecting' },
        newState: { id: STATE_B, code: 'qualified', name: 'Qualified' },
        changedBy: { id: ADVISOR, username: 'advisor' },
        notes: null,
        createdAt: NOW,
      },
    ]);
    await expect(service.getNegotiationHistory(ID)).resolves.toEqual([
      expect.objectContaining({
        previousState: { id: STATE_A, code: 'prospecting', name: 'Prospecting' },
        newState: expect.objectContaining({ id: STATE_B }),
        changedBy: { id: ADVISOR, username: 'advisor' },
        createdAt: '2026-08-13T12:00:00.000Z',
      }),
    ]);
  });

  it('rejects a missing target state with its exact entity and identifier', async () => {
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce(undefined);
    await expect(
      service.changeNegotiationState(ID, ADVISOR, { stateId: STATE_B } as never)
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: `Negotiation state with id '${STATE_B}' not found`,
    });
  });

  it('rejects close requests before storage for mismatches, ownership, conflicts, invalid types, and missing mandatory documents', async () => {
    await expect(
      service.closeWithDocuments(
        ID,
        { id: ADVISOR, roles: ['advisor'] } as never,
        [{}] as never,
        [],
        undefined
      )
    ).rejects.toThrow(BadRequestError);
    await expect(
      service.closeWithDocuments(ID, { id: ADVISOR, roles: ['advisor'] } as never, [] as never, [
        TYPE,
      ])
    ).rejects.toThrow('Each file must have a corresponding document type ID');
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    await expect(
      service.closeWithDocuments(
        ID,
        { id: OTHER_ADVISOR, roles: ['advisor'] } as never,
        [{}] as never,
        [TYPE]
      )
    ).rejects.toThrow(ForbiddenError);
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce({ id: STATE_A, code: 'closing' });
    await expect(
      service.closeWithDocuments(ID, { id: ADVISOR, roles: [] } as never, [{}] as never, [TYPE])
    ).rejects.toThrow(ConflictError);
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce({ id: STATE_B, code: 'closing' });
    selects({ result: [] });
    await expect(
      service.closeWithDocuments(ID, { id: ADVISOR, roles: [] } as never, [{}] as never, [TYPE])
    ).rejects.toThrow(BadRequestError);
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce({ id: STATE_B, code: 'closing' });
    selects(
      { result: [{ id: TYPE, code: 'T', name: 'Type' }] },
      { result: [{ id: 'mandatory', code: 'M', name: 'Mandatory' }] },
      { result: [] }
    );
    await expect(
      service.closeWithDocuments(ID, { id: ADVISOR, roles: [] } as never, [{}] as never, [TYPE])
    ).rejects.toThrow('Missing mandatory documents: Mandatory');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects closing when the closing state is not configured', async () => {
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce(undefined);
    await expect(
      service.closeWithDocuments(ID, { id: ADVISOR, roles: [] } as never, [{}] as never, [TYPE])
    ).rejects.toMatchObject({
      name: 'NotFoundError',
      message: "Negotiation state with id 'closing' not found",
    });
  });

  it('cleans successfully uploaded files when a subsequent upload fails', async () => {
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce({ id: STATE_B, code: 'closing' });
    selects({ result: [{ id: TYPE, code: 'T', name: 'Type' }] }, { result: [] }, { result: [] });
    mockUpload
      .mockResolvedValueOnce({
        storagePath: 'first',
        filename: 'a.pdf',
        fileExtension: 'pdf',
        fileSizeMb: 1,
        mimeType: 'application/pdf',
        encryptionMetadata: {},
      })
      .mockRejectedValueOnce(new Error('storage failed'));
    await expect(
      service.closeWithDocuments(ID, { id: ADVISOR, roles: [] } as never, [{}, {}] as never, [
        TYPE,
        TYPE,
      ])
    ).rejects.toThrow('storage failed');
    expect(mockDeleteFile).toHaveBeenCalledWith('first', 'documents');
  });

  it('writes closing documents transactionally, notifies coordinators, and rolls back uploads on transaction failure', async () => {
    const txInsert = vi.fn();
    const txUpdate = vi.fn();
    const lockFor = vi.fn().mockResolvedValue([]);
    const lockWhere = vi.fn(() => ({ for: lockFor }));
    const documentValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'doc' }]) }));
    const documentHistoryValues = vi.fn().mockResolvedValue([]);
    const stateHistoryValues = vi.fn().mockResolvedValue([]);
    const stateWhere = vi.fn().mockResolvedValue([]);
    const stateSet = vi.fn(() => ({ where: stateWhere }));
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: lockWhere })),
      })),
      insert: txInsert,
      update: txUpdate,
    };
    txInsert
      .mockReturnValueOnce({ values: documentValues })
      .mockReturnValueOnce({ values: documentHistoryValues })
      .mockReturnValueOnce({ values: stateHistoryValues });
    txUpdate.mockReturnValue({ set: stateSet });
    mockFindNegotiation
      .mockResolvedValueOnce(negotiation())
      .mockResolvedValueOnce(
        negotiation({ state: { id: STATE_B, code: 'closing', name: 'Closing' } })
      );
    mockFindState.mockResolvedValueOnce({ id: STATE_B, code: 'closing' });
    selects(
      { result: [{ id: TYPE, code: 'T', name: 'Type' }] },
      { result: [] },
      { result: [] },
      { result: [{ userId: 'coord' }] }
    );
    mockUpload.mockResolvedValueOnce({
      storagePath: 'path',
      filename: 'file.pdf',
      fileExtension: 'pdf',
      fileSizeMb: 1.2,
      mimeType: 'application/pdf',
      encryptionMetadata: { iv: 'x' },
    });
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    await expect(
      service.closeWithDocuments(
        ID,
        { id: ADVISOR, roles: [] } as never,
        [{}] as never,
        [TYPE],
        'closing'
      )
    ).resolves.toMatchObject({ id: ID });
    expect(txInsert).toHaveBeenCalledTimes(3);
    expect(lockFor).toHaveBeenCalledWith('update');
    expect(hasQueryValue(lockWhere.mock.calls[0]?.[0], ID)).toBe(true);
    expect(documentValues).toHaveBeenCalledWith({
      negotiationId: ID,
      documentTypeId: TYPE,
      uploadedBy: ADVISOR,
      filename: 'file.pdf',
      fileExtension: 'pdf',
      fileSizeMb: '1.2',
      storagePath: 'path',
      mimeType: 'application/pdf',
      encryptionMetadata: { iv: 'x' },
    });
    expect(documentHistoryValues).toHaveBeenCalledWith({
      documentId: 'doc',
      newState: 'PENDING_APPROVAL',
      changedBy: ADVISOR,
      notes: 'Document uploaded',
    });
    expect(stateSet).toHaveBeenCalledWith({ stateId: STATE_B, updatedAt: NOW });
    expect(hasQueryValue(stateWhere.mock.calls[0]?.[0], ID)).toBe(true);
    expect(stateHistoryValues).toHaveBeenCalledWith({
      negotiationId: ID,
      previousStateId: STATE_A,
      newStateId: STATE_B,
      changedBy: ADVISOR,
      notes: 'closing',
    });
    expect(mockNotification).toHaveBeenCalledWith({
      recipientId: 'coord',
      title: 'Documentos por revisar',
      message: 'Acme - 1 documento(s)',
      referenceType: 'negotiation',
      referenceId: ID,
    });
    mockFindNegotiation.mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce({ id: STATE_B, code: 'closing' });
    selects({ result: [{ id: TYPE, code: 'T', name: 'Type' }] }, { result: [] }, { result: [] });
    mockUpload.mockResolvedValueOnce({
      storagePath: 'rollback',
      filename: 'file.pdf',
      fileExtension: 'pdf',
      fileSizeMb: 1,
      mimeType: 'application/pdf',
      encryptionMetadata: {},
    });
    mockTransaction.mockRejectedValueOnce(new Error('transaction failed'));
    await expect(
      service.closeWithDocuments(ID, { id: ADVISOR, roles: [] } as never, [{}] as never, [TYPE])
    ).rejects.toThrow('transaction failed');
    expect(mockDeleteFile).toHaveBeenCalledWith('rollback', 'documents');
  });

  it('characterizes duplicate document type IDs as accepted and inserted independently', async () => {
    const firstValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'doc' }]) }));
    const secondValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'doc-2' }]) }));
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ for: vi.fn().mockResolvedValue([]) })) })),
      })),
      insert: vi
        .fn()
        .mockReturnValueOnce({ values: firstValues })
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({ values: secondValues })
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue([]) }),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    };
    mockFindNegotiation.mockResolvedValueOnce(negotiation()).mockResolvedValueOnce(negotiation());
    mockFindState.mockResolvedValueOnce({ id: STATE_B, code: 'closing' });
    selects(
      { result: [{ id: TYPE, code: 'T', name: 'Type' }] },
      { result: [] },
      { result: [] },
      { result: [] }
    );
    mockUpload.mockResolvedValue({
      storagePath: 'duplicate',
      filename: 'same.pdf',
      fileExtension: 'pdf',
      fileSizeMb: 1,
      mimeType: 'application/pdf',
      encryptionMetadata: {},
    });
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    await service.closeWithDocuments(ID, { id: ADVISOR, roles: [] } as never, [{}, {}] as never, [
      TYPE,
      TYPE,
    ]);
    expect(firstValues).toHaveBeenCalledWith(
      expect.objectContaining({ documentTypeId: TYPE, storagePath: 'duplicate' })
    );
    expect(secondValues).toHaveBeenCalledWith(
      expect.objectContaining({ documentTypeId: TYPE, storagePath: 'duplicate' })
    );
    expect(tx.insert).toHaveBeenCalledTimes(5);
    expect(mockNotification).not.toHaveBeenCalled();
  });
});
