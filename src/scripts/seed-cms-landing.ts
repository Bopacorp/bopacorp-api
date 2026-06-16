import 'dotenv/config';
import type { CreateContentBlockRequest } from '@bopacorp/shared/catalog';
import { ContentTypeCode } from '@bopacorp/shared/catalog';
import { closeDb, db } from '@lib/db.js';
import { logger } from '@lib/logger.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { contentBlocks, contentTypes } from '../db/schema/catalog.js';

type ContentTypeIds = Record<ContentTypeCode, string>;

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

const buildBlocks = (typeIds: ContentTypeIds): CreateContentBlockRequest[] => [
  {
    contentKey: 'hero.title',
    contentTypeId: typeIds[ContentTypeCode.TEXT],
    title: 'Titulo Hero',
    body: 'Bienvenido a Bopacorp',
    sortOrder: 1,
  },
  {
    contentKey: 'hero.subtitle',
    contentTypeId: typeIds[ContentTypeCode.TEXT],
    title: 'Subtitulo Hero',
    body: 'Soluciones de telecomunicaciones corporativas en Ecuador',
    sortOrder: 2,
  },
  {
    contentKey: 'hero.cta',
    contentTypeId: typeIds[ContentTypeCode.TEXT],
    title: 'Boton Hero',
    body: 'Cotizar ahora',
    sortOrder: 3,
  },
  {
    contentKey: 'hero.background',
    contentTypeId: typeIds[ContentTypeCode.IMAGE],
    title: 'Fondo Hero',
    body: 'https://placehold.co/1920x800/0a0a2e/ffffff?text=Bopacorp+Hero',
    sortOrder: 4,
  },
  {
    contentKey: 'features.title',
    contentTypeId: typeIds[ContentTypeCode.TEXT],
    title: 'Titulo Servicios',
    body: 'Nuestros Servicios',
    sortOrder: 10,
  },
  {
    contentKey: 'features.subtitle',
    contentTypeId: typeIds[ContentTypeCode.TEXT],
    title: 'Subtitulo Servicios',
    body: 'Descubre todo lo que podemos hacer por tu empresa',
    sortOrder: 11,
  },
  {
    contentKey: 'features.item.1',
    contentTypeId: typeIds[ContentTypeCode.HTML],
    title: 'Servicio 1',
    body: '<div class="feature-card"><h3>Conectividad Empresarial</h3><p>Internet dedicado de alta velocidad con SLA garantizado.</p></div>',
    sortOrder: 12,
  },
  {
    contentKey: 'features.item.2',
    contentTypeId: typeIds[ContentTypeCode.HTML],
    title: 'Servicio 2',
    body: '<div class="feature-card"><h3>Planes Corporativos Movistar</h3><p>Planes de voz y datos para equipos corporativos con beneficios exclusivos.</p></div>',
    sortOrder: 13,
  },
  {
    contentKey: 'features.item.3',
    contentTypeId: typeIds[ContentTypeCode.HTML],
    title: 'Servicio 3',
    body: '<div class="feature-card"><h3>Servicios Digitales</h3><p>Desarrollo de software, presencia web y transformacion digital para tu negocio.</p></div>',
    sortOrder: 14,
  },
  {
    contentKey: 'banner.promo',
    contentTypeId: typeIds[ContentTypeCode.BANNER],
    title: 'Banner Promocional',
    body: '<div style="background:linear-gradient(135deg,#1a1a4e,#2d2d8a);padding:40px;border-radius:12px;text-align:center;color:white"><h2 style="margin:0 0 8px">Oferta Especial</h2><p style="margin:0">Contrata 2 servicios y obten 15% de descuento el primer trimestre</p></div>',
    sortOrder: 20,
  },
  {
    contentKey: 'video.intro',
    contentTypeId: typeIds[ContentTypeCode.VIDEO],
    title: 'Video Introductorio',
    body: '<iframe width="100%" height="400" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Video Bopacorp" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
    sortOrder: 30,
  },
  {
    contentKey: 'cta.title',
    contentTypeId: typeIds[ContentTypeCode.TEXT],
    title: 'Titulo CTA',
    body: 'Impulsa tu negocio con Bopacorp',
    sortOrder: 40,
  },
  {
    contentKey: 'cta.button',
    contentTypeId: typeIds[ContentTypeCode.TEXT],
    title: 'Boton CTA',
    body: 'Solicitar una cotizacion',
    sortOrder: 41,
  },
  {
    contentKey: 'footer.text',
    contentTypeId: typeIds[ContentTypeCode.TEXT],
    title: 'Texto Footer',
    body: '2026 BOPACORP S.A. Todos los derechos reservados.',
    sortOrder: 50,
  },
  {
    contentKey: 'footer.links',
    contentTypeId: typeIds[ContentTypeCode.HTML],
    title: 'Links Footer',
    body: '<ul><li><a href="#">Terminos y Condiciones</a></li><li><a href="#">Politicas de Privacidad</a></li><li><a href="#">Contacto</a></li></ul>',
    sortOrder: 51,
  },
];

async function seed() {
  const typeIds: ContentTypeIds = {
    TEXT: await getContentTypeId(ContentTypeCode.TEXT),
    HTML: await getContentTypeId(ContentTypeCode.HTML),
    IMAGE: await getContentTypeId(ContentTypeCode.IMAGE),
    BANNER: await getContentTypeId(ContentTypeCode.BANNER),
    VIDEO: await getContentTypeId(ContentTypeCode.VIDEO),
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
