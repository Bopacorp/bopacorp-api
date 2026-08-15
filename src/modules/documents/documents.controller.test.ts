import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListDocumentTypes = vi.fn();
const mockGetDocumentTypeById = vi.fn();
const mockCreateDocumentType = vi.fn();
const mockUpdateDocumentType = vi.fn();
const mockRemoveDocumentType = vi.fn();
const mockListDocuments = vi.fn();
const mockGetDocumentById = vi.fn();
const mockCreateDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockRemoveDocument = vi.fn();
const mockChangeDocumentState = vi.fn();
const mockGetPendingSummary = vi.fn();
const mockListDocumentHistory = vi.fn();
const mockDownloadDocument = vi.fn();

vi.mock('./documents.service.js', () => ({
  listDocumentTypes: mockListDocumentTypes,
  getDocumentTypeById: mockGetDocumentTypeById,
  createDocumentType: mockCreateDocumentType,
  updateDocumentType: mockUpdateDocumentType,
  removeDocumentType: mockRemoveDocumentType,
  listDocuments: mockListDocuments,
  getDocumentById: mockGetDocumentById,
  createDocument: mockCreateDocument,
  updateDocument: mockUpdateDocument,
  removeDocument: mockRemoveDocument,
  changeDocumentState: mockChangeDocumentState,
  getPendingSummary: mockGetPendingSummary,
  listDocumentHistory: mockListDocumentHistory,
  downloadDocument: mockDownloadDocument,
}));

const controller = await import('./documents.controller.js');

const DOCUMENT_TYPE_ID = '11111111-1111-1111-1111-111111111111';
const DOCUMENT_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';

function request(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: { id: DOCUMENT_ID }, query: {}, ...overrides } as unknown as Request;
}

