import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
vi.mock('./visit-types.service.js', () => ({
  listVisitTypes: mockList,
  getVisitTypeById: mockGet,
  createVisitType: mockCreate,
  updateVisitType: mockUpdate,
  removeVisitType: mockRemove,
}));
const controller = await import('./visit-types.controller.js');
const ID = '11111111-1111-1111-1111-111111111111';
function response() {
  const value = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(value.status).mockReturnValue(value);
  return value;
}
function request(overrides: Record<string, unknown> = {}) {
  return { params: { id: ID }, query: {}, body: {}, ...overrides } as unknown as Request;
}
describe('visit types controller', () => {
  beforeEach(() => vi.resetAllMocks());
  it('returns the list and detail success envelopes with exact forwarding', async () => {
    const query = { page: 2, limit: 5 };
    const list = { data: [{ id: ID }], meta: { page: 2, limit: 5, totalItems: 1, totalPages: 1 } };
    mockList.mockResolvedValue(list);
    const listRes = response();
    await controller.listVisitTypes(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...list });
    mockGet.mockResolvedValue({ id: ID });
    const getRes = response();
    await controller.getVisitTypeById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
  });
  it('returns create 201, update, and remove envelopes with exact forwarding', async () => {
    const body = { code: 'REMOTE', name: 'Remote' };
    mockCreate.mockResolvedValue({ id: ID });
    const createRes = response();
    await controller.createVisitType(request({ body }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
    mockUpdate.mockResolvedValue({ id: ID, name: 'Updated' });
    const updateRes = response();
    await controller.updateVisitType(request({ body: { name: 'Updated' } }), updateRes);
    expect(mockUpdate).toHaveBeenCalledWith(ID, { name: 'Updated' });
    expect(updateRes.json).toHaveBeenCalledWith({
      success: true,
      data: { id: ID, name: 'Updated' },
    });
    const removeRes = response();
    await controller.removeVisitType(request(), removeRes);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });
  it.each([
    [controller.listVisitTypes, mockList],
    [controller.getVisitTypeById, mockGet],
    [controller.createVisitType, mockCreate],
    [controller.updateVisitType, mockUpdate],
    [controller.removeVisitType, mockRemove],
  ])('propagates service errors without writing a response', async (action, service) => {
    const error = new Error('failed');
    service.mockRejectedValue(error);
    const res = response();
    await expect(action(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
