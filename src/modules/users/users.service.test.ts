import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockHash = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    query: { users: { findFirst: mockFindFirst } },
    select: mockSelect,
    update: mockUpdate,
    transaction: mockTransaction,
  },
}));

vi.mock('@lib/audit.js', () => ({ createAuditLog: mockCreateAuditLog }));
vi.mock('bcrypt', () => ({ default: { hash: mockHash } }));

const {
  assignUserRoles,
  createUser,
  deleteUser,
  getUserById,
  getUserLockStatus,
  listUsers,
  unlockUser,
  updateUser,
} = await import('./users.service.js');

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const ROLE_ID = '33333333-3333-3333-3333-333333333333';
const NOW = new Date('2026-08-12T12:00:00.000Z');
const clientInfo = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    username: 'ada',
    email: 'ada@example.com',
    isActive: true,
    lastLoginAt: new Date('2026-08-10T10:00:00.000Z'),
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-11T10:00:00.000Z'),
    profile: null,
    userRoles: [],
    ...overrides,
  };
}

function hasQueryValue(expression: unknown, expectedValue: unknown): boolean {
  if (expression === expectedValue) return true;
  if (!expression || typeof expression !== 'object') return false;

  const candidate = expression as { queryChunks?: unknown[]; value?: unknown };
  if (candidate.value === expectedValue) return true;
  if (Array.isArray(candidate.value) && candidate.value.includes(expectedValue)) return true;

  return candidate.queryChunks?.some((chunk) => hasQueryValue(chunk, expectedValue)) ?? false;
}

function hasColumnName(expression: unknown, expectedName: string): boolean {
  if (!expression || typeof expression !== 'object') return false;

  const candidate = expression as { name?: unknown; queryChunks?: unknown[] };
  if (candidate.name === expectedName) return true;

  return candidate.queryChunks?.some((chunk) => hasColumnName(chunk, expectedName)) ?? false;
}

function createSelectBuilder(result: unknown, paginated = false) {
  const builder = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  if (paginated) {
    builder.where.mockReturnValue(builder);
    builder.offset.mockResolvedValue(result);
  } else {
    builder.where.mockResolvedValue(result);
  }
  return builder;
}

function setSelectResults(...results: Array<{ result: unknown; paginated?: boolean }>) {
  const builders = [];
  for (const { result, paginated = false } of results) {
    const builder = createSelectBuilder(result, paginated);
    builders.push(builder);
    mockSelect.mockReturnValueOnce(builder);
  }
  return builders;
}

function createTransaction() {
  const txSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
  const txUpdate = vi.fn(() => ({ set: txSet }));
  const txInsertValues = vi.fn().mockResolvedValue([]);
  const txInsert = vi.fn(() => ({ values: txInsertValues }));
  const txDelete = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
  const txSelect = vi.fn();
  return {
    tx: { delete: txDelete, insert: txInsert, select: txSelect, update: txUpdate },
    txDelete,
    txInsert,
    txInsertValues,
    txSelect,
    txSet,
    txUpdate,
  };
}

