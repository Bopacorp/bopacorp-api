import { BadRequestError, UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockChange = vi.fn();
const mockHistory = vi.fn();
const mockClose = vi.fn();
const mockDownload = vi.fn();

vi.mock('./negotiations.service.js', () => ({
  listNegotiations: mockList,
  getNegotiationById: mockGet,
  createNegotiation: mockCreate,
  updateNegotiation: mockUpdate,
  removeNegotiation: mockRemove,
  changeNegotiationState: mockChange,
  getNegotiationHistory: mockHistory,
  closeWithDocuments: mockClose,
}));
vi.mock('@modules/documents/documents.service.js', () => ({
  downloadNegotiationDocuments: mockDownload,
}));

const ID = '11111111-1111-1111-1111-111111111111';
const USER = { id: '22222222-2222-2222-2222-222222222222', roles: ['advisor'] };
const TYPE = '33333333-3333-4333-8333-333333333333';
const controller = await import('./negotiations.controller.js');

function request(overrides: Record<string, unknown> = {}) {
  return {
    params: { id: ID },
    query: {},
    body: {},
    user: USER,
    ...overrides,
  } as unknown as Request;
}
function response() {
  const res = { json: vi.fn(), status: vi.fn(), setHeader: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('negotiations controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards list, detail, create, update, remove, state and history with success envelopes', async () => {
    const query = { page: 2, limit: 5 };
    const body = { observations: 'note' };
    mockList.mockResolvedValue({
      data: [{ id: ID }],
      meta: { page: 2, limit: 5, totalItems: 1, totalPages: 1 },
    });
    const list = response();
    await controller.listNegotiations(request({ query }), list);
    expect(mockList).toHaveBeenCalledWith(query, USER);
    expect(list.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, meta: expect.any(Object) })
    );
    mockGet.mockResolvedValue({ id: ID });
    const get = response();
    await controller.getNegotiationById(request(), get);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(get.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
    mockCreate.mockResolvedValue({ id: ID });
    const create = response();
    await controller.createNegotiation(request({ body }), create);
    expect(mockCreate).toHaveBeenCalledWith(USER.id, body);
    expect(create.status).toHaveBeenCalledWith(201);
    expect(create.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
    mockUpdate.mockResolvedValue({ id: ID });
    const update = response();
    await controller.updateNegotiation(request({ body }), update);
    expect(mockUpdate).toHaveBeenCalledWith(ID, body);
    expect(update.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
    const remove = response();
    await controller.removeNegotiation(request(), remove);
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(remove.json).toHaveBeenCalledWith({ success: true, data: null });
    mockChange.mockResolvedValue({ id: ID });
    const change = response();
    await controller.changeNegotiationState(request({ body }), change);
    expect(mockChange).toHaveBeenCalledWith(ID, USER.id, body);
    expect(change.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
    mockHistory.mockResolvedValue([{ id: 'history' }]);
    const history = response();
    await controller.getNegotiationHistory(request(), history);
    expect(mockHistory).toHaveBeenCalledWith(ID);
    expect(history.json).toHaveBeenCalledWith({ success: true, data: [{ id: 'history' }] });
  });

  it('normalizes close type IDs and validates files/body before forwarding', async () => {
    const files = [{ originalname: 'file.pdf' }];
    mockClose.mockResolvedValue({ id: ID });
    const res = response();
    await controller.closeWithDocuments(
      request({ files, body: { documentTypeIds: TYPE, notes: 'ready' } }),
      res
    );
    expect(mockClose).toHaveBeenCalledWith(ID, USER, files, [TYPE], 'ready');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: ID } });
    await expect(controller.closeWithDocuments(request({ files: [] }), response())).rejects.toThrow(
      BadRequestError
    );
    await expect(
      controller.closeWithDocuments(
        request({ files, body: { documentTypeIds: ['invalid'] } }),
        response()
      )
    ).rejects.toThrow();
  });

  it('streams downloads with the requested status and correct zip headers', async () => {
    const archive = { pipe: vi.fn() };
    mockDownload.mockResolvedValue({ archive, negotiationId: ID });
    const res = response();
    await controller.downloadDocuments(request({ query: { status: 'APPROVED' } }), res);
    expect(mockDownload).toHaveBeenCalledWith(ID, USER, 'APPROVED');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="documentos_${ID}.zip"`
    );
    expect(archive.pipe).toHaveBeenCalledWith(res);
  });

  it.each([
    [controller.listNegotiations, { user: undefined }],
    [controller.createNegotiation, { user: undefined }],
    [controller.changeNegotiationState, { user: undefined }],
    [controller.closeWithDocuments, { user: undefined }],
    [controller.downloadDocuments, { user: undefined }],
  ])('rejects authenticated handlers without a user', async (handler, overrides) => {
    await expect(handler(request(overrides), response())).rejects.toThrow(UnauthorizedError);
  });

  it('allows the handlers whose authorization is route middleware responsibility to forward without a user', async () => {
    mockGet.mockResolvedValue({ id: ID });
    mockUpdate.mockResolvedValue({ id: ID });
    mockHistory.mockResolvedValue([]);
    const get = response();
    await controller.getNegotiationById(request({ user: undefined }), get);
    const update = response();
    await controller.updateNegotiation(request({ user: undefined }), update);
    const remove = response();
    await controller.removeNegotiation(request({ user: undefined }), remove);
    const history = response();
    await controller.getNegotiationHistory(request({ user: undefined }), history);
    expect(mockGet).toHaveBeenCalledWith(ID);
    expect(mockUpdate).toHaveBeenCalledWith(ID, {});
    expect(mockRemove).toHaveBeenCalledWith(ID);
    expect(mockHistory).toHaveBeenCalledWith(ID);
  });

  it('propagates service errors without emitting an envelope', async () => {
    const error = new Error('failed');
    mockUpdate.mockRejectedValue(error);
    const res = response();
    await expect(controller.updateNegotiation(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
