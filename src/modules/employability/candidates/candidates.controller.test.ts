import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('./candidates.service.js', () => ({
  listCandidates: mockList,
  getCandidateById: mockGet,
  createCandidate: mockCreate,
  updateCandidate: mockUpdate,
  removeCandidate: mockRemove,
}));

const controller = await import('./candidates.controller.js');

const ID = '11111111-1111-1111-1111-111111111111';

function request(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: { id: ID }, query: {}, ...overrides } as unknown as Request;
}

function response() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('candidates controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards CRUD operations and returns the expected envelopes', async () => {
    const query = { search: 'ada' };
    const body = { firstName: 'Ada' };
    const data = { id: ID, ...body };
    const meta = { page: 1, limit: 10, totalItems: 1, totalPages: 1 };
    mockList.mockResolvedValue({ data: [data], meta });
    mockGet.mockResolvedValue(data);
    mockCreate.mockResolvedValue(data);
    mockUpdate.mockResolvedValue(data);

    const listRes = response();
    await controller.listCandidates(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, data: [data], meta });

    const getRes = response();
    await controller.getCandidateById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const createRes = response();
    await controller.createCandidate(request({ body }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const updateRes = response();
    await controller.updateCandidate(request({ body }), updateRes);
    expect(mockUpdate).toHaveBeenCalledWith(ID, body);
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data });

    const removeRes = response();
    await controller.removeCandidate(request(), removeRes);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('propagates service errors without writing a response', async () => {
    const error = new Error('candidate failed');
    mockGet.mockRejectedValue(error);
    const res = response();
    await expect(controller.getCandidateById(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
