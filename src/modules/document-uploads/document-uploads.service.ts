import crypto from 'node:crypto';
import type { UploadDocumentResponse } from '@bopacorp/shared/document-uploads';
import { env } from '@config/env.js';
import { uploadFile } from '@lib/storage.js';
import { ConflictError } from '@shared/errors/http-error.js';

const MAX_FILE_SIZE_MB = 50;

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.slice(dotIndex + 1).toLowerCase() : '';
}

export async function uploadEncryptedDocument(
  file: Express.Multer.File,
  uploaderId: string
): Promise<UploadDocumentResponse> {
  const { encryptBuffer } = await import('@lib/encryption.js');
  const { encryptedBuffer, metadata } = encryptBuffer(file.buffer);

  const fileExtension = getFileExtension(file.originalname);
  const fileSizeMb = file.size / (1024 * 1024);

  if (fileSizeMb > MAX_FILE_SIZE_MB) {
    throw new ConflictError(`File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB`);
  }

  const sanitizedName = file.originalname
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '-')
    .replace(/-+/g, '-');
  const storagePath = `documents/${uploaderId}/${crypto.randomUUID()}-${sanitizedName}`;

  await uploadFile(storagePath, encryptedBuffer, file.mimetype, env.DOCUMENTS_STORAGE_BUCKET);

  return {
    storagePath,
    filename: file.originalname,
    fileExtension,
    fileSizeMb: Number(fileSizeMb.toFixed(2)),
    mimeType: file.mimetype,
    encryptionMetadata: metadata,
  };
}
