import 'dotenv/config';
import { roles, userRoles, users } from '@db/schema/auth.js';
import { advisorSupervisors, departments, employees, orgRoles, profiles } from '@db/schema/core.js';
import {
  businessClients,
  negotiationStateHistory,
  negotiationStates,
  negotiations,
  visits,
  visitTypes,
} from '@db/schema/crm.js';
import { closeDb, db } from '@lib/db.js';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

const PASSWORD_HASH = await bcrypt.hash('Bopa2026!', 10);
const ADMIN_USER_ID = 'e73bab1f-5864-4ece-9a14-6323fa20b0de';

function required<T>(value: T | undefined | null, label: string): T {
  if (value == null) throw new Error(`Required value missing: ${label}`);
  return value;
}

async function seed() {
  const supervisorRole = await upsertRole('Supervisor', 'supervisor', 'Supervisor de ventas B2B');
  const advisorRole = await upsertRole('Advisor', 'advisor', 'Asesor comercial de campo');

  const deptResults = await upsertDepartments([
    { code: 'VENTAS_B2B', name: 'Ventas B2B' },
    { code: 'OPERACIONES', name: 'Operaciones' },
  ]);
  const deptSales = required(deptResults[0], 'deptSales');
  const deptOps = required(deptResults[1], 'deptOps');

  const orgRoleResults = await upsertOrgRoles([
    { code: 'SUPERVISOR_VENTAS', name: 'Supervisor de Ventas', departmentId: deptSales.id },
    { code: 'ASESOR_COMERCIAL', name: 'Asesor Comercial', departmentId: deptSales.id },
    { code: 'COORDINADOR_OPS', name: 'Coordinador de Operaciones', departmentId: deptOps.id },
  ]);
  const roleSupervisor = required(orgRoleResults[0], 'roleSupervisor');
  const roleAdvisor = required(orgRoleResults[1], 'roleAdvisor');

  const supervisorUsers = [
    {
      username: 'mcastillo',
      email: 'mcastillo@bopacorp.com',
      firstName: 'Maria',
      lastName: 'Castillo',
      secondLastName: 'Velez',
      nationalId: '0912345678',
      phone: '0991234567',
      territory: 'Guayaquil Norte',
    },
    {
      username: 'jmendoza',
      email: 'jmendoza@bopacorp.com',
      firstName: 'Jorge',
      lastName: 'Mendoza',
      secondLastName: 'Alvarado',
      nationalId: '0923456789',
      phone: '0992345678',
      territory: 'Guayaquil Sur',
    },
  ];

  const advisorUsers = [
    {
      username: 'lreyes',
      email: 'lreyes@bopacorp.com',
      firstName: 'Luis',
      lastName: 'Reyes',
      secondLastName: 'Ponce',
      nationalId: '0934567890',
      phone: '0993456789',
      territory: 'Samborondon',
    },
    {
      username: 'amorales',
      email: 'amorales@bopacorp.com',
      firstName: 'Andrea',
      lastName: 'Morales',
      secondLastName: 'Suarez',
      nationalId: '0945678901',
      phone: '0994567890',
      territory: 'Duran',
    },
    {
      username: 'cparedes',
      email: 'cparedes@bopacorp.com',
      firstName: 'Carlos',
      lastName: 'Paredes',
      secondLastName: 'Loor',
      nationalId: '0956789012',
      phone: '0995678901',
      territory: 'Via a la Costa',
    },
    {
      username: 'vchavez',
      email: 'vchavez@bopacorp.com',
      firstName: 'Valeria',
      lastName: 'Chavez',
      secondLastName: 'Bravo',
      nationalId: '0967890123',
      phone: '0996789012',
      territory: 'Daule',
    },
    {
      username: 'raguirre',
      email: 'raguirre@bopacorp.com',
      firstName: 'Ricardo',
      lastName: 'Aguirre',
      secondLastName: 'Cevallos',
      nationalId: '0978901234',
      phone: '0997890123',
      territory: 'Milagro',
    },
    {
      username: 'pvillao',
      email: 'pvillao@bopacorp.com',
      firstName: 'Patricia',
      lastName: 'Villao',
      secondLastName: 'Tomala',
      nationalId: '0989012345',
      phone: '0998901234',
      territory: 'Playas',
    },
  ];

  const supIds = await createUsersWithProfiles(
    supervisorUsers,
    supervisorRole.id,
    roleSupervisor.id
  );
  const advIds = await createUsersWithProfiles(advisorUsers, advisorRole.id, roleAdvisor.id);

  const sup0 = required(supIds[0], 'sup0');
  const sup1 = required(supIds[1], 'sup1');
  const adv0 = required(advIds[0], 'adv0');
  const adv1 = required(advIds[1], 'adv1');
  const adv2 = required(advIds[2], 'adv2');
  const adv3 = required(advIds[3], 'adv3');
  const adv4 = required(advIds[4], 'adv4');
  const adv5 = required(advIds[5], 'adv5');

  await db
    .insert(advisorSupervisors)
    .values([
      { advisorId: adv0, supervisorId: sup0 },
      { advisorId: adv1, supervisorId: sup0 },
      { advisorId: adv2, supervisorId: sup0 },
      { advisorId: adv3, supervisorId: sup1 },
      { advisorId: adv4, supervisorId: sup1 },
      { advisorId: adv5, supervisorId: sup1 },
    ])
    .onConflictDoNothing();

  const adminProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, ADMIN_USER_ID),
  });

  if (adminProfile && !adminProfile.phone) {
    await db
      .update(profiles)
      .set({ phone: '0990000001', address: 'Guayaquil, Kennedy Norte' })
      .where(eq(profiles.userId, ADMIN_USER_ID));
  }

  const states = await upsertNegotiationStates([
    {
      code: 'PROSPECTING',
      name: 'Prospeccion',
      description: 'Identificacion del cliente potencial',
    },
    {
      code: 'INITIAL_CONTACT',
      name: 'Contacto Inicial',
      description: 'Primera visita o llamada al cliente',
    },
    {
      code: 'PROPOSAL',
      name: 'Propuesta Enviada',
      description: 'Oferta formal presentada al cliente',
    },
    {
      code: 'NEGOTIATION',
      name: 'En Negociacion',
      description: 'Ajuste de terminos y condiciones',
    },
    { code: 'WON', name: 'Ganada', description: 'Venta cerrada exitosamente' },
    { code: 'LOST', name: 'Perdida', description: 'Oportunidad descartada' },
  ]);

  const stateMap = new Map(states.map((s) => [s.code, s]));
  const getState = (code: string) => required(stateMap.get(code), `state:${code}`);

  const vTypes = await upsertVisitTypes([
    {
      code: 'PROSPECTING',
      name: 'Prospeccion',
      description: 'Visita para identificar oportunidad de negocio',
    },
    {
      code: 'PRESENTATION',
      name: 'Presentacion',
      description: 'Demostracion de productos y servicios',
    },
    {
      code: 'FOLLOW_UP',
      name: 'Seguimiento',
      description: 'Seguimiento de propuesta o negociacion en curso',
    },
    { code: 'CLOSING', name: 'Cierre', description: 'Visita para firma de contrato' },
    {
      code: 'POST_SALE',
      name: 'Post-venta',
      description: 'Atencion y soporte despues de la venta',
    },
  ]);

  const vtMap = new Map(vTypes.map((v) => [v.code, v]));
  const getVt = (code: string) => required(vtMap.get(code), `visitType:${code}`);

  const clients = await upsertBusinessClients([
    {
      ruc: '0992345678001',
      businessName: 'Distribuidora El Pacifico S.A.',
      contactName: 'Fernando Briones',
      contactPhone: '042234567',
      contactEmail: 'fbriones@elpacifico.ec',
      address: 'Av. Juan Tanca Marengo Km 5.5, Guayaquil',
      advisorId: adv0,
      activeServicesCount: 12,
      currentMonthlyBilling: '2450.00',
    },
    {
      ruc: '0991234567001',
      businessName: 'Importadora Costa Azul Cia. Ltda.',
      contactName: 'Gabriela Intriago',
      contactPhone: '042567890',
      contactEmail: 'gintriago@costaazul.ec',
      address: 'Cdla. Kennedy, Av. San Jorge 210, Guayaquil',
      advisorId: adv0,
      activeServicesCount: 8,
      currentMonthlyBilling: '1780.00',
    },
    {
      ruc: '0993456789001',
      businessName: 'Agropecuaria Los Andes',
      contactName: 'Roberto Salazar',
      contactPhone: '042890123',
      contactEmail: 'rsalazar@losandes.ec',
      address: 'Km 26 Via a Daule, Guayaquil',
      advisorId: adv1,
      activeServicesCount: 5,
      currentMonthlyBilling: '890.50',
    },
    {
      ruc: '0994567890001',
      businessName: 'Constructora Samanes S.A.',
      contactName: 'Diego Freire',
      contactPhone: '042345678',
      contactEmail: 'dfreire@samanes.ec',
      address: 'Samborondon, Plaza Lagos, Oficina 305',
      advisorId: adv2,
      activeServicesCount: 15,
      currentMonthlyBilling: '3200.00',
    },
    {
      ruc: '0995678901001',
      businessName: 'Farmacia Cruz Verde',
      contactName: 'Monica Palacios',
      contactPhone: '042456789',
      contactEmail: 'mpalacios@cruzverde.ec',
      address: 'Av. 9 de Octubre y Malecón, Guayaquil',
      advisorId: adv3,
      activeServicesCount: 3,
      currentMonthlyBilling: '520.00',
    },
    {
      ruc: '0996789012001',
      businessName: 'Tecnologia y Redes del Litoral S.A.',
      contactName: 'Andres Villavicencio',
      contactPhone: '042678901',
      contactEmail: 'avillavicencio@techredes.ec',
      address: 'Urdesa Central, Circunvalacion Sur 602, Guayaquil',
      advisorId: adv3,
      activeServicesCount: 22,
      currentMonthlyBilling: '5600.00',
    },
    {
      ruc: '0997890123001',
      businessName: 'Hotel Sol del Pacifico',
      contactName: 'Laura Zambrano',
      contactPhone: '042789012',
      contactEmail: 'lzambrano@soldelpacifico.ec',
      address: 'General Villamil Playas, Av. Paquisha',
      advisorId: adv5,
      activeServicesCount: 10,
      currentMonthlyBilling: '1950.00',
    },
    {
      ruc: '0998901234001',
      businessName: 'Procesadora de Alimentos Tropicales',
      contactName: 'Hernan Espinoza',
      contactPhone: '042901234',
      contactEmail: 'hespinoza@alitropical.ec',
      address: 'Km 14.5 Via Daule, Parque Industrial',
      advisorId: adv4,
      activeServicesCount: 7,
      currentMonthlyBilling: '1340.00',
    },
    {
      ruc: '0999012345001',
      businessName: 'Logistica Intermodal S.A.',
      contactName: 'Sandra Velasquez',
      contactPhone: '042012345',
      contactEmail: 'svelasquez@logintermodal.ec',
      address: 'Puerto de Guayaquil, Bodega 12',
      advisorId: adv4,
      activeServicesCount: 18,
      currentMonthlyBilling: '4100.00',
    },
    {
      ruc: '1791234567001',
      businessName: 'Cooperativa de Ahorro El Progreso',
      contactName: 'Edwin Baquerizo',
      contactPhone: '042123456',
      contactEmail: 'ebaquerizo@coopelprogreso.ec',
      address: 'Milagro, Av. 17 de Septiembre y Chile',
      advisorId: adv4,
      activeServicesCount: 6,
      currentMonthlyBilling: '980.00',
    },
  ]);

  const cl = (i: number) => required(clients[i], `client[${i}]`);

  const negs = [
    {
      clientId: cl(0).id,
      advisorId: adv0,
      stateId: getState('NEGOTIATION').id,
      startDate: '2026-05-15',
      estimatedCloseDate: '2026-06-30',
      observations: 'Ampliacion de 12 a 25 lineas corporativas Movistar',
    },
    {
      clientId: cl(1).id,
      advisorId: adv0,
      stateId: getState('PROPOSAL').id,
      startDate: '2026-05-20',
      estimatedCloseDate: '2026-06-25',
      observations: 'Migracion de Claro a Movistar, 8 lineas + internet',
    },
    {
      clientId: cl(2).id,
      advisorId: adv1,
      stateId: getState('INITIAL_CONTACT').id,
      startDate: '2026-06-01',
      observations: 'Primera visita, interesado en plan de datos rural',
    },
    {
      clientId: cl(3).id,
      advisorId: adv2,
      stateId: getState('WON').id,
      startDate: '2026-05-10',
      estimatedCloseDate: '2026-06-05',
      observations: 'Contrato firmado: 15 lineas + fibra optica oficina',
    },
    {
      clientId: cl(4).id,
      advisorId: adv3,
      stateId: getState('PROSPECTING').id,
      startDate: '2026-06-10',
      observations: 'Contacto via referido, agendar primera visita',
    },
    {
      clientId: cl(5).id,
      advisorId: adv3,
      stateId: getState('NEGOTIATION').id,
      startDate: '2026-05-25',
      estimatedCloseDate: '2026-06-20',
      observations: 'Negociando descuento corporativo para 22 lineas',
    },
    {
      clientId: cl(6).id,
      advisorId: adv5,
      stateId: getState('PROPOSAL').id,
      startDate: '2026-05-28',
      estimatedCloseDate: '2026-06-18',
      observations: 'Propuesta de conectividad hotelera + PBX virtual',
    },
    {
      clientId: cl(7).id,
      advisorId: adv4,
      stateId: getState('LOST').id,
      startDate: '2026-05-12',
      estimatedCloseDate: '2026-06-01',
      observations: 'Eligieron oferta de CNT por cobertura en zona industrial',
    },
    {
      clientId: cl(8).id,
      advisorId: adv4,
      stateId: getState('WON').id,
      startDate: '2026-05-18',
      estimatedCloseDate: '2026-06-10',
      observations: 'Cerrado: 18 lineas moviles + enlace dedicado',
    },
    {
      clientId: cl(9).id,
      advisorId: adv4,
      stateId: getState('INITIAL_CONTACT').id,
      startDate: '2026-06-05',
      observations: 'Sucursales en Milagro y Naranjal necesitan cobertura',
    },
  ];

  const insertedNegs = await db.insert(negotiations).values(negs).onConflictDoNothing().returning();

  if (insertedNegs.length > 0) {
    const historyEntries = insertedNegs.map((n) => ({
      negotiationId: n.id,
      newStateId: n.stateId,
      changedBy: ADMIN_USER_ID,
      notes: 'Estado inicial al crear negociacion',
    }));
    await db.insert(negotiationStateHistory).values(historyEntries).onConflictDoNothing();

    const neg = (i: number) => insertedNegs[i];

    await db
      .insert(visits)
      .values([
        {
          negotiationId: neg(0)?.id,
          clientId: cl(0).id,
          advisorId: adv0,
          visitTypeId: getVt('FOLLOW_UP').id,
          visitDate: new Date('2026-06-02T10:00:00-05:00'),
          observations: 'Revision de propuesta con gerente de TI',
          isVerified: true,
          verifiedBy: sup0,
          supervisorComment: 'Buen avance, cliente receptivo',
          gpsLatitude: '-2.1532',
          gpsLongitude: '-79.9264',
          gpsAccuracy: '8.5',
          gpsTimestamp: new Date('2026-06-02T10:05:00-05:00'),
        },
        {
          negotiationId: neg(1)?.id,
          clientId: cl(1).id,
          advisorId: adv0,
          visitTypeId: getVt('PRESENTATION').id,
          visitDate: new Date('2026-06-05T14:30:00-05:00'),
          observations: 'Presentacion de planes corporativos Movistar',
          isVerified: true,
          verifiedBy: sup0,
          gpsLatitude: '-2.1448',
          gpsLongitude: '-79.9075',
          gpsAccuracy: '5.2',
          gpsTimestamp: new Date('2026-06-05T14:35:00-05:00'),
        },
        {
          negotiationId: neg(2)?.id,
          clientId: cl(2).id,
          advisorId: adv1,
          visitTypeId: getVt('PROSPECTING').id,
          visitDate: new Date('2026-06-01T09:00:00-05:00'),
          observations: 'Primera visita, recorrido por finca y bodegas',
          isVerified: false,
          gpsLatitude: '-1.9954',
          gpsLongitude: '-79.9354',
          gpsAccuracy: '12.0',
          gpsTimestamp: new Date('2026-06-01T09:10:00-05:00'),
        },
        {
          clientId: cl(3).id,
          advisorId: adv2,
          visitTypeId: getVt('CLOSING').id,
          visitDate: new Date('2026-06-05T11:00:00-05:00'),
          observations: 'Firma de contrato en oficina del cliente',
          isVerified: true,
          verifiedBy: sup0,
          supervisorComment: 'Excelente cierre de venta',
          gpsLatitude: '-2.1352',
          gpsLongitude: '-79.8844',
          gpsAccuracy: '4.1',
          gpsTimestamp: new Date('2026-06-05T11:02:00-05:00'),
        },
        {
          negotiationId: neg(5)?.id,
          clientId: cl(5).id,
          advisorId: adv3,
          visitTypeId: getVt('FOLLOW_UP').id,
          visitDate: new Date('2026-06-08T15:00:00-05:00'),
          observations: 'Negociacion de descuento por volumen',
          isVerified: false,
          gpsLatitude: '-2.1483',
          gpsLongitude: '-79.9636',
          gpsAccuracy: '6.3',
          gpsTimestamp: new Date('2026-06-08T15:05:00-05:00'),
        },
        {
          negotiationId: neg(6)?.id,
          clientId: cl(6).id,
          advisorId: adv5,
          visitTypeId: getVt('PRESENTATION').id,
          visitDate: new Date('2026-06-03T10:30:00-05:00'),
          observations: 'Demo de PBX virtual en lobby del hotel',
          isVerified: true,
          verifiedBy: sup1,
          supervisorComment: 'Cliente muy interesado en solucion VoIP',
          gpsLatitude: '-2.6308',
          gpsLongitude: '-80.3914',
          gpsAccuracy: '7.8',
          gpsTimestamp: new Date('2026-06-03T10:35:00-05:00'),
        },
      ])
      .onConflictDoNothing();
  }

  process.stdout.write('Seed core + CRM completed successfully.\n');
  await closeDb();
}

