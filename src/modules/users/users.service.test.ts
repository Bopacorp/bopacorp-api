import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn(() => ({ where: vi.fn() }));
const mockCreateAuditLog = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    query: {
      users: { findFirst: mockFindFirst },
    },
    update: mockUpdate,
  },
}));

vi.mock('@lib/audit.js', () => ({ createAuditLog: mockCreateAuditLog }));

const { getUserLockStatus, unlockUser } = await import('./users.service.js');

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const clientInfo = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

describe('unlockUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockSet });
  });

  it('clears lock fields for an active locked user and records the stated reason', async () => {
    mockFindFirst.mockResolvedValue({
      id: USER_ID,
      isActive: true,
      failedLoginAttempts: 3,
      lockedUntil: new Date('2099-08-11T12:00:00.000Z'),
    });

    const result = await unlockUser(ADMIN_ID, USER_ID, { reason: 'Identity verified' }, clientInfo);

    expect(result).toEqual({ id: USER_ID, unlocked: true, message: 'User account unlocked' });
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: expect.any(Date),
      })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: USER_ID,
        userId: ADMIN_ID,
        oldData: { wasLocked: true },
        newData: { unlocked: true },
        notes: 'Identity verified',
        ...clientInfo,
      })
    );
  });

  it('is idempotent for an active user who is already unlocked', async () => {
    mockFindFirst.mockResolvedValue({
      id: USER_ID,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    const result = await unlockUser(ADMIN_ID, USER_ID, { reason: 'Routine review' }, clientInfo);

    expect(result).toEqual({
      id: USER_ID,
      unlocked: false,
      message: 'User account was not locked',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ oldData: { wasLocked: false }, newData: { unlocked: false } })
    );
  });

  it('does not reset failed attempts for an active user without a current lock', async () => {
    mockFindFirst.mockResolvedValue({
      id: USER_ID,
      isActive: true,
      failedLoginAttempts: 2,
      lockedUntil: null,
    });

    const result = await unlockUser(ADMIN_ID, USER_ID, { reason: 'Routine review' }, clientInfo);

    expect(result).toEqual({
      id: USER_ID,
      unlocked: false,
      message: 'User account was not locked',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ oldData: { wasLocked: false }, newData: { unlocked: false } })
    );
  });

  it('rejects a missing user without updating it', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await expect(
      unlockUser(ADMIN_ID, USER_ID, { reason: 'Routine review' }, clientInfo)
    ).rejects.toThrow(NotFoundError);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('rejects a disabled user without updating it', async () => {
    mockFindFirst.mockResolvedValue({
      id: USER_ID,
      isActive: false,
      failedLoginAttempts: 3,
      lockedUntil: new Date('2026-08-11T12:00:00.000Z'),
    });

    await expect(
      unlockUser(ADMIN_ID, USER_ID, { reason: 'Routine review' }, clientInfo)
    ).rejects.toThrow(ConflictError);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});

describe('getUserLockStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the future lock expiry for an active locked account', async () => {
    mockFindFirst.mockResolvedValue({
      id: USER_ID,
      isActive: true,
      lockedUntil: new Date('2099-08-11T12:00:00.000Z'),
    });

    await expect(getUserLockStatus(USER_ID)).resolves.toEqual({
      id: USER_ID,
      isActive: true,
      isLocked: true,
      lockedUntil: '2099-08-11T12:00:00.000Z',
    });
  });

  it('hides expired lock data', async () => {
    mockFindFirst.mockResolvedValue({
      id: USER_ID,
      isActive: true,
      lockedUntil: new Date('2026-01-01T12:00:00.000Z'),
    });

    await expect(getUserLockStatus(USER_ID)).resolves.toEqual({
      id: USER_ID,
      isActive: true,
      isLocked: false,
      lockedUntil: null,
    });
  });

  it('rejects a missing user', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await expect(getUserLockStatus(USER_ID)).rejects.toThrow(NotFoundError);
  });
});
