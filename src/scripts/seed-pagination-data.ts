import 'dotenv/config';
import { users } from '@db/schema/auth.js';
import { employees } from '@db/schema/core.js';
import {
  businessClients,
  negotiationStateHistory,
  negotiationStates,
  negotiations,
} from '@db/schema/crm.js';
import { closeDb, db } from '@lib/db.js';
import { eq } from 'drizzle-orm';

const ADMIN_USER_ID = 'e73bab1f-5864-4ece-9a14-6323fa20b0de';

async function seed() {
  const advisorUsernames = ['lreyes', 'amorales', 'rvillacis', 'pcabrera', 'dguaman', 'fnavarro'];
  const advisorIds: string[] = [];
  for (const username of advisorUsernames) {
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (user) {
      const emp = await db.query.employees.findFirst({ where: eq(employees.userId, user.id) });
      if (emp) advisorIds.push(user.id);
    }
  }

  if (advisorIds.length === 0) {
    process.stderr.write('No advisors found. Run seed-core-crm.ts first.\n');
    process.exit(1);
  }

  const stateRows = await db.select().from(negotiationStates);
  const stateMap = new Map(stateRows.map((s) => [s.code, s.id]));

  const extraClients = [
    {
      ruc: '0912345001001',
      businessName: 'Camaronera Bahia Azul S.A.',
      contactName: 'Pedro Alcivar',
      contactPhone: '042100001',
      contactEmail: 'palcivar@bahiaazul.ec',
      address: 'Via Puerto Inca Km 8, Guayaquil',
      activeServicesCount: 4,
      currentMonthlyBilling: '680.00',
    },
    {
      ruc: '0912345002001',
      businessName: 'Ferreteria El Constructor',
      contactName: 'Marco Torres',
      contactPhone: '042100002',
      contactEmail: 'mtorres@elconstructor.ec',
      address: 'Av. Quito y Tungurahua, Guayaquil',
      activeServicesCount: 2,
      currentMonthlyBilling: '340.00',
    },
    {
      ruc: '0912345003001',
      businessName: 'Clinica Dental Sonrisa',
      contactName: 'Valeria Moreira',
      contactPhone: '042100003',
      contactEmail: 'vmoreira@sonrisa.ec',
      address: 'Cdla. Atarazana, Guayaquil',
      activeServicesCount: 3,
      currentMonthlyBilling: '450.00',
    },
    {
      ruc: '0912345004001',
      businessName: 'Transportes Pesados del Sur',
      contactName: 'Hugo Cedeno',
      contactPhone: '042100004',
      contactEmail: 'hcedeno@transpesados.ec',
      address: 'Via a la Costa Km 15, Guayaquil',
      activeServicesCount: 20,
      currentMonthlyBilling: '4200.00',
    },
    {
      ruc: '0912345005001',
      businessName: 'Papeleria y Suministros Galaxia',
      contactName: 'Rosa Anchundia',
      contactPhone: '042100005',
      contactEmail: 'ranchundia@galaxia.ec',
      address: 'Av. 25 de Julio, Guayaquil',
      activeServicesCount: 1,
      currentMonthlyBilling: '180.00',
    },
    {
      ruc: '0912345006001',
      businessName: 'Restaurante Manabi Tipico',
      contactName: 'Carlos Zambrano',
      contactPhone: '042100006',
      contactEmail: 'czambrano@manabitipico.ec',
      address: 'Alborada, Etapa 11, Guayaquil',
      activeServicesCount: 2,
      currentMonthlyBilling: '290.00',
    },
    {
      ruc: '0912345007001',
      businessName: 'Talleres Mecanicos Precision',
      contactName: 'Javier Loor',
      contactPhone: '042100007',
      contactEmail: 'jloor@precision.ec',
      address: 'Mapasingue Este, Guayaquil',
      activeServicesCount: 5,
      currentMonthlyBilling: '720.00',
    },
    {
      ruc: '0912345008001',
      businessName: 'Inmobiliaria Colinas del Sol',
      contactName: 'Patricia Lara',
      contactPhone: '042100008',
      contactEmail: 'plara@colinassol.ec',
      address: 'Samborondon, Km 2, Guayaquil',
      activeServicesCount: 8,
      currentMonthlyBilling: '1560.00',
    },
    {
      ruc: '0912345009001',
      businessName: 'Centro Educativo Horizontes',
      contactName: 'Ana Pincay',
      contactPhone: '042100009',
      contactEmail: 'apincay@horizontes.ec',
      address: 'Sauces 6, Guayaquil',
      activeServicesCount: 10,
      currentMonthlyBilling: '1800.00',
    },
    {
      ruc: '0912345010001',
      businessName: 'Distribuidora de Plasticos Duran',
      contactName: 'Nelson Figueroa',
      contactPhone: '042100010',
      contactEmail: 'nfigueroa@plastduran.ec',
      address: 'Duran, Av. Gonzalo Aparicio',
      activeServicesCount: 6,
      currentMonthlyBilling: '890.00',
    },
    {
      ruc: '0912345011001',
      businessName: 'Veterinaria Mascota Feliz',
      contactName: 'Lorena Vera',
      contactPhone: '042100011',
      contactEmail: 'lvera@mascotafeliz.ec',
      address: 'Urdesa, Calle Ficus, Guayaquil',
      activeServicesCount: 1,
      currentMonthlyBilling: '150.00',
    },
    {
      ruc: '0912345012001',
      businessName: 'Taller de Costura La Elegancia',
      contactName: 'Maria Quinde',
      contactPhone: '042100012',
      contactEmail: 'mquinde@elegancia.ec',
      address: 'Centro, Calle Chile, Guayaquil',
      activeServicesCount: 1,
      currentMonthlyBilling: '120.00',
    },
    {
      ruc: '0912345013001',
      businessName: 'Exportadora Bananera Oro Verde',
      contactName: 'Ricardo Barzola',
      contactPhone: '042100013',
      contactEmail: 'rbarzola@oroverde.ec',
      address: 'Machala, Via Puerto Bolivar',
      activeServicesCount: 25,
      currentMonthlyBilling: '6500.00',
    },
    {
      ruc: '0912345014001',
      businessName: 'Lubricantes y Filtros Oriente',
      contactName: 'Fabian Celi',
      contactPhone: '042100014',
      contactEmail: 'fceli@luboriente.ec',
      address: 'Quevedo, Av. June Guzman',
      activeServicesCount: 4,
      currentMonthlyBilling: '560.00',
    },
    {
      ruc: '0912345015001',
      businessName: 'Panaderia y Pasteleria Don Trigo',
      contactName: 'Carmen Alava',
      contactPhone: '042100015',
      contactEmail: 'calava@dontrigo.ec',
      address: 'Duran, Cdla. Abel Gilbert',
      activeServicesCount: 3,
      currentMonthlyBilling: '380.00',
    },
    {
      ruc: '0912345016001',
      businessName: 'Consultora Juridica Lex Corp',
      contactName: 'Gabriel Moncayo',
      contactPhone: '042100016',
      contactEmail: 'gmoncayo@lexcorp.ec',
      address: 'Av. 9 de Octubre 1200, Guayaquil',
      activeServicesCount: 6,
      currentMonthlyBilling: '1100.00',
    },
    {
      ruc: '0912345017001',
      businessName: 'Imprenta Digital PrintMax',
      contactName: 'Veronica Conforme',
      contactPhone: '042100017',
      contactEmail: 'vconforme@printmax.ec',
      address: 'Los Ceibos, Guayaquil',
      activeServicesCount: 2,
      currentMonthlyBilling: '320.00',
    },
    {
      ruc: '0912345018001',
      businessName: 'Gasolinera Estacion Central',
      contactName: 'Manuel Reyes',
      contactPhone: '042100018',
      contactEmail: 'mreyes@estcentral.ec',
      address: 'Via Perimetral Km 22, Guayaquil',
      activeServicesCount: 4,
      currentMonthlyBilling: '620.00',
    },
    {
      ruc: '0912345019001',
      businessName: 'Centro Optico Vision Total',
      contactName: 'Diana Saltos',
      contactPhone: '042100019',
      contactEmail: 'dsaltos@visiontotal.ec',
      address: 'Mall del Sol, Local 215, Guayaquil',
      activeServicesCount: 2,
      currentMonthlyBilling: '280.00',
    },
    {
      ruc: '0912345020001',
      businessName: 'Laboratorio Clinico BioSalud',
      contactName: 'Jorge Barrera',
      contactPhone: '042100020',
      contactEmail: 'jbarrera@biosalud.ec',
      address: 'Kennedy Norte, Guayaquil',
      activeServicesCount: 8,
      currentMonthlyBilling: '1450.00',
    },
    {
      ruc: '0912345021001',
      businessName: 'Agencia de Viajes Sol Caribe',
      contactName: 'Karina Ortiz',
      contactPhone: '042100021',
      contactEmail: 'kortiz@solcaribe.ec',
      address: 'Urdesa, Av. Victor Emilio Estrada, Guayaquil',
      activeServicesCount: 3,
      currentMonthlyBilling: '420.00',
    },
    {
      ruc: '0912345022001',
      businessName: 'Floricultura Rosas del Ecuador',
      contactName: 'Pablo Yepez',
      contactPhone: '042100022',
      contactEmail: 'pyepez@rosasec.ec',
      address: 'Pedro Carbo, Los Rios',
      activeServicesCount: 5,
      currentMonthlyBilling: '750.00',
    },
    {
      ruc: '0912345023001',
      businessName: 'Lavanderia Industrial CleanPro',
      contactName: 'Teresa Moran',
      contactPhone: '042100023',
      contactEmail: 'tmoran@cleanpro.ec',
      address: 'Prosperina, Guayaquil',
      activeServicesCount: 3,
      currentMonthlyBilling: '490.00',
    },
    {
      ruc: '0912345024001',
      businessName: 'Academia de Idiomas GlobalSpeak',
      contactName: 'Ivan Delgado',
      contactPhone: '042100024',
      contactEmail: 'idelgado@globalspeak.ec',
      address: 'Ceibos Norte, Guayaquil',
      activeServicesCount: 4,
      currentMonthlyBilling: '580.00',
    },
    {
      ruc: '0912345025001',
      businessName: 'Gimnasio PowerFit Center',
      contactName: 'Natalia Jaramillo',
      contactPhone: '042100025',
      contactEmail: 'njaramillo@powerfit.ec',
      address: 'Samborondon, Plaza Batan',
      activeServicesCount: 2,
      currentMonthlyBilling: '350.00',
    },
  ];

  const stateKeys = [
    'PROSPECTING',
    'INITIAL_CONTACT',
    'PROPOSAL',
    'NEGOTIATION',
    'WON',
    'LOST',
    'POST_SALE',
  ];
  const startDates = [
    '2026-04-01',
    '2026-04-05',
    '2026-04-10',
    '2026-04-15',
    '2026-04-20',
    '2026-04-25',
    '2026-05-01',
    '2026-05-05',
    '2026-05-10',
    '2026-05-15',
    '2026-05-18',
    '2026-05-20',
    '2026-05-22',
    '2026-05-25',
    '2026-05-28',
    '2026-06-01',
    '2026-06-02',
    '2026-06-03',
    '2026-06-04',
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
    '2026-06-08',
    '2026-06-09',
    '2026-06-10',
  ];

  const existingClients = await db.select({ ruc: businessClients.ruc }).from(businessClients);
  const existingRucs = new Set(existingClients.map((c) => c.ruc));

  const newClients = extraClients.filter((c) => !existingRucs.has(c.ruc));
  const insertedClients = [];

  for (let i = 0; i < newClients.length; i++) {
    const c = newClients[i];
    const advisorId = advisorIds[i % advisorIds.length];
    if (!c || !advisorId) continue;
    const [row] = await db
      .insert(businessClients)
      .values({ ...c, advisorId })
      .returning();
    if (row) insertedClients.push(row);
  }

  process.stdout.write(`Inserted ${insertedClients.length} new clients\n`);

  const allClients = await db.select({ id: businessClients.id }).from(businessClients);

  let negCount = 0;
  for (let i = 0; i < insertedClients.length; i++) {
    const client = insertedClients[i];
    const advisorId = advisorIds[i % advisorIds.length];
    const stateCode = stateKeys[i % stateKeys.length];
    if (!client || !advisorId || !stateCode) continue;
    const stateId = stateMap.get(stateCode);
    if (!stateId) continue;

    const startDate = startDates[i % startDates.length];
    if (!startDate) continue;
    const hasClose = !['PROSPECTING', 'INITIAL_CONTACT'].includes(stateCode);

    const [neg] = await db
      .insert(negotiations)
      .values({
        clientId: client.id,
        advisorId,
        stateId,
        startDate,
        estimatedCloseDate: hasClose ? '2026-07-15' : undefined,
        observations: `Negociacion con ${client.businessName}`,
      })
      .onConflictDoNothing()
      .returning();

    if (neg) {
      negCount++;
      await db
        .insert(negotiationStateHistory)
        .values({
          negotiationId: neg.id,
          newStateId: stateId,
          changedBy: ADMIN_USER_ID,
          notes: 'Estado inicial al crear negociacion',
        })
        .onConflictDoNothing();
    }
  }

  process.stdout.write(`Inserted ${negCount} new negotiations\n`);
  process.stdout.write(`Total clients in DB: ${allClients.length + insertedClients.length}\n`);

  await closeDb();
}

seed().catch((err) => {
  process.stderr.write(`Seed error: ${String(err)}\n`);
  process.exit(1);
});
