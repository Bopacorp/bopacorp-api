import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockValues = vi.fn();
const mockSelectWhere = vi.fn();
const mockCompare = vi.fn();
const mockHash = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock('@config/env.js', () => ({
  env: {
    JWT_SECRET: 'a-test-secret-that-is-longer-than-thirty-two-characters',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
}));

vi.mock('@lib/db.js', () => ({
  db: {
    query: {
      users: { findFirst: mockFindFirst },
      authTokens: { findFirst: mockFindFirst },
      userRoles: { findMany: mockFindMany },
    },
    update: mockUpdate,
    delete: mockDelete,
    insert: mockInsert,
    select: mockSelect,
  },
}));

vi.mock('@lib/audit.js', () => ({ createAuditLog: mockCreateAuditLog }));
vi.mock('@lib/logger.js', () => ({
  createModuleLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn() })),
}));
vi.mock('bcrypt', () => ({ default: { compare: mockCompare, hash: mockHash } }));

const { authService } = await import('./auth.service.js');

const USER_ID = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-01-15T10:00:00.000Z');

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'user@example.com',
    username: 'user',
    passwordHash: 'stored-hash',
    isActive: true,
    deletedAt: null,
    failedLoginAttempts: 2,
    lockedUntil: null,
    profile: null,
    userRoles: [],
    ...overrides,
  };
}

function makeRole(slug: string, roleId = '33333333-3333-3333-3333-333333333333') {
  return { roleId, role: { slug } };
}

function setSelectResults(...results: unknown[]) {
  mockSelectWhere.mockReset();
  for (const result of results) {
    mockSelectWhere.mockResolvedValueOnce(result);
  }
  mockSelectWhere.mockResolvedValue([]);
}

function hasPredicateValue(predicate: unknown, expectedValue: string): boolean {
  if (!predicate || typeof predicate !== 'object') return false;

  const candidate = predicate as { queryChunks?: unknown[]; value?: unknown };
  if (candidate.value === expectedValue) return true;

  return candidate.queryChunks?.some((chunk) => hasPredicateValue(chunk, expectedValue)) ?? false;
}

