import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSections = vi.fn();

vi.mock('./content-blocks.service.js', () => ({
  listContentBlocks: mockList,
  getContentBlockById: mockGet,
  createContentBlock: mockCreate,
  updateContentBlock: mockUpdate,
  deleteContentBlock: mockDelete,
  listSections: mockSections,
}));

const controller = await import('./content-blocks.controller.js');

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

describe('content blocks controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards all operations and preserves response envelopes', async () => {
    const query = { page: 1, limit: 10 };
    const body = { contentKey: 'home.title' };
    const data = { id: ID, ...body };
    const meta = { page: 1, limit: 10, totalItems: 1, totalPages: 1 };
    mockList.mockResolvedValue({ data: [data], meta });
    mockGet.mockResolvedValue(data);
    mockCreate.mockResolvedValue(data);
    mockUpdate.mockResolvedValue(data);
    mockSections.mockResolvedValue([{ prefix: 'home', count: 1 }]);

    const listRes = response();
    await controller.listContentBlocks(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, data: [data], meta });

    const getRes = response();
    await controller.getContentBlockById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const authRequest = request({ body, user: { id: USER_ID } });
    const createRes = response();
    await controller.createContentBlock(authRequest, createRes);
    expect(mockCreate).toHaveBeenCalledWith(body, USER_ID);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const updateRes = response();
    await controller.updateContentBlock(authRequest, updateRes);
    expect(mockUpdate).toHaveBeenCalledWith(ID, body, USER_ID);
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data });

    const deleteRes = response();
    await controller.deleteContentBlock(request(), deleteRes);
    expect(mockDelete).toHaveBeenCalledWith(ID);
    expect(deleteRes.json).toHaveBeenCalledWith({ success: true, data: null });

    const sectionsRes = response();
    await controller.listSections(request(), sectionsRes);
    expect(mockSections).toHaveBeenCalledWith();
    expect(sectionsRes.json).toHaveBeenCalledWith({
      success: true,
      data: [{ prefix: 'home', count: 1 }],
    });
  });

  it('requires authentication for create and update', async () => {
    await expect(controller.createContentBlock(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.updateContentBlock(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
