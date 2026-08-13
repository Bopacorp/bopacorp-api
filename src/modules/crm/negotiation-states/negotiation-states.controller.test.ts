import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
vi.mock('./negotiation-states.service.js', () => ({
  listNegotiationStates: mockList,
  getNegotiationStateById: mockGet,
  createNegotiationState: mockCreate,
  updateNegotiationState: mockUpdate,
  removeNegotiationState: mockRemove,
}));
const controller = await import('./negotiation-states.controller.js');
const ID = '11111111-1111-1111-1111-111111111111';
function response() {
  const value = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(value.status).mockReturnValue(value);
  return value;
}
function request(overrides: Record<string, unknown> = {}) {
  return { params: { id: ID }, query: {}, body: {}, ...overrides } as unknown as Request;
}

describe('negotiation states controller', () => {
  beforeEach(() => vi.resetAllMocks());
  it('returns the list and detail success envelopes with exact forwarding', async () => {
    const query = { page: 2, limit: 5 };
    const list = { data: [{ id: ID }], meta: { page: 2, limit: 5, totalItems: 1, totalPages: 1 } };
    mockList.mockResolvedValue(list);
    const listRes = response();
    await controller.listNegotiationStates(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...list });
    mockGet.mockResolvedValue({ id: ID });
    const getRes = response();
    await controller.getNegotiationStateById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
  });
  it('returns create 201, update, and remove envelopes with exact forwarding', async () => {
    const body = { code: 'NEW', name: 'New' };
    mockCreate.mockResolvedValue({ id: ID });
    const createRes = response();
    await controller.createNegotiationState(request({ body }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
    mockUpdate.mockResolvedValue({ id: ID, name: 'Updated' });
    const updateRes = response();
    await controller.updateNegotiationState(request({ body: { name: 'Updated' } }), updateRes);
    expect(mockUpdate).toHaveBeenCalledWith(ID, { name: 'Updated' });
    expect(updateRes.json).toHaveBeenCalledWith({
      success: true,
      data: { id: ID, name: 'Updated' },
    });
    const removeRes = response();
    await controller.removeNegotiationState(request(), removeRes);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });
  it.each([
    [controller.listNegotiationStates, mockList],
    [controller.getNegotiationStateById, mockGet],
    [controller.createNegotiationState, mockCreate],
    [controller.updateNegotiationState, mockUpdate],
    [controller.removeNegotiationState, mockRemove],
  ])('propagates service errors without writing a response', async (action, service) => {
    const error = new Error('failed');
    service.mockRejectedValue(error);
    const res = response();
    await expect(action(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
