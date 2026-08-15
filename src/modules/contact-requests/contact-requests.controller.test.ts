import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockAttend = vi.fn();

vi.mock('./contact-requests.service.js', () => ({
  listContactRequests: mockList,
  getContactRequestById: mockGet,
  createContactRequest: mockCreate,
  attendContactRequest: mockAttend,
}));

const controller = await import('./contact-requests.controller.js');

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

describe('contact requests controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards public creation and protected list, detail, and attend operations', async () => {
    const query = { search: 'ana' };
    const body = { clientName: 'Ana' };
    const data = { id: ID };
    const meta = { page: 1, limit: 10, totalItems: 1, totalPages: 1 };
    mockList.mockResolvedValue({ data: [data], meta });
    mockGet.mockResolvedValue(data);
    mockCreate.mockResolvedValue(data);
    mockAttend.mockResolvedValue(data);

    const listRes = response();
    await controller.list(request({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, data: [data], meta });

    const getRes = response();
    await controller.getById(request(), getRes);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const createRes = response();
    await controller.create(request({ body }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const attendRes = response();
    await controller.attend(request({ user: { id: USER_ID } }), attendRes);
    expect(mockAttend).toHaveBeenCalledWith(ID, USER_ID);
    expect(attendRes.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('rejects unauthenticated attendance', async () => {
    await expect(controller.attend(request(), response())).rejects.toThrow(UnauthorizedError);
    expect(mockAttend).not.toHaveBeenCalled();
  });
});
