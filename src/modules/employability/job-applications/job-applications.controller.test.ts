import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('./job-applications.service.js', () => ({
  listJobApplications: mockList,
  getJobApplicationById: mockGet,
  createJobApplication: mockCreate,
  updateJobApplication: mockUpdate,
  removeJobApplication: mockRemove,
}));

const controller = await import('./job-applications.controller.js');

const ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function request(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: { id: ID }, query: {}, ...overrides } as unknown as Request;
}

function response() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('job applications controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards list, detail, create, update, and remove operations', async () => {
    const query = { state: 'PENDING' };
    const body = { state: 'ACCEPTED' };
    const data = { id: ID, state: 'ACCEPTED' };
    const result = { data: [data], meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 } };
    mockList.mockResolvedValue(result);
    mockGet.mockResolvedValue(data);
    mockCreate.mockResolvedValue(data);
    mockUpdate.mockResolvedValue(data);

    const listRes = response();
    await controller.listJobApplications(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...result });

    const getRes = response();
    await controller.getJobApplicationById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const createRes = response();
    await controller.createJobApplication(request({ body }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const updateRes = response();
    await controller.updateJobApplication(request({ body, user: { id: USER_ID } }), updateRes);
    expect(mockUpdate).toHaveBeenCalledWith(ID, USER_ID, body);
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data });

    const removeRes = response();
    await controller.removeJobApplication(request(), removeRes);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('requires authentication for updates and propagates service errors', async () => {
    await expect(controller.updateJobApplication(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    expect(mockUpdate).not.toHaveBeenCalled();

    const error = new Error('application failed');
    mockList.mockRejectedValue(error);
    const res = response();
    await expect(controller.listJobApplications(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
