import 'dotenv/config';
import { closeDb, db } from '@lib/db.js';
import { contentTypes } from '../db/schema/catalog.js';

const SEED_TYPES = [
  {
    code: 'TEXT',
    name: 'Texto plano',
    description: 'Bloque de contenido de texto sin formato HTML',
  },
  {
    code: 'HTML',
    name: 'HTML',
    description: 'Bloque de contenido con formato HTML libre',
  },
  {
    code: 'IMAGE',
    name: 'Imagen',
    description: 'Bloque de contenido de tipo imagen',
  },
  {
    code: 'BANNER',
    name: 'Banner',
    description: 'Bloque de contenido promocional tipo banner',
  },
  {
    code: 'VIDEO',
    name: 'Video',
    description: 'Bloque de contenido de tipo video',
  },
];

async function seed() {
  console.log('Seeding content types...');

  const result = await db
    .insert(contentTypes)
    .values(SEED_TYPES)
    .onConflictDoNothing({ target: contentTypes.code })
    .returning();

  console.log(`Inserted ${result.length} new content types.`);

  const all = await db.select({ code: contentTypes.code }).from(contentTypes);
  console.log(
    `Total content types in DB: ${all.length}`,
    all.map((t) => t.code)
  );

  await closeDb();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
