import 'dotenv/config';
import { ContentTypeCode } from '@bopacorp/shared/catalog';
import { contentTypes } from '@db/schema/catalog.js';
import { closeDb, db } from '@lib/db.js';

const SEED_TYPES = [
  {
    code: ContentTypeCode.TEXT,
    name: 'Texto plano',
    description: 'Bloque de contenido de texto sin formato HTML',
  },
  {
    code: ContentTypeCode.HTML,
    name: 'HTML',
    description: 'Bloque de contenido con formato HTML libre',
  },
  {
    code: ContentTypeCode.IMAGE,
    name: 'Imagen',
    description: 'Bloque de contenido de tipo imagen',
  },
  {
    code: ContentTypeCode.BANNER,
    name: 'Banner',
    description: 'Bloque de contenido promocional tipo banner',
  },
  {
    code: ContentTypeCode.VIDEO,
    name: 'Video',
    description: 'Bloque de contenido de tipo video',
  },
];

async function seed() {
  await db
    .insert(contentTypes)
    .values(SEED_TYPES)
    .onConflictDoNothing({ target: contentTypes.code });

  await closeDb();
}

seed().catch((_err) => {
  process.exit(1);
});
