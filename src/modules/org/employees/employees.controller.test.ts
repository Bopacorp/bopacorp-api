import { ForbiddenError, UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListEmployees = vi.fn();
const mockGetEmployeeByUserId = vi.fn();
const mockCreateEmployee = vi.fn();
const mockUpdateEmployee = vi.fn();
const mockDeleteEmployee = vi.fn();

vi.mock('./employees.service.js', () => ({
  listEmployees: mockListEmployees,
  getEmployeeByUserId: mockGetEmployeeByUserId,
  createEmployee: mockCreateEmployee,
  updateEmployee: mockUpdateEmployee,
  deleteEmployee: mockDeleteEmployee,
}));

const controller = await import('./employees.controller.js');

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const clientInfo = { ipAddress: '203.0.113.8', userAgent: 'Vitest/1.0' };

function createResponse() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    headers: {},
    params: { userId: USER_ID },
    query: {},
    ...overrides,
  } as unknown as Request;
}

function authenticatedRequest(overrides: Record<string, unknown> = {}) {
  return createRequest({
    user: { id: ADMIN_ID, permissions: ['employees.write'] },
    ip: clientInfo.ipAddress,
    headers: { 'user-agent': clientInfo.userAgent },
    ...overrides,
  });
}

describe('employees controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns list and detail success envelopes', async () => {
    const list = {
      data: [{ userId: USER_ID }],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    };
    const listRes = createResponse();
    mockListEmployees.mockResolvedValue(list);
    await controller.listEmployees(createRequest({ query: { page: 1, limit: 10 } }), listRes);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...list });

    const detailRes = createResponse();
    const data = { userId: USER_ID, supervisors: [], advisors: [] };
    mockGetEmployeeByUserId.mockResolvedValue(data);
    await controller.getEmployeeByUserId(createRequest(), detailRes);
    expect(mockGetEmployeeByUserId).toHaveBeenCalledWith(USER_ID);
    expect(detailRes.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('enforces users.unlock only for requested lock status', async () => {
    await expect(
      controller.listEmployees(
        createRequest({ query: { includeLockStatus: true } }),
        createResponse()
      )
    ).rejects.toThrow(UnauthorizedError);
    expect(mockListEmployees).not.toHaveBeenCalled();

    await expect(
      controller.listEmployees(
        createRequest({ query: { includeLockStatus: true }, user: { permissions: [] } }),
        createResponse()
      )
    ).rejects.toThrow(ForbiddenError);
    expect(mockListEmployees).not.toHaveBeenCalled();

    const req = createRequest({
      query: { includeLockStatus: true },
      user: { permissions: ['users.unlock'] },
    });
    mockListEmployees.mockResolvedValue({ data: [], meta: { page: 1, limit: 10 } });
    await controller.listEmployees(req, createResponse());
    expect(mockListEmployees).toHaveBeenCalledWith(req.query);
  });

  it('returns create, update, and delete envelopes while forwarding actor and client', async () => {
    const body = { userId: USER_ID, orgRoleId: '33333333-3333-3333-3333-333333333333' };
    const createRes = createResponse();
    mockCreateEmployee.mockResolvedValue({ userId: USER_ID });
    await controller.createEmployee(authenticatedRequest({ body }), createRes);
    expect(mockCreateEmployee).toHaveBeenCalledWith(ADMIN_ID, body, clientInfo);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data: { userId: USER_ID } });

    const updateRes = createResponse();
    mockUpdateEmployee.mockResolvedValue({ userId: USER_ID, territory: null });
    await controller.updateEmployee(authenticatedRequest({ body: { territory: null } }), updateRes);
    expect(mockUpdateEmployee).toHaveBeenCalledWith(
      ADMIN_ID,
      USER_ID,
      { territory: null },
      clientInfo
    );
    expect(updateRes.json).toHaveBeenCalledWith({
      success: true,
      data: { userId: USER_ID, territory: null },
    });

    const deleteRes = createResponse();
    mockDeleteEmployee.mockResolvedValue(undefined);
    await controller.removeEmployee(authenticatedRequest(), deleteRes);
    expect(mockDeleteEmployee).toHaveBeenCalledWith(ADMIN_ID, USER_ID, clientInfo);
    expect(deleteRes.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Employee deleted successfully' },
    });
  });

  it.each([
    ['create', controller.createEmployee, mockCreateEmployee],
    ['update', controller.updateEmployee, mockUpdateEmployee],
    ['delete', controller.removeEmployee, mockDeleteEmployee],
  ])('rejects unauthenticated %s requests before service invocation', async (_name, action, mockService) => {
    await expect(action(createRequest(), createResponse())).rejects.toThrow(UnauthorizedError);
    expect(mockService).not.toHaveBeenCalled();
  });
});