describe('users service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
    mockUpdate.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) });
    mockHash.mockResolvedValue('password-hash');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists paginated users with profile projection, grouped roles, filters, and metadata', async () => {
    const rows = [
      {
        ...makeUser(),
        firstName: 'Ada',
        lastName: 'Lovelace',
        avatarUrl: 'https://example.com/ada.png',
      },
      {
        ...makeUser({ id: '44444444-4444-4444-4444-444444444444', username: 'grace' }),
        firstName: null,
        lastName: null,
        avatarUrl: null,
      },
    ];
    const [countBuilder, rowsBuilder, rolesBuilder] = setSelectResults(
      { result: [{ count: 3 }] },
      { result: rows, paginated: true },
      {
        result: [
          { userId: USER_ID, roleSlug: 'admin' },
          { userId: USER_ID, roleSlug: 'manager' },
        ],
      }
    );

    const result = await listUsers({
      page: 2,
      limit: 2,
      isActive: true,
      search: 'ada',
      sortBy: 'email',
      sortOrder: 'desc',
    });

    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: USER_ID,
          roles: ['admin', 'manager'],
          profile: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            avatarUrl: 'https://example.com/ada.png',
          },
        }),
        expect.objectContaining({ profile: null, roles: [] }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(countBuilder?.leftJoin).toHaveBeenCalledTimes(1);
    expect(countBuilder?.where).toHaveBeenCalledTimes(1);
    expect(rowsBuilder?.leftJoin).toHaveBeenCalledTimes(1);
    expect(rowsBuilder?.where).toHaveBeenCalledTimes(1);
    expect(rowsBuilder?.orderBy).toHaveBeenCalledTimes(1);
    const userFilter = rowsBuilder?.where.mock.calls[0]?.[0];
    const userOrder = rowsBuilder?.orderBy.mock.calls[0]?.[0];
    expect(hasQueryValue(userFilter, true)).toBe(true);
    expect(hasQueryValue(userFilter, '%ada%')).toBe(true);
    expect(hasColumnName(userOrder, 'email')).toBe(true);
    expect(hasQueryValue(userOrder, ' desc')).toBe(true);
    expect(rowsBuilder?.limit).toHaveBeenCalledWith(2);
    expect(rowsBuilder?.offset).toHaveBeenCalledWith(2);
    expect(rolesBuilder?.where).toHaveBeenCalledTimes(1);
  });

  it('returns an empty page without issuing a roles query', async () => {
    const [countBuilder, rowsBuilder] = setSelectResults(
      { result: [{ count: 0 }] },
      { result: [], paginated: true }
    );

    await expect(listUsers({ page: 1, limit: 10 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    expect(mockSelect).toHaveBeenCalledTimes(2);
    expect(countBuilder?.where).toHaveBeenCalledTimes(1);
    expect(rowsBuilder?.limit).toHaveBeenCalledWith(10);
    expect(rowsBuilder?.offset).toHaveBeenCalledWith(0);
  });

  it('returns a user detail projection and rejects unknown users', async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeUser({
        profile: {
          id: 'profile-id',
          firstName: 'Ada',
          secondName: null,
          lastName: 'Lovelace',
          secondLastName: null,
          nationalId: '123',
          phone: null,
          avatarUrl: null,
          address: null,
        },
        userRoles: [{ role: { id: ROLE_ID, name: 'Administrator', slug: 'admin' } }],
      })
    );

    await expect(getUserById(USER_ID)).resolves.toEqual(
      expect.objectContaining({
        id: USER_ID,
        profile: expect.objectContaining({ firstName: 'Ada', nationalId: '123' }),
        roles: [{ id: ROLE_ID, name: 'Administrator', slug: 'admin' }],
      })
    );
    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(getUserById(USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('rejects duplicate usernames and emails before hashing', async () => {
    setSelectResults({ result: [makeUser()] });
    await expect(createUser(ADMIN_ID, createUserData(), clientInfo)).rejects.toThrow(ConflictError);
    expect(mockHash).not.toHaveBeenCalled();

    setSelectResults({ result: [] }, { result: [makeUser()] });
    await expect(createUser(ADMIN_ID, createUserData(), clientInfo)).rejects.toThrow(ConflictError);
    expect(mockHash).not.toHaveBeenCalled();
  });

  it('creates user, profile, roles, audit record, and returns its detail', async () => {
    setSelectResults({ result: [] }, { result: [] });
    const transaction = createTransaction();
    transaction.txInsert.mockReturnValueOnce({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([makeUser()]) })),
    });
    mockTransaction.mockImplementation(async (callback) => callback(transaction.tx));
    mockFindFirst.mockResolvedValueOnce(
      makeUser({
        profile: {
          id: 'profile-id',
          firstName: 'Ada',
          secondName: null,
          lastName: 'Lovelace',
          secondLastName: null,
          nationalId: '123',
          phone: null,
          avatarUrl: null,
          address: null,
        },
        userRoles: [{ role: { id: ROLE_ID, name: 'Administrator', slug: 'admin' } }],
      })
    );

    await expect(createUser(ADMIN_ID, createUserData(), clientInfo)).resolves.toMatchObject({
      id: USER_ID,
      profile: { firstName: 'Ada', lastName: 'Lovelace', nationalId: '123' },
      roles: [{ id: ROLE_ID, name: 'Administrator', slug: 'admin' }],
    });
    expect(mockHash).toHaveBeenCalledWith('Password123!', 12);
    expect(transaction.txInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, firstName: 'Ada' })
    );
    expect(transaction.txInsertValues).toHaveBeenCalledWith([{ userId: USER_ID, roleId: ROLE_ID }]);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'users',
        operation: 'I',
        recordId: USER_ID,
        userId: ADMIN_ID,
        newData: {
          username: 'ada',
          email: 'ada@example.com',
          isActive: true,
          roleIds: [ROLE_ID],
        },
        notes: 'User created by admin',
        ...clientInfo,
      })
    );
  });

  it('fails when creating the user produces no row', async () => {
    setSelectResults({ result: [] }, { result: [] });
    const transaction = createTransaction();
    transaction.txInsert.mockReturnValueOnce({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    });
    mockTransaction.mockImplementation(async (callback) => callback(transaction.tx));

    await expect(createUser(ADMIN_ID, createUserData(), clientInfo)).rejects.toThrow(
      InternalServerError
    );
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('updates email, status, and profile changes, audits the old and new values, then returns detail', async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(makeUser({ email: 'new@example.com', isActive: false }));
    const transaction = createTransaction();
    transaction.txSelect.mockReturnValue(createSelectBuilder([]));
    mockTransaction.mockImplementation(async (callback) => callback(transaction.tx));

    await expect(
      updateUser(
        ADMIN_ID,
        USER_ID,
        { email: 'new@example.com', isActive: false, profile: { firstName: 'Augusta' } },
        clientInfo
      )
    ).resolves.toMatchObject({ email: 'new@example.com', isActive: false });
    expect(transaction.txSet).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', isActive: false, updatedAt: NOW })
    );
    expect(transaction.txSet).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Augusta', updatedAt: NOW })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        oldData: { email: 'ada@example.com', isActive: true },
        newData: { email: 'new@example.com', isActive: false },
      })
    );
  });

  it('rejects missing users and duplicate update emails', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(updateUser(ADMIN_ID, USER_ID, { isActive: false }, clientInfo)).rejects.toThrow(
      NotFoundError
    );

    mockFindFirst.mockResolvedValueOnce(makeUser());
    const transaction = createTransaction();
    transaction.txSelect.mockReturnValue(createSelectBuilder([makeUser({ id: 'other-user' })]));
    mockTransaction.mockImplementation(async (callback) => callback(transaction.tx));
    await expect(
      updateUser(ADMIN_ID, USER_ID, { email: 'taken@example.com' }, clientInfo)
    ).rejects.toThrow(ConflictError);
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('does not write for an update with no mutable fields but records the audit event', async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(makeUser({ userRoles: [] }));
    const transaction = createTransaction();
    mockTransaction.mockImplementation(async (callback) => callback(transaction.tx));

    await expect(updateUser(ADMIN_ID, USER_ID, {}, clientInfo)).resolves.toMatchObject({
      id: USER_ID,
    });
    expect(transaction.txUpdate).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      tableName: 'users',
      recordId: USER_ID,
      operation: 'U',
      userId: ADMIN_ID,
      oldData: { email: 'ada@example.com', isActive: true },
      newData: { email: undefined, isActive: undefined },
      notes: 'User updated by admin',
      ...clientInfo,
    });
  });

  it('soft-deletes a user and deactivates their roles, or rejects a missing user', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(deleteUser(ADMIN_ID, USER_ID, clientInfo)).rejects.toThrow(NotFoundError);

    mockFindFirst.mockResolvedValueOnce(makeUser());
    const transaction = createTransaction();
    mockTransaction.mockImplementation(async (callback) => callback(transaction.tx));
    await expect(deleteUser(ADMIN_ID, USER_ID, clientInfo)).resolves.toBeUndefined();
    expect(transaction.txSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ deletedAt: NOW, isActive: false })
    );
    expect(transaction.txSet).toHaveBeenNthCalledWith(2, { isActive: false });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'D',
        oldData: expect.objectContaining({ username: 'ada' }),
      })
    );
  });

  it('reassigns roles including empty assignments, audits, and returns detail', async () => {
    mockFindFirst
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(makeUser({ userRoles: [] }));
    const transaction = createTransaction();
    mockTransaction.mockImplementation(async (callback) => callback(transaction.tx));
    await expect(assignUserRoles(ADMIN_ID, USER_ID, [ROLE_ID], clientInfo)).resolves.toMatchObject({
      id: USER_ID,
    });
    expect(transaction.txDelete).toHaveBeenCalled();
    expect(transaction.txInsertValues).toHaveBeenCalledWith([{ userId: USER_ID, roleId: ROLE_ID }]);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: 'user_roles', newData: { roleIds: [ROLE_ID] } })
    );

    mockFindFirst
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(makeUser({ userRoles: [] }));
    const emptyTransaction = createTransaction();
    mockTransaction.mockImplementation(async (callback) => callback(emptyTransaction.tx));
    await expect(assignUserRoles(ADMIN_ID, USER_ID, [], clientInfo)).resolves.toMatchObject({
      id: USER_ID,
    });
    expect(emptyTransaction.txInsert).not.toHaveBeenCalled();
  });

  it('rejects role assignment for a missing user', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(assignUserRoles(ADMIN_ID, USER_ID, [ROLE_ID], clientInfo)).rejects.toThrow(
      NotFoundError
    );
  });
});