function authenticatedRequest(overrides: Record<string, unknown> = {}) {
  return request({ user: { id: USER_ID, roles: [], permissions: [] }, ...overrides });
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

describe('documents controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards all document operations and returns the expected envelopes', async () => {
    const typeQuery = { page: 1, limit: 10, isActive: true };
    const documentQuery = { page: 1, limit: 10, state: 'PENDING_APPROVAL' };
    const historyQuery = { page: 2, limit: 5 };
    const typeBody = { code: 'ID', name: 'Identity' };
    const documentBody = { filename: 'identity.pdf' };
    const stateBody = { state: 'ACCEPTED', coordinatorMessage: 'Approved' };
    const typeData = { id: DOCUMENT_TYPE_ID, code: 'ID' };
    const documentData = { id: DOCUMENT_ID, filename: 'identity.pdf' };
    const listResult = {
      data: [documentData],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    };
    const historyResult = {
      data: [{ id: 'history' }],
      meta: { page: 2, limit: 5, totalItems: 6, totalPages: 2 },
    };
    const archiveBuffer = Buffer.from('pdf');

    mockListDocumentTypes.mockResolvedValue(listResult);
    mockGetDocumentTypeById.mockResolvedValue(typeData);
    mockCreateDocumentType.mockResolvedValue(typeData);
    mockUpdateDocumentType.mockResolvedValue(typeData);
    mockListDocuments.mockResolvedValue(listResult);
    mockGetDocumentById.mockResolvedValue(documentData);
    mockCreateDocument.mockResolvedValue(documentData);
    mockUpdateDocument.mockResolvedValue(documentData);
    mockChangeDocumentState.mockResolvedValue(documentData);
    mockGetPendingSummary.mockResolvedValue([{ advisor: { id: USER_ID }, totalPending: 2 }]);
    mockListDocumentHistory.mockResolvedValue(historyResult);
    mockDownloadDocument.mockResolvedValue({
      buffer: archiveBuffer,
      filename: 'identity.pdf',
      mimeType: 'application/pdf',
    });

    const listTypesRes = response();
    await controller.listDocumentTypes(request({ query: typeQuery }), listTypesRes);
    expect(mockListDocumentTypes).toHaveBeenCalledWith(typeQuery);
    expect(listTypesRes.json).toHaveBeenCalledWith({ success: true, ...listResult });

    const getTypeRes = response();
    await controller.getDocumentTypeById(request({ params: { id: DOCUMENT_TYPE_ID } }), getTypeRes);
    expect(mockGetDocumentTypeById).toHaveBeenCalledWith(DOCUMENT_TYPE_ID);
    expect(getTypeRes.json).toHaveBeenCalledWith({ success: true, data: typeData });

    const createTypeRes = response();
    await controller.createDocumentType(request({ body: typeBody }), createTypeRes);
    expect(mockCreateDocumentType).toHaveBeenCalledWith(typeBody);
    expect(createTypeRes.status).toHaveBeenCalledWith(201);
    expect(createTypeRes.json).toHaveBeenCalledWith({ success: true, data: typeData });

    const updateTypeRes = response();
    await controller.updateDocumentType(
      request({ params: { id: DOCUMENT_TYPE_ID }, body: typeBody }),
      updateTypeRes
    );
    expect(mockUpdateDocumentType).toHaveBeenCalledWith(DOCUMENT_TYPE_ID, typeBody);
    expect(updateTypeRes.json).toHaveBeenCalledWith({ success: true, data: typeData });

    const removeTypeRes = response();
    await controller.removeDocumentType(
      request({ params: { id: DOCUMENT_TYPE_ID } }),
      removeTypeRes
    );
    expect(mockRemoveDocumentType).toHaveBeenCalledWith(DOCUMENT_TYPE_ID);
    expect(removeTypeRes.json).toHaveBeenCalledWith({ success: true, data: null });

    const listRes = response();
    await controller.listDocuments(authenticatedRequest({ query: documentQuery }), listRes);
    expect(mockListDocuments).toHaveBeenCalledWith(
      documentQuery,
      expect.objectContaining({ id: USER_ID })
    );
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...listResult });

    const getRes = response();
    await controller.getDocumentById(authenticatedRequest(), getRes);
    expect(mockGetDocumentById).toHaveBeenCalledWith(
      DOCUMENT_ID,
      expect.objectContaining({ id: USER_ID })
    );
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data: documentData });

    const createRes = response();
    await controller.createDocument(authenticatedRequest({ body: documentBody }), createRes);
    expect(mockCreateDocument).toHaveBeenCalledWith(USER_ID, documentBody);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data: documentData });

    const updateRes = response();
    await controller.updateDocument(request({ body: documentBody }), updateRes);
    expect(mockUpdateDocument).toHaveBeenCalledWith(DOCUMENT_ID, documentBody);
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data: documentData });

    const removeRes = response();
    await controller.removeDocument(request(), removeRes);
    expect(mockRemoveDocument).toHaveBeenCalledWith(DOCUMENT_ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });

    const stateRes = response();
    await controller.changeDocumentState(authenticatedRequest({ body: stateBody }), stateRes);
    expect(mockChangeDocumentState).toHaveBeenCalledWith(DOCUMENT_ID, USER_ID, stateBody);
    expect(stateRes.json).toHaveBeenCalledWith({ success: true, data: documentData });

    const pendingRes = response();
    await controller.getPendingSummary(request(), pendingRes);
    expect(mockGetPendingSummary).toHaveBeenCalledOnce();
    expect(pendingRes.json).toHaveBeenCalledWith({
      success: true,
      data: [{ advisor: { id: USER_ID }, totalPending: 2 }],
    });

    const historyRes = response();
    await controller.listDocumentHistory(
      request({ params: { id: DOCUMENT_ID }, query: historyQuery }),
      historyRes
    );
    expect(mockListDocumentHistory).toHaveBeenCalledWith({
      ...historyQuery,
      documentId: DOCUMENT_ID,
    });
    expect(historyRes.json).toHaveBeenCalledWith({ success: true, ...historyResult });

    const downloadRes = response();
    await controller.downloadDocument(authenticatedRequest(), downloadRes);
    expect(mockDownloadDocument).toHaveBeenCalledWith(
      DOCUMENT_ID,
      expect.objectContaining({ id: USER_ID })
    );
    expect(downloadRes.setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Disposition',
      'attachment; filename="identity.pdf"'
    );
    expect(downloadRes.setHeader).toHaveBeenNthCalledWith(2, 'Content-Type', 'application/pdf');
    expect(downloadRes.setHeader).toHaveBeenNthCalledWith(3, 'Content-Length', '3');
    expect(downloadRes.send).toHaveBeenCalledWith(archiveBuffer);
  });

  it('requires authentication for protected document operations', async () => {
    await expect(controller.listDocuments(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.getDocumentById(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.createDocument(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.changeDocumentState(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.downloadDocument(request(), response())).rejects.toThrow(
      UnauthorizedError
    );

    expect(mockListDocuments).not.toHaveBeenCalled();
    expect(mockGetDocumentById).not.toHaveBeenCalled();
    expect(mockCreateDocument).not.toHaveBeenCalled();
    expect(mockChangeDocumentState).not.toHaveBeenCalled();
    expect(mockDownloadDocument).not.toHaveBeenCalled();
  });

  it('propagates service failures without writing an alternate response', async () => {
    const error = new Error('documents unavailable');
    const res = response();
    mockListDocumentTypes.mockRejectedValue(error);

    await expect(controller.listDocumentTypes(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
