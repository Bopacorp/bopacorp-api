import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockTree = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDisable = vi.fn();

vi.mock('./categories.service.js', () => ({
  listCategories: mockList,
  getCategoryTree: mockTree,
  getCategoryById: mockGet,
  createCategory: mockCreate,
  updateCategory: mockUpdate,
  disableCategory: mockDisable,
}));

const controller = await import('./categories.controller.js');

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

describe('categories controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards list, tree, detail, create, update, and disable operations', async () => {
    const query = { search: 'mobile' };
    const body = { name: 'Mobile', slug: 'mobile' };
    const data = { id: ID, ...body };
    mockList.mockResolvedValue([data]);
    mockTree.mockResolvedValue([data]);
    mockGet.mockResolvedValue(data);
    mockCreate.mockResolvedValue(data);
    mockUpdate.mockResolvedValue(data);

    const listRes = response();
    await controller.listCategories(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, data: [data] });

    const treeRes = response();
    await controller.getCategoryTree(request(), treeRes);
    expect(mockTree).toHaveBeenCalledWith();
    expect(treeRes.json).toHaveBeenCalledWith({ success: true, data: [data] });

    const getRes = response();
    await controller.getCategoryById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const createRes = response();
    await controller.createCategory(request({ body, user: { id: USER_ID } }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const updateRes = response();
    await controller.updateCategory(request({ body }), updateRes);
    expect(mockUpdate).toHaveBeenCalledWith(ID, body);
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data });

    const disableRes = response();
    await controller.disableCategory(request(), disableRes);
    expect(mockDisable).toHaveBeenCalledWith(ID);
    expect(disableRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('propagates service failures without writing a response', async () => {
    const error = new Error('category failed');
    mockList.mockRejectedValue(error);
    const res = response();
    await expect(controller.listCategories(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