async function upsertRole(name: string, slug: string, description: string) {
  const [inserted] = await db
    .insert(roles)
    .values({ name, slug, description })
    .onConflictDoNothing({ target: roles.slug })
    .returning();

  if (inserted) return inserted;

  const found = await db.query.roles.findFirst({ where: eq(roles.slug, slug) });
  return required(found, `role:${slug}`);
}

async function upsertDepartments(depts: { code: string; name: string }[]) {
  await db.insert(departments).values(depts).onConflictDoNothing({ target: departments.code });
  const results = [];
  for (const d of depts) {
    const found = await db.query.departments.findFirst({ where: eq(departments.code, d.code) });
    results.push(required(found, `dept:${d.code}`));
  }
  return results;
}

async function upsertOrgRoles(orgRoleDefs: { code: string; name: string; departmentId: string }[]) {
  await db.insert(orgRoles).values(orgRoleDefs).onConflictDoNothing({ target: orgRoles.code });
  const results = [];
  for (const r of orgRoleDefs) {
    const found = await db.query.orgRoles.findFirst({ where: eq(orgRoles.code, r.code) });
    results.push(required(found, `orgRole:${r.code}`));
  }
  return results;
}

async function createUsersWithProfiles(
  userData: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    secondLastName: string;
    nationalId: string;
    phone: string;
    territory: string;
  }[],
  authRoleId: string,
  orgRoleId: string
): Promise<string[]> {
  const ids: string[] = [];

  for (const u of userData) {
    const [inserted] = await db
      .insert(users)
      .values({ username: u.username, email: u.email, passwordHash: PASSWORD_HASH })
      .onConflictDoNothing({ target: users.username })
      .returning();

    let userId: string;
    if (inserted) {
      userId = inserted.id;
    } else {
      const found = await db.query.users.findFirst({ where: eq(users.username, u.username) });
      userId = required(found, `user:${u.username}`).id;
    }

    ids.push(userId);

    await db
      .insert(profiles)
      .values({
        userId,
        firstName: u.firstName,
        lastName: u.lastName,
        secondLastName: u.secondLastName,
        nationalId: u.nationalId,
        phone: u.phone,
        address: `${u.territory}, Ecuador`,
      })
      .onConflictDoNothing();

    await db.insert(userRoles).values({ userId, roleId: authRoleId }).onConflictDoNothing();

    await db
      .insert(employees)
      .values({ userId, orgRoleId, territory: u.territory, hiredAt: '2026-01-15' })
      .onConflictDoNothing();
  }

  return ids;
}

