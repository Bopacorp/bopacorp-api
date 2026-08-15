import { ConflictError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEncryptBuffer, mockRandomUUID, mockUploadFile } = vi.hoisted(() => ({
  mockEncryptBuffer: vi.fn(),
  mockRandomUUID: vi.fn(),
  mockUploadFile: vi.fn(),
}));

vi.mock('@config/env.js', () => ({
  env: { DOCUMENTS_STORAGE_BUCKET: 'documents-test-bucket' },
}));
vi.mock('@lib/encryption.js', () => ({ encryptBuffer: mockEncryptBuffer }));
vi.mock('@lib/storage.js', () => ({ uploadFile: mockUploadFile }));
vi.mock('node:crypto', () => ({ default: { randomUUID: mockRandomUUID } }));

const service = await import('./document-uploads.service.js');

const UPLOADER_ID = '11111111-1111-1111-1111-111111111111';
const RANDOM_UUID = '22222222-2222-2222-2222-222222222222';
const encryptedBuffer = Buffer.from('encrypted-content');
const encryptionMetadata = { iv: 'encoded-iv', authTag: 'encoded-auth-tag' };

function documentFile(overrides: Partial<Express.Multer.File> = {}) {
  return {
    fieldname: 'file',
    originalname: 'My Contract (Final) 2026.PDF',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1.23456 * 1024 * 1024,
    destination: '',
    filename: '',
    path: '',
    buffer: Buffer.from('plain-content'),
    stream: undefined,
    ...overrides,
  } as Express.Multer.File;
}

describe('document-uploads service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEncryptBuffer.mockReturnValue({ encryptedBuffer, metadata: encryptionMetadata });
    mockRandomUUID.mockReturnValue(RANDOM_UUID);
    mockUploadFile.mockResolvedValue(undefined);
  });

  it('encrypts, sanitizes, uploads, and returns document metadata', async () => {
    const file = documentFile();

    await expect(service.uploadEncryptedDocument(file, UPLOADER_ID)).resolves.toEqual({
      storagePath: `documents/${UPLOADER_ID}/${RANDOM_UUID}-my-contract-final-2026.pdf`,
      filename: file.originalname,
      fileExtension: 'pdf',
      fileSizeMb: 1.23,
      mimeType: file.mimetype,
      encryptionMetadata,
    });

    expect(mockEncryptBuffer).toHaveBeenCalledWith(file.buffer);
    expect(mockRandomUUID).toHaveBeenCalledOnce();
    expect(mockUploadFile).toHaveBeenCalledWith(
      `documents/${UPLOADER_ID}/${RANDOM_UUID}-my-contract-final-2026.pdf`,
      encryptedBuffer,
      file.mimetype,
      'documents-test-bucket'
    );
  });

  it('accepts a file exactly at the 50 MB limit', async () => {
    const file = documentFile({
      originalname: 'contract',
      size: 50 * 1024 * 1024,
      mimetype: 'text/plain',
    });

    await expect(service.uploadEncryptedDocument(file, UPLOADER_ID)).resolves.toEqual(
      expect.objectContaining({
        fileExtension: '',
        fileSizeMb: 50,
        mimeType: 'text/plain',
      })
    );
    expect(mockUploadFile).toHaveBeenCalledOnce();
  });

  it('rejects files larger than 50 MB before uploading', async () => {
    const file = documentFile({ size: 50 * 1024 * 1024 + 1 });

    await expect(service.uploadEncryptedDocument(file, UPLOADER_ID)).rejects.toThrow(
      new ConflictError('File exceeds maximum size of 50MB')
    );
    expect(mockUploadFile).not.toHaveBeenCalled();
    expect(mockRandomUUID).not.toHaveBeenCalled();
  });

  it('propagates encryption failures without uploading', async () => {
    const encryptionError = new Error('encryption failed');
    mockEncryptBuffer.mockImplementationOnce(() => {
      throw encryptionError;
    });

    await expect(service.uploadEncryptedDocument(documentFile(), UPLOADER_ID)).rejects.toBe(
      encryptionError
    );
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('propagates storage failures after encryption', async () => {
    const storageError = new Error('storage failed');
    mockUploadFile.mockRejectedValueOnce(storageError);

    await expect(service.uploadEncryptedDocument(documentFile(), UPLOADER_ID)).rejects.toBe(
      storageError
    );
    expect(mockEncryptBuffer).toHaveBeenCalledOnce();
    expect(mockRandomUUID).toHaveBeenCalledOnce();
  });
});
