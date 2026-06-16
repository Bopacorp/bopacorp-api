import crypto from 'node:crypto';
import { env } from '@config/env.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const key = Buffer.from(env.DOCUMENTS_ENCRYPTION_KEY, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error('DOCUMENTS_ENCRYPTION_KEY must be a 32-byte key base64-encoded');
  }
  return key;
}

export interface EncryptionMetadata {
  iv: string;
  authTag: string;
}

export interface EncryptedFile {
  encryptedBuffer: Buffer;
  metadata: EncryptionMetadata;
}

export function encryptBuffer(buffer: Buffer): EncryptedFile {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer: encrypted,
    metadata: {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    },
  };
}

export function decryptBuffer(encryptedBuffer: Buffer, metadata: EncryptionMetadata): Buffer {
  const iv = Buffer.from(metadata.iv, 'base64');
  const authTag = Buffer.from(metadata.authTag, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid encryption IV length');
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid encryption auth tag length');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}
