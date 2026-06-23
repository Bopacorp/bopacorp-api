import 'dotenv/config';
import { roles, userRoles } from '@db/schema/auth.js';
import { negotiationStates, negotiations } from '@db/schema/crm.js';
import { offerMatrices } from '@db/schema/matrices.js';
import { salesObjectives } from '@db/schema/reports.js';
import { closeDb, db } from '@lib/db.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';

function required<T>(value: T | undefined | null, label: string): T {
  if (value == null) throw new Error(`Required value missing: ${label}`);
  return value;
}

async function seed() {
  const advisorRole = required(
    await db.query.roles.findFirst({ where: eq(roles.slug, 'advisor') }),
    'role:advisor'
  );

  const advisorUserRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, advisorRole.id));
  const advisorIds = advisorUserRows.map((r) => r.userId);

  const managerRole = required(
    await db.query.roles.findFirst({ where: eq(roles.slug, 'manager') }),
    'role:manager'
  );
  const managerUserRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, managerRole.id));
  const managerId = required(managerUserRows[0], 'manager user').userId;

  const states = await db.select().from(negotiationStates);

  const allNegotiations = await db
    .select()
    .from(negotiations)
    .where(and(inArray(negotiations.advisorId, advisorIds), isNull(negotiations.deletedAt)));

  process.stdout.write(`Found ${allNegotiations.length} negotiations\n`);

  const negotiationsByState = new Map<string, typeof allNegotiations>();
  for (const neg of allNegotiations) {
    const stateCode = states.find((s) => s.id === neg.stateId)?.code ?? 'unknown';
    if (!negotiationsByState.has(stateCode)) {
      negotiationsByState.set(stateCode, []);
    }
    negotiationsByState.get(stateCode)?.push(neg);
  }

  const matrixDefs: {
    negotiationId: string;
    creatorId: string;
    observations: string;
  }[] = [];

  const closingNegs = negotiationsByState.get('closing') ?? [];
  for (let i = 0; i < Math.min(closingNegs.length, 6); i++) {
    const neg = required(closingNegs[i], `closing[${i}]`);
    matrixDefs.push({
      negotiationId: neg.id,
      creatorId: neg.advisorId,
      observations: 'Oferta enviada al distribuidor',
    });
  }

  const negotiationNegs = negotiationsByState.get('negotiation') ?? [];
  for (let i = 0; i < Math.min(negotiationNegs.length, 5); i++) {
    const neg = required(negotiationNegs[i], `negotiation[${i}]`);
    matrixDefs.push({
      negotiationId: neg.id,
      creatorId: neg.advisorId,
      observations: 'Matriz en preparacion',
    });
  }

  const postSaleNegs = negotiationsByState.get('post_sale') ?? [];
  for (let i = 0; i < Math.min(postSaleNegs.length, 4); i++) {
    const neg = required(postSaleNegs[i], `post_sale[${i}]`);
    matrixDefs.push({
      negotiationId: neg.id,
      creatorId: neg.advisorId,
      observations: 'Oferta cerrada y en seguimiento post-venta',
    });
  }

  let matricesCreated = 0;

  for (const def of matrixDefs) {
    const [matrix] = await db
      .insert(offerMatrices)
      .values({
        negotiationId: def.negotiationId,
        creatorId: def.creatorId,
        observations: def.observations,
      })
      .onConflictDoNothing()
      .returning();

    if (matrix) matricesCreated++;
  }

  process.stdout.write(`Created ${matricesCreated} offer matrices\n`);

  const objectiveDefs = advisorIds.map((advisorId, i) => ({
    createdBy: managerId,
    advisorId,
    targetSalesAmount: (5000 + i * 1500).toFixed(2),
    targetClosedDeals: 3 + (i % 3),
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
  }));

  objectiveDefs.push(
    ...advisorIds.slice(0, 3).map((advisorId, i) => ({
      createdBy: managerId,
      advisorId,
      targetSalesAmount: (4500 + i * 1000).toFixed(2),
      targetClosedDeals: 2 + i,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    }))
  );

  const insertedObjectives = await db
    .insert(salesObjectives)
    .values(objectiveDefs)
    .onConflictDoNothing()
    .returning();

  process.stdout.write(`Created ${insertedObjectives.length} sales objectives\n`);

  process.stdout.write('Seed matrices + objectives completed.\n');
  await closeDb();
}

seed().catch((err) => {
  process.stderr.write(`Seed error: ${String(err)}\n`);
  process.exit(1);
});
