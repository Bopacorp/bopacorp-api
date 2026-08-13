import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListBusinessClients = vi.fn();
const mockGetBusinessClientById = vi.fn();
const mockCreateBusinessClient = vi.fn();
const mockUpdateBusinessClient = vi.fn();
const mockRemoveBusinessClient = vi.fn();

vi.mock('./business-clients.service.js', () => ({
  listBusinessClients: mockListBusinessClients,
  getBusinessClientById: mockGetBusinessClientById,
  createBusinessClient: mockCreateBusinessClient,
  updateBusinessClient: mockUpdateBusinessClient,
  removeBusinessClient: mockRemoveBusinessClient,
}));

const controller = await import('./business-clients.controller.js');
const CLIENT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function createResponse() {
  const response = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: { id: CLIENT_ID }, query: {}, ...overrides } as unknown as Request;
}

describe('business clients controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns list and detail success envelopes and forwards exact query and id', async () => {
    const query = { page: 2, limit: 5, search: 'acme' };
    const list = {
      data: [{ id: CLIENT_ID }],
      meta: { page: 2, limit: 5, totalItems: 1, totalPages: 1 },
    };
    mockListBusinessClients.mockResolvedValue(list);
    const listReq = createRequest({ query, user: { id: USER_ID, roles: ['advisor'] } });
    const listRes = createResponse();
    await controller.listBusinessClients(listReq, listRes);
    expect(mockListBusinessClients).toHaveBeenCalledWith(query, listReq.user);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...list });

    mockGetBusinessClientById.mockResolvedValue({ id: CLIENT_ID });
    const detailRes = createResponse();
    await controller.getBusinessClientById(createRequest(), detailRes);
    expect(mockGetBusinessClientById).toHaveBeenCalledWith(CLIENT_ID);
    expect(detailRes.json).toHaveBeenCalledWith({ success: true, data: { id: CLIENT_ID } });
  });

  it('returns create, update, and remove envelopes with exact forwarding', async () => {
    const body = { ruc: '0990000001001', businessName: 'Acme' };
    mockCreateBusinessClient.mockResolvedValue({ id: CLIENT_ID });
    const createRes = createResponse();
    await controller.createBusinessClient(
      createRequest({ body, user: { id: USER_ID } }),
      createRes
    );
    expect(mockCreateBusinessClient).toHaveBeenCalledWith(body, USER_ID);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data: { id: CLIENT_ID } });

    mockUpdateBusinessClient.mockResolvedValue({ id: CLIENT_ID, businessName: 'Updated' });
    const updateRes = createResponse();
    await controller.updateBusinessClient(
      createRequest({ body: { businessName: 'Updated' } }),
      updateRes
    );
    expect(mockUpdateBusinessClient).toHaveBeenCalledWith(CLIENT_ID, { businessName: 'Updated' });
    expect(updateRes.json).toHaveBeenCalledWith({
      success: true,
      data: { id: CLIENT_ID, businessName: 'Updated' },
    });

    const removeRes = createResponse();
    await controller.removeBusinessClient(createRequest(), removeRes);
    expect(mockRemoveBusinessClient).toHaveBeenCalledWith(CLIENT_ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it.each([
    ['list', controller.listBusinessClients, mockListBusinessClients],
    ['create', controller.createBusinessClient, mockCreateBusinessClient],
  ])('rejects unauthenticated %s before service invocation', async (_name, action, service) => {
    await expect(action(createRequest(), createResponse())).rejects.toThrow(UnauthorizedError);
    expect(service).not.toHaveBeenCalled();
  });

  it.each([
    [
      'list',
      controller.listBusinessClients,
      mockListBusinessClients,
      createRequest({ user: { id: USER_ID, roles: ['advisor'] } }),
    ],
    [
      'create',
      controller.createBusinessClient,
      mockCreateBusinessClient,
      createRequest({ user: { id: USER_ID } }),
    ],
    ['update', controller.updateBusinessClient, mockUpdateBusinessClient, createRequest()],
    ['remove', controller.removeBusinessClient, mockRemoveBusinessClient, createRequest()],
  ])('propagates rejected %s service failures without changing the response', async (_name, action, service, request) => {
    const error = new Error('service failed');
    service.mockRejectedValue(error);
    const response = createResponse();
    await expect(action(request, response)).rejects.toBe(error);
    expect(response.json).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('propagates rejected detail service failures without changing the response', async () => {
    const error = new Error('detail failed');
    mockGetBusinessClientById.mockRejectedValue(error);
    const response = createResponse();
    await expect(controller.getBusinessClientById(createRequest(), response)).rejects.toBe(error);
    expect(response.json).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });
});
