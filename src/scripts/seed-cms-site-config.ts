import 'dotenv/config';
import type { CreateContentBlockRequest } from '@bopacorp/shared/catalog';
import { ContentTypeCode } from '@bopacorp/shared/catalog';
import { closeDb, db } from '@lib/db.js';
import { logger } from '@lib/logger.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { contentBlocks, contentTypes } from '../db/schema/catalog.js';

async function getContentTypeId(code: ContentTypeCode): Promise<string> {
  const [row] = await db
    .select({ id: contentTypes.id })
    .from(contentTypes)
    .where(eq(contentTypes.code, code));

  if (!row) {
    throw new Error(`Content type "${code}" not found. Run seed-content-types.ts first.`);
  }

  return row.id;
}

function buildSiteContactBlocks(textId: string): CreateContentBlockRequest[] {
  return [
    {
      contentKey: 'site.contact.phone',
      contentTypeId: textId,
      title: 'Telefono',
      body: '0912345678',
      sortOrder: 900,
    },
    {
      contentKey: 'site.contact.email',
      contentTypeId: textId,
      title: 'Correo electronico',
      body: 'contacto@bopacorp.com',
      sortOrder: 901,
    },
    {
      contentKey: 'site.contact.whatsapp',
      contentTypeId: textId,
      title: 'WhatsApp',
      body: '593912345678',
      sortOrder: 902,
    },
    {
      contentKey: 'site.contact.address',
      contentTypeId: textId,
      title: 'Direccion',
      body: 'Edificio Elite, Piso 3, Of. 308, Guayaquil',
      sortOrder: 903,
    },
  ];
}

async function seed() {
  const textId = await getContentTypeId(ContentTypeCode.TEXT);
  const blocks = buildSiteContactBlocks(textId);

  const existing = await db
    .select({ contentKey: contentBlocks.contentKey })
    .from(contentBlocks)
    .where(
      and(
        isNull(contentBlocks.deletedAt),
        inArray(
          contentBlocks.contentKey,
          blocks.map((b) => b.contentKey)
        )
      )
    );

  const existingKeys = new Set(existing.map((r) => r.contentKey));
  const newBlocks = blocks.filter((b) => !existingKeys.has(b.contentKey));

  if (newBlocks.length === 0) {
    logger.info('All CMS site config blocks already exist, skipping');
    await closeDb();
    return;
  }

  await db.insert(contentBlocks).values(
    newBlocks.map((b) => ({
      contentKey: b.contentKey,
      contentTypeId: b.contentTypeId,
      title: b.title,
      body: b.body,
      sortOrder: b.sortOrder,
    }))
  );

  logger.info({ count: newBlocks.length }, 'Seeded CMS site config blocks');
  await closeDb();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed CMS site config failed');
  process.exit(1);
});
