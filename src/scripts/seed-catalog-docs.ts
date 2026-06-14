import 'dotenv/config';
import {
  benefitTypes,
  catalogItems,
  categories,
  contractTypes,
  geoZones,
  itemTypes,
  segments,
  tiers,
  voiceDetails,
} from '@db/schema/catalog.js';
import { documentTypes } from '@db/schema/documents.js';
import { closeDb, db } from '@lib/db.js';
import { eq } from 'drizzle-orm';

function required<T>(value: T | undefined | null, label: string): T {
  if (value == null) throw new Error(`Required value missing: ${label}`);
  return value;
}

async function upsertByCode<T extends { code: string; id: string }>(
  table: Parameters<typeof db.insert>[0],
  defs: Record<string, unknown>[],
  codeCol: { code: unknown }
) {
  await db
    .insert(table)
    .values(defs)
    .onConflictDoNothing({ target: codeCol as never });
  const results: T[] = [];
  for (const d of defs) {
    const code = d.code as string;
    const rows = await db
      .select()
      .from(table as never)
      .where(eq(codeCol as never, code));
    results.push(required(rows[0] as T, `${code}`));
  }
  return results;
}

async function seed() {
  const catDefs = [
    { name: 'Voz', description: 'Planes de voz movil corporativa', sortOrder: 1 },
    { name: 'Conectividad', description: 'Internet dedicado y fibra optica', sortOrder: 2 },
    {
      name: 'Servicios Digitales',
      description: 'Soluciones cloud, seguridad y rastreo',
      sortOrder: 3,
    },
  ];
  const existingCats = await db.select().from(categories);
  const existingCatNames = new Set(existingCats.map((c) => c.name));
  const newCats = catDefs.filter((c) => !existingCatNames.has(c.name));
  if (newCats.length > 0) {
    await db.insert(categories).values(newCats);
  }
  const catRows = await db.select().from(categories);
  const catByName = new Map(catRows.map((c) => [c.name, c]));
  const catVoz = required(catByName.get('Voz'), 'cat:Voz');

  const segDefs = [
    { code: 'natural', name: 'RUC Natural', description: 'Persona natural, 1-2 lineas' },
    { code: 'juridico', name: 'RUC Juridico', description: 'Persona juridica, empresa' },
  ];
  const segs = await upsertByCode(segments, segDefs, segments.code);
  const segMap = new Map(segs.map((s) => [s.code, s]));

  const tierDefs = [
    { code: 'elite', name: 'Elite', description: 'Plan base' },
    { code: 'pro', name: 'Pro', description: 'Plan profesional' },
    { code: 'pro-plus', name: 'Pro+', description: 'Plan profesional plus' },
    { code: 'max', name: 'Max', description: 'Plan intermedio alto' },
    { code: 'advanced', name: 'Advanced', description: 'Plan avanzado' },
    { code: 'advanced-plus', name: 'Advanced+', description: 'Plan avanzado plus' },
    { code: 'ultra', name: 'Ultra', description: 'Plan premium' },
    { code: 'infinity', name: 'Infinity', description: 'Plan premium maximo' },
  ];
  const tierRows = await upsertByCode(tiers, tierDefs, tiers.code);
  const tierMap = new Map(tierRows.map((t) => [t.code, t]));

  const itDefs = [
    { code: 'mobile-plan', name: 'Plan Movil', description: 'Linea movil corporativa pospago' },
    { code: 'internet', name: 'Internet Dedicado', description: 'Enlace de internet dedicado' },
    { code: 'digital', name: 'Servicio Digital', description: 'Servicio digital cloud o SaaS' },
  ];
  await upsertByCode(itemTypes, itDefs, itemTypes.code);
  const itRows = await db.select().from(itemTypes);
  const itMap = new Map(itRows.map((i) => [i.code, i]));

  const ctDefs = [
    { code: 'postpaid', name: 'Pospago', description: 'Contrato pospago con permanencia' },
    { code: 'prepaid', name: 'Prepago', description: 'Recarga sin contrato' },
  ];
  await upsertByCode(contractTypes, ctDefs, contractTypes.code);
  const ctRows = await db.select().from(contractTypes);
  const ctMap = new Map(ctRows.map((c) => [c.code, c]));

  const gzDefs = [
    { code: 'can', name: 'CAN', description: 'Colombia, Peru, Bolivia' },
    { code: 'latam', name: 'Latinoamerica', description: 'Paises Latinoamerica' },
    { code: 'global', name: 'Global', description: 'Cobertura mundial' },
  ];
  await upsertByCode(geoZones, gzDefs, geoZones.code);

  const btDefs = [
    {
      code: 'social-networks',
      name: 'Redes Sociales Ilimitadas',
      description: 'Instagram, TikTok, Facebook, X, Messenger',
    },
    { code: 'whatsapp', name: 'WhatsApp Gratis', description: 'WhatsApp ilimitado incluido' },
    { code: 'roaming-can', name: 'Roaming CAN', description: 'Roaming en Colombia, Peru, Bolivia' },
    { code: 'ldi', name: 'Llamadas LDI', description: 'Minutos de larga distancia internacional' },
    { code: 'sms', name: 'SMS Libres', description: 'Mensajes de texto incluidos' },
    {
      code: 'familia',
      name: 'Servicio Familia Full',
      description: 'Compartir datos con familiares',
    },
  ];
  await upsertByCode(benefitTypes, btDefs, benefitTypes.code);

  const postpaidId = required(ctMap.get('postpaid'), 'ct:postpaid').id;
  const mobilePlanId = required(itMap.get('mobile-plan'), 'it:mobile-plan').id;

  const naturalPlans = [
    {
      name: 'Elite Natural',
      segment: 'natural',
      tier: 'elite',
      price: '15.99',
      gigasStructural: 16,
      gigasLoyalty: 4,
      minutesNational: 300,
      minutesLdi: 50,
      sms: 200,
      hasUnlimitedMinutes: false,
      hasSocialNetworks: false,
      includedRoamingGb: '0',
    },
    {
      name: 'Pro Natural',
      segment: 'natural',
      tier: 'pro',
      price: '18.99',
      gigasStructural: 18,
      gigasLoyalty: 4,
      minutesNational: 500,
      minutesLdi: 150,
      sms: 200,
      hasUnlimitedMinutes: false,
      hasSocialNetworks: true,
      includedRoamingGb: '0',
    },
    {
      name: 'Max Natural',
      segment: 'natural',
      tier: 'max',
      price: '23.99',
      gigasStructural: 25,
      gigasLoyalty: 5,
      minutesNational: null,
      minutesLdi: 200,
      sms: 200,
      hasUnlimitedMinutes: true,
      hasSocialNetworks: true,
      includedRoamingGb: '0',
    },
    {
      name: 'Ultra Natural',
      segment: 'natural',
      tier: 'ultra',
      price: '27.99',
      gigasStructural: 30,
      gigasLoyalty: 5,
      minutesNational: null,
      minutesLdi: 200,
      sms: 200,
      hasUnlimitedMinutes: true,
      hasSocialNetworks: true,
      includedRoamingGb: '5',
    },
    {
      name: 'Infinity Natural',
      segment: 'natural',
      tier: 'infinity',
      price: '34.99',
      gigasStructural: 35,
      gigasLoyalty: 10,
      minutesNational: null,
      minutesLdi: 200,
      sms: 200,
      hasUnlimitedMinutes: true,
      hasSocialNetworks: true,
      includedRoamingGb: '9',
    },
  ];

  const juridicoPlans = [
    {
      name: 'Pro Juridico',
      segment: 'juridico',
      tier: 'pro',
      price: '16.00',
      gigasStructural: 32,
      gigasLoyalty: 3,
      minutesNational: 500,
      minutesLdi: 50,
      sms: 0,
      hasUnlimitedMinutes: false,
      hasSocialNetworks: false,
      includedRoamingGb: '0',
    },
    {
      name: 'Pro+ Juridico',
      segment: 'juridico',
      tier: 'pro-plus',
      price: '20.00',
      gigasStructural: 40,
      gigasLoyalty: 5,
      minutesNational: null,
      minutesLdi: 50,
      sms: 0,
      hasUnlimitedMinutes: true,
      hasSocialNetworks: false,
      includedRoamingGb: '1',
    },
    {
      name: 'Advanced Juridico',
      segment: 'juridico',
      tier: 'advanced',
      price: '25.00',
      gigasStructural: 52,
      gigasLoyalty: 5,
      minutesNational: null,
      minutesLdi: 100,
      sms: 0,
      hasUnlimitedMinutes: true,
      hasSocialNetworks: true,
      includedRoamingGb: '1',
    },
    {
      name: 'Advanced+ Juridico',
      segment: 'juridico',
      tier: 'advanced-plus',
      price: '35.00',
      gigasStructural: 75,
      gigasLoyalty: 10,
      minutesNational: null,
      minutesLdi: 100,
      sms: 0,
      hasUnlimitedMinutes: true,
      hasSocialNetworks: true,
      includedRoamingGb: '5',
    },
    {
      name: 'Elite Juridico',
      segment: 'juridico',
      tier: 'elite',
      price: '50.00',
      gigasStructural: 120,
      gigasLoyalty: 10,
      minutesNational: null,
      minutesLdi: 200,
      sms: 0,
      hasUnlimitedMinutes: true,
      hasSocialNetworks: true,
      includedRoamingGb: '9',
    },
  ];

  const allPlans = [...naturalPlans, ...juridicoPlans];

  const existingItems = await db.select({ name: catalogItems.name }).from(catalogItems);
  const existingItemNames = new Set(existingItems.map((i) => i.name));

  for (const plan of allPlans) {
    if (existingItemNames.has(plan.name)) continue;

    const segId = required(segMap.get(plan.segment), `seg:${plan.segment}`).id;
    const tierId = required(tierMap.get(plan.tier), `tier:${plan.tier}`).id;

    const [inserted] = await db
      .insert(catalogItems)
      .values({
        categoryId: catVoz.id,
        itemTypeId: mobilePlanId,
        contractTypeId: postpaidId,
        segmentId: segId,
        tierId,
        name: plan.name,
        description: `Plan movil corporativo Movistar Empresas - ${plan.name}`,
        price: plan.price,
        isActive: true,
        isPublished: true,
        permanenceMonths: 24,
      })
      .returning();

    await db.insert(voiceDetails).values({
      itemId: required(inserted, `insert:${plan.name}`).id,
      gigasStructural: plan.gigasStructural,
      gigasLoyalty: plan.gigasLoyalty,
      minutesNational: plan.minutesNational,
      minutesLdi: plan.minutesLdi,
      sms: plan.sms,
      hasUnlimitedMinutes: plan.hasUnlimitedMinutes,
      hasUnlimitedWhatsapp: true,
      hasSocialNetworks: plan.hasSocialNetworks,
      includedRoamingGb: plan.includedRoamingGb,
    });
  }

  const docTypeDefs = [
    {
      code: 'provisional-ruc',
      name: 'RUC Provisional',
      description: 'Registro Unico de Contribuyentes provisional',
      isMandatory: true,
    },
    {
      code: 'initial-proposal',
      name: 'Propuesta Inicial',
      description: 'Documento con la oferta comercial inicial',
      isMandatory: false,
    },
    {
      code: 'visit-report',
      name: 'Informe de Visita',
      description: 'Reporte de la visita realizada al cliente',
      isMandatory: false,
    },
    {
      code: 'final-contract',
      name: 'Contrato Final',
      description: 'Contrato firmado por ambas partes',
      isMandatory: true,
    },
    {
      code: 'cedula-representante',
      name: 'Cedula del Representante Legal',
      description: 'Documento de identidad del representante legal',
      isMandatory: true,
    },
    {
      code: 'nombramiento',
      name: 'Nombramiento',
      description: 'Nombramiento del representante legal inscrito',
      isMandatory: true,
    },
  ];
  await db
    .insert(documentTypes)
    .values(docTypeDefs)
    .onConflictDoNothing({ target: documentTypes.code });

  process.stdout.write('Seed catalog + document types completed.\n');
  await closeDb();
}

seed().catch((err) => {
  process.stderr.write(`Seed error: ${String(err)}\n`);
  process.exit(1);
});
