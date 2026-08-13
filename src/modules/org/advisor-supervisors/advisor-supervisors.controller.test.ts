import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListSupervisors = vi.fn();
const mockListAdvisors = vi.fn();
const mockAssignSupervisors = vi.fn();
const mockGetClientInfo = vi.fn();

vi.mock('./advisor-supervisors.service.js', () => ({
  listSupervisors: mockListSupervisors,
  listAdvisors: mockListAdvisors,
  assignSupervisors: mockAssignSupervisors,
}));
vi.mock('@shared/utils/request.js', () => ({ getClientInfo: mockGetClientInfo }));

const controller = await import('./advisor-supervisors.controller.js');

const ADVISOR_ID = '11111111-1111-1111-1111-111111111111';
const ADMIN_ID = '44444444-4444-4444-4444-444444444444';

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    params: { userId: ADVISOR_ID },
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request<{ userId: string }>;
}

function createResponse() {
  return { json: vi.fn() } as unknown as Response;
}

describe('advisor-supervisors controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards supervisor list args and returns its data/meta envelope', async () => {
    const query = { page: 2, limit: 10, isActive: true, sortOrder: 'asc' };
    const result = {
      data: [{ supervisorId: 'supervisor' }],
      meta: { page: 2, limit: 10, totalItems: 1, totalPages: 1 },
    };
    const req = createRequest({ query });
    const res = createResponse();
    mockListSupervisors.mockResolvedValue(result);
    await controller.listSupervisors(req, res);
    expect(mockListSupervisors).toHaveBeenCalledWith(ADVISOR_ID, query);
    expect(res.json).toHaveBeenCalledWith({ success: true, ...result });
  });

  it('forwards advisor list args and returns its data/meta envelope', async () => {
    const query = { page: 1, limit: 20, isActive: false, sortOrder: 'asc' };
    const result = { data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } };
    const res = createResponse();
    mockListAdvisors.mockResolvedValue(result);
    await controller.listAdvisors(createRequest({ query }), res);
    expect(mockListAdvisors).toHaveBeenCalledWith(ADVISOR_ID, query);
    expect(res.json).toHaveBeenCalledWith({ success: true, ...result });
  });

  it('propagates supervisor and advisor list failures without writing responses', async () => {
    const supervisorError = new Error('Supervisors unavailable');
    const advisorError = new Error('Advisors unavailable');
    const supervisorsResponse = createResponse();
    const advisorsResponse = createResponse();
    mockListSupervisors.mockRejectedValue(supervisorError);
    mockListAdvisors.mockRejectedValue(advisorError);

    await expect(controller.listSupervisors(createRequest(), supervisorsResponse)).rejects.toBe(
      supervisorError
    );
    await expect(controller.listAdvisors(createRequest(), advisorsResponse)).rejects.toBe(
      advisorError
    );
    expect(supervisorsResponse.json).not.toHaveBeenCalled();
    expect(advisorsResponse.json).not.toHaveBeenCalled();
  });

  it('forwards actor, target, body, and client info for assignment', async () => {
    const body = { supervisorIds: ['22222222-2222-2222-2222-222222222222'] };
    const clientInfo = { ipAddress: '203.0.113.4', userAgent: 'test-agent' };
    const result = {
      data: [{ supervisorId: body.supervisorIds[0] }],
      meta: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    };
    const req = createRequest({ body, user: { id: ADMIN_ID } });
    const res = createResponse();
    mockGetClientInfo.mockReturnValue(clientInfo);
    mockAssignSupervisors.mockResolvedValue(result);
    await controller.assignSupervisors(req, res);
    expect(mockGetClientInfo).toHaveBeenCalledWith(req);
    expect(mockAssignSupervisors).toHaveBeenCalledWith(ADMIN_ID, ADVISOR_ID, body, clientInfo);
    expect(res.json).toHaveBeenCalledWith({ success: true, ...result });
  });

  it('rejects unauthenticated assignment without invoking the service', async () => {
    const res = createResponse();
    await expect(controller.assignSupervisors(createRequest(), res)).rejects.toThrow(
      UnauthorizedError
    );
    expect(mockAssignSupervisors).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('propagates service failures without writing a response', async () => {
    const error = new Error('Assignment unavailable');
    const res = createResponse();
    mockAssignSupervisors.mockRejectedValue(error);
    await expect(
      controller.assignSupervisors(createRequest({ user: { id: ADMIN_ID } }), res)
    ).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