describe('authService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockWhere.mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    mockDelete.mockReturnValue({ where: mockWhere });
    mockValues.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockSelect.mockImplementation(() => {
      const builder = {
        from: vi.fn(() => builder),
        innerJoin: vi.fn(() => builder),
        where: mockSelectWhere,
      };
      return builder;
    });
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue('new-password-hash');
    setSelectResults();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns tokens and records successful login effects', async () => {
    const user = makeUser({
      failedLoginAttempts: 4,
      lockedUntil: new Date(NOW.getTime() - 1_000),
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
      userRoles: [makeRole('admin')],
    });
    mockFindFirst.mockResolvedValueOnce(user);
    setSelectResults([{ count: 0 }], [{ code: 'users.read' }]);

    const result = await authService.login({
      email: user.email,
      password: 'correct-password',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(result).toMatchObject({
      user: {
        id: USER_ID,
        roles: ['admin'],
        permissions: ['users.read'],
        profile: { firstName: 'Ada' },
      },
      tokens: { accessToken: expect.any(String), refreshToken: expect.any(String), expiresIn: 900 },
    });
    expect(mockSet).toHaveBeenNthCalledWith(1, { lockedUntil: null });
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: NOW })
    );
    expect(mockValues).toHaveBeenNthCalledWith(1, {
      userId: USER_ID,
      status: 'success',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(mockValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: USER_ID,
        type: 'refresh',
        token: expect.any(String),
        expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
      })
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid credentials and records the failed attempt', async () => {
    mockFindFirst.mockResolvedValue(makeUser({ failedLoginAttempts: 2 }));
    mockCompare.mockResolvedValue(false);

    await expect(
      authService.login({
        email: 'user@example.com',
        password: 'wrong',
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ failedLoginAttempts: 3, lockedUntil: expect.any(Date) })
    );
    expect(mockValues).toHaveBeenCalledWith({
      userId: USER_ID,
      status: 'failed',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
  });

  it('rejects an actively locked account and writes a locked login log', async () => {
    mockFindFirst.mockResolvedValue(makeUser({ lockedUntil: new Date(NOW.getTime() + 60_000) }));

    await expect(
      authService.login({ email: 'user@example.com', password: 'password' })
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });

    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      userId: USER_ID,
      status: 'locked',
      ipAddress: null,
      userAgent: null,
    });
  });

  it('rejects a disabled account after recording the failed login', async () => {
    mockFindFirst.mockResolvedValue(makeUser({ isActive: false }));

    await expect(
      authService.login({ email: 'user@example.com', password: 'password' })
    ).rejects.toMatchObject({
      code: 'ACCOUNT_DISABLED',
    });

    expect(mockValues).toHaveBeenCalledWith({
      userId: USER_ID,
      status: 'failed',
      ipAddress: null,
      userAgent: null,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rate limits an IP with ten recent failed logins before looking up the user', async () => {
    setSelectResults([{ count: 10 }]);

    await expect(
      authService.login({ email: 'user@example.com', password: 'password', ipAddress: '10.0.0.1' })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('retains failed attempts after an expired lock and applies the next lock threshold', async () => {
    mockFindFirst.mockResolvedValue(makeUser({ lockedUntil: new Date(NOW.getTime() - 60_000) }));
    mockCompare.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'user@example.com', password: 'wrong' })
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    expect(mockSet).toHaveBeenNthCalledWith(1, { lockedUntil: null });
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ failedLoginAttempts: 3, lockedUntil: expect.any(Date) })
    );
  });

  it.each([
    [4, 15 * 60],
    [6, 30 * 60],
    [9, 60 * 60],
  ])('escalates a failed login at attempt %i to a %i-second lock', async (failedAttempts, duration) => {
    mockFindFirst.mockResolvedValue(makeUser({ failedLoginAttempts: failedAttempts }));
    mockCompare.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'user@example.com', password: 'wrong' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(mockSet).toHaveBeenCalledWith({
      failedLoginAttempts: failedAttempts + 1,
      lockedUntil: new Date(NOW.getTime() + duration * 1000),
    });
  });

  it('rejects an invalid refresh token', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(authService.refresh({ refreshToken: 'invalid-token' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('revokes all refresh tokens when the refresh token user is inactive', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'token-id',
      userId: USER_ID,
      user: makeUser({ isActive: false }),
    });

    await expect(authService.refresh({ refreshToken: 'refresh-token' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    const inactiveUserRefreshPredicate = mockWhere.mock.calls[0]?.[0];
    expect(hasPredicateValue(inactiveUserRefreshPredicate, USER_ID)).toBe(true);
    expect(hasPredicateValue(inactiveUserRefreshPredicate, 'refresh')).toBe(true);
  });

  it('rotates a refresh token and renews role and permission claims', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'token-id', userId: USER_ID, user: makeUser() });
    mockFindMany.mockResolvedValue([makeRole('editor')]);
    setSelectResults([{ code: 'catalog.write' }]);

    const result = await authService.refresh({ refreshToken: 'old-refresh-token' });

    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
    });
    expect(jwt.decode(result.accessToken)).toMatchObject({
      sub: USER_ID,
      roles: ['editor'],
      permissions: ['catalog.write'],
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: 'refresh',
        token: expect.any(String),
        expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
      })
    );
  });

  it('revokes the hashed refresh token on logout and permits an invalid token', async () => {
    const returning = vi.fn().mockResolvedValue([]);
    mockWhere.mockReturnValueOnce({ returning });

    await expect(authService.logout('already-revoked-token')).resolves.toBeUndefined();

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockWhere.mock.calls[0]?.[0]).toSatisfy((predicate) =>
      hasPredicateValue(
        predicate,
        createHash('sha256').update('already-revoked-token').digest('hex')
      )
    );
    expect(returning).toHaveBeenCalledTimes(1);
  });

  it('replaces reset tokens for an active account', async () => {
    mockFindFirst.mockResolvedValue(makeUser());

    await authService.forgotPassword('user@example.com');

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        type: 'password_reset',
        token: expect.any(String),
        expiresAt: new Date(NOW.getTime() + 15 * 60 * 1000),
      })
    );
  });

  it.each([
    null,
    makeUser({ isActive: false }),
  ])('does not disclose unavailable password-reset account', async (user) => {
    mockFindFirst.mockResolvedValue(user);

    await expect(authService.forgotPassword('user@example.com')).resolves.toBeUndefined();

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockValues).not.toHaveBeenCalled();
  });

  it('rejects an invalid reset token', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      authService.resetPassword({ token: 'invalid-reset-token', newPassword: 'new-password' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(mockHash).not.toHaveBeenCalled();
  });

  it('rejects a reset token belonging to an inactive user', async () => {
    mockFindFirst.mockResolvedValue({ user: makeUser({ isActive: false }) });

    await expect(
      authService.resetPassword({ token: 'valid-reset-token', newPassword: 'new-password' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(mockHash).not.toHaveBeenCalled();
  });

  it('clears lock state, revokes tokens, and audits a successful password reset', async () => {
    mockFindFirst.mockResolvedValue({
      user: makeUser({ failedLoginAttempts: 5, lockedUntil: NOW }),
    });

    await authService.resetPassword({ token: 'valid-reset-token', newPassword: 'new-password' });

    expect(mockHash).toHaveBeenCalledWith('new-password', 12);
    expect(mockSet).toHaveBeenCalledWith({
      passwordHash: 'new-password-hash',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(mockDelete).toHaveBeenCalledTimes(2);
    const passwordResetPredicate = mockWhere.mock.calls[0]?.[0];
    const refreshTokenPredicate = mockWhere.mock.calls[1]?.[0];
    expect(hasPredicateValue(passwordResetPredicate, USER_ID)).toBe(true);
    expect(hasPredicateValue(passwordResetPredicate, 'password_reset')).toBe(true);
    expect(hasPredicateValue(refreshTokenPredicate, USER_ID)).toBe(true);
    expect(hasPredicateValue(refreshTokenPredicate, 'refresh')).toBe(true);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: USER_ID, newData: { passwordChanged: true } })
    );
  });

  it('throws not found when changing a missing user password', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      authService.changePassword(USER_ID, {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      })
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('rejects an invalid current password without changing it', async () => {
    mockFindFirst.mockResolvedValue(makeUser());
    mockCompare.mockResolvedValue(false);

    await expect(
      authService.changePassword(USER_ID, {
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(mockHash).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('changes the password, revokes refresh tokens, and records request metadata', async () => {
    mockFindFirst.mockResolvedValue(makeUser());

    await authService.changePassword(USER_ID, {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(mockSet).toHaveBeenCalledWith({ passwordHash: 'new-password-hash' });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    const passwordChangeRefreshPredicate = mockWhere.mock.calls[0]?.[0];
    expect(hasPredicateValue(passwordChangeRefreshPredicate, USER_ID)).toBe(true);
    expect(hasPredicateValue(passwordChangeRefreshPredicate, 'refresh')).toBe(true);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '127.0.0.1', userAgent: 'vitest' })
    );
  });

  it('returns the active user profile and role projection', async () => {
    mockFindFirst.mockResolvedValue(
      makeUser({
        userRoles: [makeRole('admin'), makeRole('editor', '44444444-4444-4444-4444-444444444444')],
        profile: {
          id: 'profile-id',
          firstName: 'Ada',
          secondName: null,
          lastName: 'Lovelace',
          secondLastName: null,
          nationalId: '123',
          phone: '555',
          avatarUrl: null,
          address: 'Street',
        },
      })
    );

    await expect(authService.getMe(USER_ID)).resolves.toMatchObject({
      id: USER_ID,
      roles: ['admin', 'editor'],
      profile: { firstName: 'Ada', address: 'Street' },
    });
  });

  it('rejects an inactive user profile request', async () => {
    mockFindFirst.mockResolvedValue(makeUser({ isActive: false }));

    await expect(authService.getMe(USER_ID)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
