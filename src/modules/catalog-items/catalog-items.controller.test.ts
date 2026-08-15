import { BadRequestError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockUpload = vi.fn();
const mockDeleteImage = vi.fn();

vi.mock('./catalog-items.service.js', () => ({
  listCatalogItems: mockList,
  getCatalogItemById: mockGet,
  createCatalogItem: mockCreate,
  updateCatalogItem: mockUpdate,
  removeCatalogItem: mockRemove,
  uploadItemImage: mockUpload,
  deleteItemImage: mockDeleteImage,
}));

const controller = await import('./catalog-items.controller.js');

const ID = '11111111-1111-1111-1111-111111111111';

function request(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: { id: ID }, query: {}, ...overrides } as unknown as Request;
}

function response() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('catalog items controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards CRUD and image operations with the expected envelopes', async () => {
    const query = { page: 1, limit: 10 };
    const body = { name: 'Premium' };
    const file = { buffer: Buffer.from('image'), mimetype: 'image/png', originalname: 'x.png' };
    const data = { id: ID, name: 'Premium' };
    const listResult = { data: [data], meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 } };
    mockList.mockResolvedValue(listResult);
    mockGet.mockResolvedValue(data);
    mockCreate.mockResolvedValue(data);
    mockUpdate.mockResolvedValue(data);
    mockUpload.mockResolvedValue({ imagePath: 'catalog/image.png' });

    const listRes = response();
    await controller.list(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...listResult });

    const getRes = response();
    await controller.getById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const createRes = response();
    await controller.create(request({ body }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const updateRes = response();
    await controller.update(request({ body }), updateRes);
    expect(mockUpdate).toHaveBeenCalledWith(ID, body);
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data });

    const removeRes = response();
    await controller.remove(request(), removeRes);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });

    const uploadRes = response();
    await controller.uploadImage(request({ file }), uploadRes);
    expect(mockUpload).toHaveBeenCalledWith(ID, file);
    expect(uploadRes.json).toHaveBeenCalledWith({
      success: true,
      data: { imagePath: 'catalog/image.png' },
    });

    const deleteRes = response();
    await controller.deleteImage(request(), deleteRes);
    expect(mockDeleteImage).toHaveBeenCalledWith(ID);
    expect(deleteRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('rejects an image upload without a file', async () => {
    await expect(controller.uploadImage(request(), response())).rejects.toThrow(BadRequestError);
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
