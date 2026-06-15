import { env } from '@config/env.js';
import { contentBlocks } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { buildImageKey, deleteImage, getPublicImageUrl, uploadImage } from '@lib/storage.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, isNull } from 'drizzle-orm';

export async function uploadLandingImage(
  file: Express.Multer.File,
  contentKey: string | undefined,
  userId: string
) {
  if (contentKey) {
    await getContentBlockByKey(contentKey);
  }

  const key = buildImageKey('landing', file.originalname);
  await uploadImage(key, file.buffer, file.mimetype);
  const url = getPublicImageUrl(key);

  if (contentKey) {
    const block = await getContentBlockByKey(contentKey);
    await deletePreviousImage(block, key);
    await updateContentBlockBody(block, url, userId);
  }

  return {
    url,
    key,
    contentKey,
  };
}

function extractKeyFromPublicUrl(url: string): string | null {
  const prefix = `${env.R2_PUBLIC_URL}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

async function getContentBlockByKey(contentKey: string) {
  const block = await db.query.contentBlocks.findFirst({
    where: and(eq(contentBlocks.contentKey, contentKey), isNull(contentBlocks.deletedAt)),
  });

  if (!block) {
    throw new NotFoundError('Content block', contentKey);
  }

  return block;
}

async function deletePreviousImage(
  block: NonNullable<Awaited<ReturnType<typeof getContentBlockByKey>>>,
  newKey: string
) {
  if (!block.body) return;

  const oldKey = extractKeyFromPublicUrl(block.body);
  if (oldKey && oldKey !== newKey) {
    await deleteImage(oldKey).catch(() => undefined);
  }
}

async function updateContentBlockBody(
  block: NonNullable<Awaited<ReturnType<typeof getContentBlockByKey>>>,
  url: string,
  userId: string
) {
  await db
    .update(contentBlocks)
    .set({
      body: url,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(contentBlocks.id, block.id));
}
