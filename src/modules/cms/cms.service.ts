import { db } from '@lib/db.js';
import { asc, isNull } from 'drizzle-orm';
import { contentBlocks } from '../../db/schema/catalog.js';

const CMS_BLOCK_COLUMNS = {
  id: contentBlocks.id,
  contentKey: contentBlocks.contentKey,
  contentTypeId: contentBlocks.contentTypeId,
  title: contentBlocks.title,
  body: contentBlocks.body,
  sortOrder: contentBlocks.sortOrder,
  createdAt: contentBlocks.createdAt,
  updatedAt: contentBlocks.updatedAt,
};

export async function getPublicBlocks() {
  const blocks = await db
    .select(CMS_BLOCK_COLUMNS)
    .from(contentBlocks)
    .where(isNull(contentBlocks.deletedAt))
    .orderBy(asc(contentBlocks.sortOrder));

  const blocksByKey: Record<string, (typeof blocks)[number]> = {};
  for (const block of blocks) {
    blocksByKey[block.contentKey] = block;
  }

  return { blocks: blocksByKey };
}
