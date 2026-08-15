import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockPublishedList = vi.fn();
const mockPublishedGet = vi.fn();

vi.mock('./vacancies.service.js', () => ({
  listVacancies: mockList,
  getVacancyById: mockGet,
  createVacancy: mockCreate,
  updateVacancy: mockUpdate,
  removeVacancy: mockRemove,
  listPublishedVacancies: mockPublishedList,
  getPublishedVacancyById: mockPublishedGet,
}));

const controller = await import('./vacancies.controller.js');

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

describe('vacancies controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards admin, public, and mutation operations', async () => {
    const query = { page: 1, limit: 10 };
    const body = { title: 'Backend Engineer' };
    const data = { id: ID, ...body };
    const result = { data: [data], meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 } };
    mockList.mockResolvedValue(result);
    mockGet.mockResolvedValue(data);
    mockCreate.mockResolvedValue(data);
    mockUpdate.mockResolvedValue(data);
    mockPublishedList.mockResolvedValue(result);
    mockPublishedGet.mockResolvedValue(data);

    const listRes = response();
    await controller.listVacancies(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...result });

    const getRes = response();
    await controller.getVacancyById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const createRes = response();
    await controller.createVacancy(request({ body, user: { id: USER_ID } }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(USER_ID, body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const updateRes = response();
    await controller.updateVacancy(request({ body }), updateRes);
    expect(mockUpdate).toHaveBeenCalledWith(ID, body);
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data });

    const removeRes = response();
    await controller.removeVacancy(request(), removeRes);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });

    const publishedListRes = response();
    await controller.listPublishedVacancies(request({ query }), publishedListRes);
    expect(mockPublishedList).toHaveBeenCalledWith(query);
    expect(publishedListRes.json).toHaveBeenCalledWith({ success: true, ...result });

    const publishedGetRes = response();
    await controller.getPublishedVacancyById(request(), publishedGetRes);
    expect(mockPublishedGet).toHaveBeenCalledWith(ID);
    expect(publishedGetRes.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('rejects unauthenticated creation and propagates service failures', async () => {
    await expect(controller.createVacancy(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    expect(mockCreate).not.toHaveBeenCalled();

    const error = new Error('vacancy failed');
    mockList.mockRejectedValue(error);
    const res = response();
    await expect(controller.listVacancies(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
