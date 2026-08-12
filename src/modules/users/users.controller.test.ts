import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListUsers = vi.fn();
const mockGetUserById = vi.fn();
const mockGetUserLockStatus = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockUnlockUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockAssignUserRoles = vi.fn();

vi.mock('./users.service.js', () => ({
  listUsers: mockListUsers,
  getUserById: mockGetUserById,
  getUserLockStatus: mockGetUserLockStatus,
  createUser: mockCreateUser,
  updateUser: mockUpdateUser,
  unlockUser: mockUnlockUser,
  deleteUser: mockDeleteUser,
  assignUserRoles: mockAssignUserRoles,
}));

const controller = await import('./users.controller.js');

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ROLE_ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_IP = '203.0.113.8';
const USER_AGENT = 'BOPA-API-Test/1.0';
const clientInfo = { ipAddress: CLIENT_IP, userAgent: USER_AGENT };

function createResponse() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    headers: {},
    params: { id: USER_ID },
    query: {},
    ...overrides,
  } as unknown as Request;
}

function createAuthenticatedRequest(overrides: Record<string, unknown> = {}) {
  return createRequest({
    user: { id: ADMIN_ID },
    ip: CLIENT_IP,
    headers: { 'user-agent': USER_AGENT },
    ...overrides,
  });
}

describe('users controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the list envelope with data and meta', async () => {
    const query = { page: 2, limit: 10, sortOrder: 'asc' };
    const result = {
      data: [{ id: USER_ID, username: 'bopa-user' }],
      meta: { page: 2, limit: 10, totalItems: 11, totalPages: 2 },
    };
    const res = createResponse();
    mockListUsers.mockResolvedValue(result);

    await controller.list(createRequest({ query }), res);

    expect(mockListUsers).toHaveBeenCalledWith(query);
    expect(res.json).toHaveBeenCalledWith({ success: true, ...result });
  });

  it('returns the user detail envelope', async () => {
    const data = { id: USER_ID, username: 'bopa-user', roles: [] };
    const res = createResponse();
    mockGetUserById.mockResolvedValue(data);

    await controller.getById(createRequest(), res);

    expect(mockGetUserById).toHaveBeenCalledWith(USER_ID);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('returns the lock status envelope', async () => {
    const data = {
      id: USER_ID,
      isActive: true,
      isLocked: true,
      lockedUntil: '2099-01-01T00:00:00.000Z',
    };
    const res = createResponse();
    mockGetUserLockStatus.mockResolvedValue(data);

    await controller.getLockStatus(createRequest(), res);

    expect(mockGetUserLockStatus).toHaveBeenCalledWith(USER_ID);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('returns 201 for create and forwards actor and client information', async () => {
    const body = { username: 'bopa-user', email: 'user@bopacorp.com', password: 'Password1!' };
    const data = { id: USER_ID, username: body.username };
    const res = createResponse();
    mockCreateUser.mockResolvedValue(data);

    await controller.create(createAuthenticatedRequest({ body }), res);

    expect(mockCreateUser).toHaveBeenCalledWith(ADMIN_ID, body, clientInfo);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('returns the update envelope and forwards actor and client information', async () => {
    const body = { email: 'updated@bopacorp.com' };
    const data = { id: USER_ID, email: body.email };
    const res = createResponse();
    mockUpdateUser.mockResolvedValue(data);

    await controller.update(createAuthenticatedRequest({ body }), res);

    expect(mockUpdateUser).toHaveBeenCalledWith(ADMIN_ID, USER_ID, body, clientInfo);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('validates the unlock response and forwards actor and client information', async () => {
    const body = { reason: 'Identity verified by administrator' };
    const data = { id: USER_ID, unlocked: true, message: 'User account unlocked' };
    const res = createResponse();
    mockUnlockUser.mockResolvedValue(data);

    await controller.unlock(createAuthenticatedRequest({ body }), res);

    expect(mockUnlockUser).toHaveBeenCalledWith(ADMIN_ID, USER_ID, body, clientInfo);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('rejects malformed unlock service responses', async () => {
    const res = createResponse();
    mockUnlockUser.mockResolvedValue({ id: USER_ID, unlocked: true });

    await expect(
      controller.unlock(createAuthenticatedRequest({ body: { reason: 'Identity verified' } }), res)
    ).rejects.toThrow();

    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns the delete success message and forwards actor and client information', async () => {
    const res = createResponse();
    mockDeleteUser.mockResolvedValue(undefined);

    await controller.remove(createAuthenticatedRequest(), res);

    expect(mockDeleteUser).toHaveBeenCalledWith(ADMIN_ID, USER_ID, clientInfo);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'User deleted successfully' },
    });
  });

  it('returns the assigned roles envelope and forwards actor and client information', async () => {
    const body = { roleIds: [ROLE_ID] };
    const data = { id: USER_ID, roles: [{ id: ROLE_ID, slug: 'admin' }] };
    const res = createResponse();
    mockAssignUserRoles.mockResolvedValue(data);

    await controller.assignRoles(createAuthenticatedRequest({ body }), res);

    expect(mockAssignUserRoles).toHaveBeenCalledWith(ADMIN_ID, USER_ID, body.roleIds, clientInfo);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it.each([
    ['create', controller.create, mockCreateUser],
    ['update', controller.update, mockUpdateUser],
    ['unlock', controller.unlock, mockUnlockUser],
    ['remove', controller.remove, mockDeleteUser],
    ['assign roles', controller.assignRoles, mockAssignUserRoles],
  ])('rejects unauthenticated %s requests before calling the service', async (_name, action, mockService) => {
    await expect(action(createRequest(), createResponse())).rejects.toThrow(UnauthorizedError);

    expect(mockService).not.toHaveBeenCalled();
  });
});
