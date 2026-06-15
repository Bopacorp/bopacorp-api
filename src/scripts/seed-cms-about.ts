import 'dotenv/config';
import type { CreateContentBlockRequest } from '@bopacorp/shared/catalog';
import { ContentTypeCode } from '@bopacorp/shared/catalog';
import { closeDb, db } from '@lib/db.js';
import { logger } from '@lib/logger.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { contentBlocks, contentTypes } from '../db/schema/catalog.js';

type ContentTypeIds = Record<ContentTypeCode.TEXT, string>;

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

function buildHeroBlocks(textId: string): CreateContentBlockRequest[] {
  return [
    {
      contentKey: 'about_page.hero.eyebrow',
      contentTypeId: textId,
      title: 'Hero - Eyebrow',
      body: '¿Quienes somos?',
      sortOrder: 100,
    },
    {
      contentKey: 'about_page.hero.title',
      contentTypeId: textId,
      title: 'Hero - Titulo',
      body: 'Líderes en telecomunicaciones empresariales',
      sortOrder: 101,
    },
    {
      contentKey: 'about_page.hero.highlight',
      contentTypeId: textId,
      title: 'Hero - Highlight',
      body: 'empresariales',
      sortOrder: 102,
    },
    {
      contentKey: 'about_page.hero.description',
      contentTypeId: textId,
      title: 'Hero - Descripcion',
      body: 'Con más de 7 años transformando la conectividad de negocios en toda la región, construyendo el futuro digital del Ecuador.',
      sortOrder: 103,
    },
  ];
}

function buildHistoryBlocks(textId: string): CreateContentBlockRequest[] {
  return [
    {
      contentKey: 'about_page.history.title',
      contentTypeId: textId,
      title: 'Historia - Titulo',
      body: 'Nuestra Historia',
      sortOrder: 110,
    },
    {
      contentKey: 'about_page.history.paragraph_1',
      contentTypeId: textId,
      title: 'Historia - Parrafo 1',
      body: 'Fundada en 2019 con la visión de revolucionar las telecomunicaciones empresariales en Ecuador. Desde nuestros inicios en Guayaquil, nos hemos enfocado en ofrecer soluciones de conectividad robustas y confiables para empresas de todos los tamaños como Partners oficiales de Movistar.',
      sortOrder: 111,
    },
    {
      contentKey: 'about_page.history.paragraph_2',
      contentTypeId: textId,
      title: 'Historia - Parrafo 2',
      body: 'A lo largo de los años, hemos expandido nuestra red de cobertura, incorporado tecnologías de última generación y construido relaciones duraderas con cientos de empresas que confían en nosotros para mantener sus operaciones activas 24/7 sin interrupciones.',
      sortOrder: 112,
    },
  ];
}

function buildMissionVisionBlocks(textId: string): CreateContentBlockRequest[] {
  return [
    {
      contentKey: 'about_page.mission.title',
      contentTypeId: textId,
      title: 'Mision - Titulo',
      body: 'Nuestra Misión',
      sortOrder: 120,
    },
    {
      contentKey: 'about_page.mission.body',
      contentTypeId: textId,
      title: 'Mision - Cuerpo',
      body: 'Proveer soluciones de telecomunicaciones integrales que impulsen el crecimiento y la eficiencia operativa de nuestros clientes empresariales, garantizando conectividad de clase mundial con el mejor soporte técnico.',
      sortOrder: 121,
    },
    {
      contentKey: 'about_page.vision.title',
      contentTypeId: textId,
      title: 'Vision - Titulo',
      body: 'Nuestra Visión',
      sortOrder: 122,
    },
    {
      contentKey: 'about_page.vision.body',
      contentTypeId: textId,
      title: 'Vision - Cuerpo',
      body: 'Ser la empresa líder en telecomunicaciones corporativas en la región, reconocida por nuestra innovación tecnológica, excelencia en servicio y capacidad para adaptarnos a las necesidades del mercado.',
      sortOrder: 123,
    },
  ];
}

function buildValuesBlocks(textId: string): CreateContentBlockRequest[] {
  return [
    {
      contentKey: 'about_page.values.title',
      contentTypeId: textId,
      title: 'Valores - Titulo',
      body: 'Nuestros Valores',
      sortOrder: 130,
    },
    {
      contentKey: 'about_page.values.item_1_title',
      contentTypeId: textId,
      title: 'Valor 1 - Titulo',
      body: 'Innovación',
      sortOrder: 131,
    },
    {
      contentKey: 'about_page.values.item_1_desc',
      contentTypeId: textId,
      title: 'Valor 1 - Descripcion',
      body: 'Buscamos constantemente nuevas tecnologías para mantener a nuestros clientes corporativos siempre a la vanguardia.',
      sortOrder: 132,
    },
    {
      contentKey: 'about_page.values.item_2_title',
      contentTypeId: textId,
      title: 'Valor 2 - Titulo',
      body: 'Confianza',
      sortOrder: 133,
    },
    {
      contentKey: 'about_page.values.item_2_desc',
      contentTypeId: textId,
      title: 'Valor 2 - Descripcion',
      body: 'Construimos relaciones transparentes y duraderas basadas en la seguridad de nuestra red y el respaldo técnico.',
      sortOrder: 134,
    },
    {
      contentKey: 'about_page.values.item_3_title',
      contentTypeId: textId,
      title: 'Valor 3 - Titulo',
      body: 'Excelencia',
      sortOrder: 135,
    },
    {
      contentKey: 'about_page.values.item_3_desc',
      contentTypeId: textId,
      title: 'Valor 3 - Descripcion',
      body: 'Nos exigimos el más alto nivel de calidad en cada enlace, instalación y atención al cliente.',
      sortOrder: 136,
    },
  ];
}

const buildBlocks = (typeIds: ContentTypeIds): CreateContentBlockRequest[] => [
  ...buildHeroBlocks(typeIds.TEXT),
  ...buildHistoryBlocks(typeIds.TEXT),
  ...buildMissionVisionBlocks(typeIds.TEXT),
  ...buildValuesBlocks(typeIds.TEXT),
];

async function seed() {
  const typeIds: ContentTypeIds = {
    TEXT: await getContentTypeId(ContentTypeCode.TEXT),
  };

  const blocks = buildBlocks(typeIds);

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
    logger.info('All CMS about blocks already exist, skipping');
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

  logger.info({ count: newBlocks.length }, 'Seeded CMS about blocks');
  await closeDb();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed CMS about failed');
  process.exit(1);
});
