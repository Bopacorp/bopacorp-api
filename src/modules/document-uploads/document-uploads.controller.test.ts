import { BadRequestError, UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUploadEncryptedDocument = vi.fn();
vi.mock('./document-uploads.service.js', () => ({
  uploadEncryptedDocument: mockUploadEncryptedDocument,
}));

const controller = await import('./document-uploads.controller.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';

function response() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

function file() {
  return {
    originalname: 'contract.pdf',
    buffer: Buffer.from('document'),
    mimetype: 'application/pdf',
  } as Express.Multer.File;
}

describe('document-uploads controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires a document file before authenticating the request', async () => {
    await expect(controller.uploadDocument({} as unknown as Request, response())).rejects.toThrow(
      BadRequestError
    );
    expect(mockUploadEncryptedDocument).not.toHaveBeenCalled();
  });

  it('requires authentication when a document file is present', async () => {
    await expect(
      controller.uploadDocument({ file: file() } as unknown as Request, response())
    ).rejects.toThrow(UnauthorizedError);
    expect(mockUploadEncryptedDocument).not.toHaveBeenCalled();
  });

  it('forwards the file and user, then returns the upload response with status 201', async () => {
    const uploaded = {
      storagePath: 'documents/user/uuid-contract.pdf',
      filename: 'contract.pdf',
      fileExtension: 'pdf',
      fileSizeMb: 0.01,
      mimeType: 'application/pdf',
      encryptionMetadata: { iv: 'iv', authTag: 'tag' },
    };
    const uploadedFile = file();
    mockUploadEncryptedDocument.mockResolvedValueOnce(uploaded);
    const res = response();

    await controller.uploadDocument(
      { file: uploadedFile, user: { id: USER_ID } } as unknown as Request,
      res
    );

    expect(mockUploadEncryptedDocument).toHaveBeenCalledWith(uploadedFile, USER_ID);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: uploaded });
  });

  it('propagates service failures', async () => {
    const serviceError = new Error('upload failed');
    mockUploadEncryptedDocument.mockRejectedValueOnce(serviceError);

    await expect(
      controller.uploadDocument(
        { file: file(), user: { id: USER_ID } } as unknown as Request,
        response()
      )
    ).rejects.toBe(serviceError);
  });
});
