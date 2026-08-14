import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockVerify = vi.fn();
vi.mock('./visits.service.js', () => ({
  listVisits: mockList,
  getVisitById: mockGet,
  createVisit: mockCreate,
  updateVisit: mockUpdate,
  removeVisit: mockRemove,
  verifyVisit: mockVerify,
}));

const controller = await import('./visits.controller.js');
const ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function response() {
  const value = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(value.status).mockReturnValue(value);
  return value;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    params: { id: ID },
    query: {},
    body: {},
    user: { id: USER_ID, roles: ['supervisor'] },
    ...overrides,
  } as unknown as Request;
}

describe('visits controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns list and detail envelopes with exact forwarding', async () => {
    const query = { page: 2, limit: 5, isVerified: false };
    const list = { data: [{ id: ID }], meta: { page: 2, limit: 5, totalItems: 1, totalPages: 1 } };
    mockList.mockResolvedValue(list);
    const listResponse = response();
    await controller.listVisits(request({ query }), listResponse);
    expect(mockList).toHaveBeenCalledWith(query, expect.objectContaining({ id: USER_ID }));
    expect(listResponse.json).toHaveBeenCalledWith({ success: true, ...list });

    mockGet.mockResolvedValue({ id: ID });
    const detailResponse = response();
    await controller.getVisitById(request(), detailResponse);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(detailResponse.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
  });

  it('returns create 201, update, remove, and verify envelopes', async () => {
    const body = { observations: 'Visited' };
    mockCreate.mockResolvedValue({ id: ID });
    const createResponse = response();
    await controller.createVisit(request({ body }), createResponse);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createResponse.status).toHaveBeenCalledWith(201);
    expect(createResponse.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });

    mockUpdate.mockResolvedValue({ id: ID, observations: 'Updated' });
    const updateResponse = response();
    await controller.updateVisit(request({ body: { observations: 'Updated' } }), updateResponse);
    expect(mockUpdate).toHaveBeenCalledWith(ID, { observations: 'Updated' });
    expect(updateResponse.json).toHaveBeenCalledWith({
      success: true,
      data: { id: ID, observations: 'Updated' },
    });

    const removeResponse = response();
    await controller.removeVisit(request(), removeResponse);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(removeResponse.json).toHaveBeenCalledWith({ success: true, data: null });

    mockVerify.mockResolvedValue({ id: ID, isVerified: true });
    const verifyResponse = response();
    const verifyBody = { isVerified: true, supervisorComment: 'Reviewed' };
    await controller.verifyVisit(request({ body: verifyBody }), verifyResponse);
    expect(mockVerify).toHaveBeenCalledWith(ID, USER_ID, verifyBody);
    expect(verifyResponse.json).toHaveBeenCalledWith({
      success: true,
      data: { id: ID, isVerified: true },
    });
  });

  it('requires an authenticated actor only where the controller reads one', async () => {
    await expect(controller.listVisits(request({ user: undefined }), response())).rejects.toThrow(
      'Authentication required'
    );
    await expect(controller.verifyVisit(request({ user: undefined }), response())).rejects.toThrow(
      'Authentication required'
    );
  });

  it.each([
    [controller.listVisits, mockList],
    [controller.getVisitById, mockGet],
    [controller.createVisit, mockCreate],
    [controller.updateVisit, mockUpdate],
    [controller.removeVisit, mockRemove],
    [controller.verifyVisit, mockVerify],
  ])('propagates service errors without writing a response', async (action, service) => {
    const error = new Error('failed');
    service.mockRejectedValue(error);
    const res = response();
    await expect(action(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
