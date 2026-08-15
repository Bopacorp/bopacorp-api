import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListOfferMatrices = vi.fn();
const mockGetOfferMatrixById = vi.fn();
const mockCreateOfferMatrix = vi.fn();
const mockUpdateOfferMatrix = vi.fn();
const mockRemoveOfferMatrix = vi.fn();
const mockListMatrixAttachments = vi.fn();
const mockCreateMatrixAttachment = vi.fn();
const mockDownloadMatrixAttachment = vi.fn();
const mockRemoveMatrixAttachment = vi.fn();

vi.mock('./matrices.service.js', () => ({
  listOfferMatrices: mockListOfferMatrices,
  getOfferMatrixById: mockGetOfferMatrixById,
  createOfferMatrix: mockCreateOfferMatrix,
  updateOfferMatrix: mockUpdateOfferMatrix,
  removeOfferMatrix: mockRemoveOfferMatrix,
  listMatrixAttachments: mockListMatrixAttachments,
  createMatrixAttachment: mockCreateMatrixAttachment,
  downloadMatrixAttachment: mockDownloadMatrixAttachment,
  removeMatrixAttachment: mockRemoveMatrixAttachment,
}));

const controller = await import('./matrices.controller.js');

const MATRIX_ID = '11111111-1111-1111-1111-111111111111';
const ATTACHMENT_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';

function request(overrides: Record<string, unknown> = {}) {
  return {
    params: { id: MATRIX_ID, attachmentId: ATTACHMENT_ID },
    query: { page: 1, limit: 10 },
    body: {},
    ...overrides,
  } as unknown as Request;
}

function response() {
  const res = {
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('matrices controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards matrix list/detail/create/update/remove operations', async () => {
    const query = { page: 2, limit: 5, search: 'proposal' };
    const body = { negotiationId: MATRIX_ID, observations: 'Proposal' };
    const data = { id: MATRIX_ID };
    const list = { data: [data], meta: { page: 2, limit: 5, totalItems: 1, totalPages: 1 } };
    mockListOfferMatrices.mockResolvedValueOnce(list);
    mockGetOfferMatrixById.mockResolvedValueOnce(data);
    mockCreateOfferMatrix.mockResolvedValueOnce(data);
    mockUpdateOfferMatrix.mockResolvedValueOnce(data);

    const listRes = response();
    await controller.listOfferMatrices(request({ query }), listRes);
    expect(mockListOfferMatrices).toHaveBeenCalledWith(query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...list });

    const getRes = response();
    await controller.getOfferMatrixById(request(), getRes);
    expect(mockGetOfferMatrixById).toHaveBeenCalledWith(MATRIX_ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const createRes = response();
    await controller.createOfferMatrix(request({ body, user: { id: USER_ID } }), createRes);
    expect(mockCreateOfferMatrix).toHaveBeenCalledWith(USER_ID, body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const updateRes = response();
    await controller.updateOfferMatrix(request({ body: { observations: 'Updated' } }), updateRes);
    expect(mockUpdateOfferMatrix).toHaveBeenCalledWith(MATRIX_ID, { observations: 'Updated' });
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data });

    const removeRes = response();
    await controller.removeOfferMatrix(request(), removeRes);
    expect(mockRemoveOfferMatrix).toHaveBeenCalledWith(MATRIX_ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('requires authentication for matrix creation', async () => {
    await expect(controller.createOfferMatrix(request({ body: {} }), response())).rejects.toThrow(
      UnauthorizedError
    );
    expect(mockCreateOfferMatrix).not.toHaveBeenCalled();
  });

  it('forwards attachment list/create/remove operations with nested IDs', async () => {
    const query = { page: 2, limit: 5 };
    const body = {
      attachmentType: 'OFFER_MATRIX',
      filename: 'proposal.pdf',
      fileExtension: 'pdf',
      fileSizeMb: 2.5,
      storagePath: 'matrices/proposal.pdf',
      mimeType: 'application/pdf',
    };
    const data = { id: ATTACHMENT_ID };
    const list = { data: [data], meta: { page: 2, limit: 5, totalItems: 1, totalPages: 1 } };
    mockListMatrixAttachments.mockResolvedValueOnce(list);
    mockCreateMatrixAttachment.mockResolvedValueOnce(data);

    const listRes = response();
    await controller.listMatrixAttachments(request({ query }), listRes);
    expect(mockListMatrixAttachments).toHaveBeenCalledWith({ ...query, matrixId: MATRIX_ID });
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...list });

    const createRes = response();
    await controller.createMatrixAttachment(request({ body, user: { id: USER_ID } }), createRes);
    expect(mockCreateMatrixAttachment).toHaveBeenCalledWith(USER_ID, {
      ...body,
      matrixId: MATRIX_ID,
    });
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const removeRes = response();
    await controller.removeMatrixAttachment(request(), removeRes);
    expect(mockRemoveMatrixAttachment).toHaveBeenCalledWith(ATTACHMENT_ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('requires authentication for attachment creation', async () => {
    await expect(
      controller.createMatrixAttachment(request({ body: {} }), response())
    ).rejects.toThrow(UnauthorizedError);
    expect(mockCreateMatrixAttachment).not.toHaveBeenCalled();
  });

  it('downloads attachments with the expected response headers', async () => {
    const buffer = Buffer.from('attachment');
    mockDownloadMatrixAttachment.mockResolvedValueOnce({
      buffer,
      filename: 'proposal.pdf',
      mimeType: 'application/pdf',
    });
    const res = response();

    await controller.downloadMatrixAttachment(request(), res);

    expect(mockDownloadMatrixAttachment).toHaveBeenCalledWith(ATTACHMENT_ID);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="proposal.pdf"'
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', buffer.length.toString());
    expect(res.send).toHaveBeenCalledWith(buffer);
  });

  it('propagates service failures without writing a response', async () => {
    const error = new Error('matrix failed');
    mockListOfferMatrices.mockRejectedValueOnce(error);
    const res = response();

    await expect(controller.listOfferMatrices(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
