import crypto from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { env } from '@config/env.js';
import { NotFoundError } from '@shared/errors/http-error.js';

const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.SUPABASE_S3_ENDPOINT,
  credentials: {
    accessKeyId: env.SUPABASE_S3_ACCESS_KEY_ID,
    secretAccessKey: env.SUPABASE_S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const bucket = env.SUPABASE_STORAGE_BUCKET;

export async function uploadFile(path: string, body: Buffer, contentType: string) {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: path,
      Body: body,
      ContentType: contentType,
    },
  });
  return upload.done();
}

export async function downloadFile(path: string) {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: path,
      })
    );
    return response.Body;
  } catch (error) {
    if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') {
      throw new NotFoundError('File', path);
    }
    throw error;
  }
}

export async function deleteFile(path: string) {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: path,
      })
    );
  } catch (error) {
    if (!(error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey')) {
      throw error;
    }
  }
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const r2Bucket = env.R2_BUCKET_NAME;

export async function uploadImage(key: string, body: Buffer, contentType: string) {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: r2Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  });
  return upload.done();
}

export async function deleteImage(key: string) {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: r2Bucket,
        Key: key,
      })
    );
  } catch (error) {
    if (!(error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey')) {
      throw error;
    }
  }
}

export function getPublicImageUrl(key: string) {
  return `${env.R2_PUBLIC_URL}/${key}`;
}

export function buildImageKey(folder: string, filename: string) {
  const sanitized = filename.toLowerCase().replace(/[^a-z0-9.]/g, '-');
  return `${folder}/${crypto.randomUUID()}-${sanitized}`;
}