async function upsertBusinessClients(
  clientDefs: {
    ruc: string;
    businessName: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    address: string;
    advisorId: string;
    activeServicesCount: number;
    currentMonthlyBilling: string;
  }[]
) {
  await db
    .insert(businessClients)
    .values(clientDefs)
    .onConflictDoNothing({ target: businessClients.ruc });
  const results = [];
  for (const c of clientDefs) {
    const found = await db.query.businessClients.findFirst({
      where: eq(businessClients.ruc, c.ruc),
    });
    results.push(required(found, `client:${c.ruc}`));
  }
  return results;
}

async function upsertNegotiationStates(
  stateDefs: { code: string; name: string; description: string }[]
) {
  await db
    .insert(negotiationStates)
    .values(stateDefs)
    .onConflictDoNothing({ target: negotiationStates.code });
  const results = [];
  for (const s of stateDefs) {
    const found = await db.query.negotiationStates.findFirst({
      where: eq(negotiationStates.code, s.code),
    });
    results.push(required(found, `state:${s.code}`));
  }
  return results;
}

async function upsertVisitTypes(typeDefs: { code: string; name: string; description: string }[]) {
  await db.insert(visitTypes).values(typeDefs).onConflictDoNothing({ target: visitTypes.code });
  const results = [];
  for (const t of typeDefs) {
    const found = await db.query.visitTypes.findFirst({ where: eq(visitTypes.code, t.code) });
    results.push(required(found, `visitType:${t.code}`));
  }
  return results;
}

seed().catch((err) => {
  process.stderr.write(`Seed error: ${String(err)}\n`);
  process.exit(1);
});
