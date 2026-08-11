import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockSet = vi.fn(() => ({ where: vi.fn() }));
const mockWhere = vi.fn();
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
    },
    update: mockUpdate,
    delete: mockDelete,
    insert: mockInsert,
  },
}));

vi.mock('@lib/audit.js', () => ({ createAuditLog: mockCreateAuditLog }));
vi.mock('@lib/logger.js', () => ({
  createModuleLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn() })),
}));
vi.mock('bcrypt', () => ({ default: { compare: mockCompare, hash: mockHash } }));

const { authService } = await import('./auth.service.js');

const USER_ID = '22222222-2222-2222-2222-222222222222';

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

describe('authService lock policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockSet });
    mockDelete.mockReturnValue({ where: mockWhere });
    mockInsert.mockReturnValue({ values: vi.fn() });
  });

  it('locks the account on the third failed login', async () => {
    mockFindFirst.mockResolvedValue(makeUser({ failedLoginAttempts: 2 }));
    mockCompare.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'user@example.com', password: 'wrong' })
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ failedLoginAttempts: 3, lockedUntil: expect.any(Date) })
    );
  });

  it('retains failed attempts after an expired lock and applies the next lock threshold', async () => {
    mockFindFirst.mockResolvedValue(
      makeUser({ failedLoginAttempts: 2, lockedUntil: new Date(Date.now() - 60_000) })
    );
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

  it('clears lock state and revokes refresh tokens after a password reset', async () => {
    mockFindFirst.mockResolvedValue({
      user: makeUser({ failedLoginAttempts: 5, lockedUntil: new Date() }),
    });
    mockHash.mockResolvedValue('new-password-hash');

    await authService.resetPassword({ token: 'valid-reset-token', newPassword: 'new-password' });

    expect(mockSet).toHaveBeenCalledWith({
      passwordHash: 'new-password-hash',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: USER_ID, newData: { passwordChanged: true } })
    );
  });
});
