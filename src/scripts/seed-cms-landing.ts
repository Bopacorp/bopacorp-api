import 'dotenv/config';
import type { CreateContentBlockRequest } from '@bopacorp/shared/catalog';
import { ContentTypeCode } from '@bopacorp/shared/catalog';
import { closeDb, db } from '@lib/db.js';
import { logger } from '@lib/logger.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { contentBlocks, contentTypes } from '../db/schema/catalog.js';

type TextTypeId = Record<ContentTypeCode.TEXT, string>;

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
      contentKey: 'hero.title',
      contentTypeId: textId,
      title: 'Hero - Título',
      body: 'Conectividad que impulsa tu negocio',
      sortOrder: 10,
    },
    {
      contentKey: 'hero.highlight',
      contentTypeId: textId,
      title: 'Hero - Resaltado',
      body: 'impulsa',
      sortOrder: 20,
    },
    {
      contentKey: 'hero.description',
      contentTypeId: textId,
      title: 'Hero - Descripción',
      body: 'Conectamos tu negocio con tecnología de punta. Planes corporativos, conectividad de alta velocidad y servicios digitales diseñados para impulsar tu empresa.',
      sortOrder: 30,
    },
    {
      contentKey: 'hero.cta_primary_label',
      contentTypeId: textId,
      title: 'Hero - CTA Primario',
      body: 'Ver catálogo de servicios',
      sortOrder: 40,
    },
    {
      contentKey: 'hero.cta_secondary_label',
      contentTypeId: textId,
      title: 'Hero - CTA Secundario',
      body: 'Conoce más',
      sortOrder: 50,
    },
  ];
}

function buildAboutBlocks(textId: string): CreateContentBlockRequest[] {
  return [
    {
      contentKey: 'about.eyebrow',
      contentTypeId: textId,
      title: 'About - Etiqueta',
      body: 'Por qué Bopacorp',
      sortOrder: 110,
    },
    {
      contentKey: 'about.title',
      contentTypeId: textId,
      title: 'About - Título',
      body: 'Más que un proveedor, un aliado tecnológico',
      sortOrder: 120,
    },
    {
      contentKey: 'about.description',
      contentTypeId: textId,
      title: 'About - Descripción',
      body: 'Como Partner de una de las empresas de telecomunicaciones más grandes de Ecuador, en Bohorquez & Pauta Corp (Bopacorp S.A.) innovamos desde nuestra matriz en Guayaquil para brindar soluciones integradas de conectividad, equipos informáticos y tecnología celular a nivel nacional.',
      sortOrder: 130,
    },
    {
      contentKey: 'about.feature_1_title',
      contentTypeId: textId,
      title: 'About - Feature 1 Título',
      body: 'Asesoría Corporativa Personalizada',
      sortOrder: 140,
    },
    {
      contentKey: 'about.feature_1_desc',
      contentTypeId: textId,
      title: 'About - Feature 1 Descripción',
      body: 'No vendemos planes genéricos. Analizamos la infraestructura de tu empresa para diseñar una solución a la medida de tus necesidades de comunicación y presupuesto.',
      sortOrder: 150,
    },
    {
      contentKey: 'about.feature_2_title',
      contentTypeId: textId,
      title: 'About - Feature 2 Título',
      body: 'Garantía de Continuidad y Conectividad',
      sortOrder: 160,
    },
    {
      contentKey: 'about.feature_2_desc',
      contentTypeId: textId,
      title: 'About - Feature 2 Descripción',
      body: 'Aseguramos la operación de tu negocio con enlaces dedicados de fibra óptica y redes móviles de alta velocidad respaldadas por la infraestructura más robusta del país.',
      sortOrder: 170,
    },
    {
      contentKey: 'about.feature_3_title',
      contentTypeId: textId,
      title: 'About - Feature 3 Título',
      body: 'Soporte Técnico Especializado',
      sortOrder: 180,
    },
    {
      contentKey: 'about.feature_3_desc',
      contentTypeId: textId,
      title: 'About - Feature 3 Descripción',
      body: 'Acompañamos el crecimiento de tus proyectos con un equipo de atención dedicado a resolver incidencias rápidamente, garantizando la estabilidad de tus sistemas.',
      sortOrder: 190,
    },
  ];
}

function buildCtaBlocks(textId: string): CreateContentBlockRequest[] {
  return [
    {
      contentKey: 'cta.eyebrow',
      contentTypeId: textId,
      title: 'CTA - Etiqueta',
      body: '¿Listo para conectar tu empresa?',
      sortOrder: 210,
    },
    {
      contentKey: 'cta.title',
      contentTypeId: textId,
      title: 'CTA - Título',
      body: 'Impulsa tu negocio con conectividad real',
      sortOrder: 220,
    },
    {
      contentKey: 'cta.highlight',
      contentTypeId: textId,
      title: 'CTA - Resaltado',
      body: 'conectividad real',
      sortOrder: 230,
    },
    {
      contentKey: 'cta.description',
      contentTypeId: textId,
      title: 'CTA - Descripción',
      body: 'Habla con uno de nuestros asesores y encuentra el plan corporativo ideal para tu empresa. Sin compromisos.',
      sortOrder: 240,
    },
    {
      contentKey: 'cta.primary_label',
      contentTypeId: textId,
      title: 'CTA - Botón Primario',
      body: 'Cotizar Ahora',
      sortOrder: 250,
    },
    {
      contentKey: 'cta.secondary_label',
      contentTypeId: textId,
      title: 'CTA - Botón Secundario',
      body: 'Ver Planes',
      sortOrder: 260,
    },
  ];
}

const buildBlocks = (typeIds: TextTypeId): CreateContentBlockRequest[] => [
  ...buildHeroBlocks(typeIds.TEXT),
  ...buildAboutBlocks(typeIds.TEXT),
  ...buildCtaBlocks(typeIds.TEXT),
];

async function seed() {
  const typeIds: TextTypeId = {
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
    logger.info('All CMS landing blocks already exist, skipping');
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

  logger.info({ count: newBlocks.length }, 'Seeded CMS landing blocks');
  await closeDb();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed CMS landing failed');
  process.exit(1);
});