describe('account lock service operations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
    mockUpdate.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('unlocks active accounts with a future lock and leaves unlocked accounts unchanged', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: USER_ID,
      isActive: true,
      failedLoginAttempts: 3,
      lockedUntil: new Date(NOW.getTime() + 60_000),
    });
    await expect(
      unlockUser(ADMIN_ID, USER_ID, { reason: 'Identity verified' }, clientInfo)
    ).resolves.toMatchObject({ unlocked: true });
    expect(mockUpdate).toHaveBeenCalled();
    mockUpdate.mockClear();

    mockFindFirst.mockResolvedValueOnce({
      id: USER_ID,
      isActive: true,
      failedLoginAttempts: 2,
      lockedUntil: null,
    });
    await expect(
      unlockUser(ADMIN_ID, USER_ID, { reason: 'Routine review' }, clientInfo)
    ).resolves.toMatchObject({ unlocked: false });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ oldData: { wasLocked: false }, newData: { unlocked: false } })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects missing or deactivated accounts when unlocking', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(
      unlockUser(ADMIN_ID, USER_ID, { reason: 'Routine review' }, clientInfo)
    ).rejects.toThrow(NotFoundError);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    mockFindFirst.mockResolvedValueOnce({
      id: USER_ID,
      isActive: false,
      failedLoginAttempts: 3,
      lockedUntil: new Date(NOW.getTime() + 60_000),
    });
    await expect(
      unlockUser(ADMIN_ID, USER_ID, { reason: 'Routine review' }, clientInfo)
    ).rejects.toThrow(ConflictError);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('reports only future locks and hides expired lock data', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: USER_ID,
      isActive: true,
      lockedUntil: new Date(NOW.getTime() + 60_000),
    });
    await expect(getUserLockStatus(USER_ID)).resolves.toEqual({
      id: USER_ID,
      isActive: true,
      isLocked: true,
      lockedUntil: '2026-08-12T12:01:00.000Z',
    });
    mockFindFirst.mockResolvedValueOnce({
      id: USER_ID,
      isActive: true,
      lockedUntil: new Date(NOW.getTime() - 60_000),
    });
    await expect(getUserLockStatus(USER_ID)).resolves.toEqual({
      id: USER_ID,
      isActive: true,
      isLocked: false,
      lockedUntil: null,
    });
    mockFindFirst.mockResolvedValueOnce({
      id: USER_ID,
      isActive: false,
      lockedUntil: new Date(NOW.getTime() + 60_000),
    });
    await expect(getUserLockStatus(USER_ID)).resolves.toEqual({
      id: USER_ID,
      isActive: false,
      isLocked: false,
      lockedUntil: null,
    });
    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(getUserLockStatus(USER_ID)).rejects.toThrow(NotFoundError);
  });
});

function createUserData() {
  return {
    username: 'ada',
    email: 'ada@example.com',
    password: 'Password123!',
    isActive: true,
    roleIds: [ROLE_ID],
    profile: { firstName: 'Ada', lastName: 'Lovelace' },
  };
}
