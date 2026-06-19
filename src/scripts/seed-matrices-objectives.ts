import 'dotenv/config';
import { roles, userRoles } from '@db/schema/auth.js';
import { catalogItems } from '@db/schema/catalog.js';
import { negotiationStates, negotiations } from '@db/schema/crm.js';
import { matrixLineItems, matrixStateHistory, offerMatrices } from '@db/schema/matrices.js';
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

  const supervisorRole = required(
    await db.query.roles.findFirst({ where: eq(roles.slug, 'supervisor') }),
    'role:supervisor'
  );
  const supervisorUserRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, supervisorRole.id));
  const supervisorIds = supervisorUserRows.map((r) => r.userId);

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
  const items = await db
    .select()
    .from(catalogItems)
    .where(and(eq(catalogItems.isActive, true), isNull(catalogItems.deletedAt)));

  if (items.length === 0) {
    throw new Error('No active catalog items found — seed catalog first');
  }

  const allNegotiations = await db
    .select()
    .from(negotiations)
    .where(and(inArray(negotiations.advisorId, advisorIds), isNull(negotiations.deletedAt)));

  process.stdout.write(
    `Found ${allNegotiations.length} negotiations, ${items.length} catalog items\n`
  );

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
    state: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    approvedBy: string | null;
    observations: string;
    itemIndices: number[];
    quantities: number[];
  }[] = [];

  const closingNegs = negotiationsByState.get('closing') ?? [];
  for (let i = 0; i < Math.min(closingNegs.length, 6); i++) {
    const neg = required(closingNegs[i], `closing[${i}]`);
    const supId = supervisorIds[i % supervisorIds.length];
    matrixDefs.push({
      negotiationId: neg.id,
      creatorId: neg.advisorId,
      state: 'APPROVED',
      approvedBy: supId ?? null,
      observations: 'Oferta aprobada por supervisor',
      itemIndices: [i % items.length, (i + 1) % items.length, (i + 3) % items.length],
      quantities: [5 + i, 2, 1],
    });
  }

  const negotiationNegs = negotiationsByState.get('negotiation') ?? [];
  for (let i = 0; i < Math.min(negotiationNegs.length, 5); i++) {
    const neg = required(negotiationNegs[i], `negotiation[${i}]`);
    matrixDefs.push({
      negotiationId: neg.id,
      creatorId: neg.advisorId,
      state: 'PENDING_APPROVAL',
      approvedBy: null,
      observations: 'Pendiente revision del supervisor',
      itemIndices: [i % items.length, (i + 2) % items.length],
      quantities: [3 + i, 4],
    });
  }

  for (let i = 0; i < Math.min(negotiationNegs.length - 5, 3); i++) {
    const neg = negotiationNegs[i + 5];
    if (!neg) break;
    matrixDefs.push({
      negotiationId: neg.id,
      creatorId: neg.advisorId,
      state: 'DRAFT',
      approvedBy: null,
      observations: 'Borrador en preparacion',
      itemIndices: [(i + 4) % items.length],
      quantities: [2 + i],
    });
  }

  const postSaleNegs = negotiationsByState.get('post_sale') ?? [];
  for (let i = 0; i < Math.min(postSaleNegs.length, 4); i++) {
    const neg = required(postSaleNegs[i], `post_sale[${i}]`);
    const supId = supervisorIds[i % supervisorIds.length];
    matrixDefs.push({
      negotiationId: neg.id,
      creatorId: neg.advisorId,
      state: 'APPROVED',
      approvedBy: supId ?? null,
      observations: 'Oferta cerrada y en seguimiento post-venta',
      itemIndices: [i % items.length, (i + 1) % items.length],
      quantities: [8 + i, 3],
    });
  }

  const rejectedNeg = negotiationNegs[negotiationNegs.length - 1];
  if (rejectedNeg) {
    const supId = supervisorIds[0];
    matrixDefs.push({
      negotiationId: rejectedNeg.id,
      creatorId: rejectedNeg.advisorId,
      state: 'REJECTED',
      approvedBy: supId ?? null,
      observations: 'Rechazada: precios fuera del rango aprobado',
      itemIndices: [0, 1],
      quantities: [10, 5],
    });
  }

  let matricesCreated = 0;
  let lineItemsCreated = 0;

  for (const def of matrixDefs) {
    const selectedItems = def.itemIndices.map((idx) => required(items[idx], `item[${idx}]`));
    let totalAmount = 0;
    const lineItemValues = selectedItems.map((item, j) => {
      const qty = def.quantities[j] ?? 1;
      const unitPrice = Number(item.price);
      const total = unitPrice * qty;
      totalAmount += total;
      return { itemId: item.id, quantity: qty, unitPrice: item.price, total: total.toFixed(2) };
    });

    const [matrix] = await db
      .insert(offerMatrices)
      .values({
        negotiationId: def.negotiationId,
        creatorId: def.creatorId,
        state: def.state,
        approvedBy: def.approvedBy,
        observations: def.observations,
        totalAmount: totalAmount.toFixed(2),
        approvalDate:
          def.state === 'APPROVED' || def.state === 'REJECTED'
            ? new Date('2026-06-10T10:00:00-05:00')
            : null,
        supervisorMessage:
          def.state === 'REJECTED'
            ? 'Los precios unitarios exceden el tope para este segmento'
            : def.state === 'APPROVED'
              ? 'Oferta revisada y aprobada'
              : null,
      })
      .onConflictDoNothing()
      .returning();

    if (!matrix) continue;
    matricesCreated++;

    const liValues = lineItemValues.map((li) => ({
      matrixId: matrix.id,
      ...li,
    }));

    const inserted = await db
      .insert(matrixLineItems)
      .values(liValues)
      .onConflictDoNothing()
      .returning();
    lineItemsCreated += inserted.length;

    const historyEntries = [];

    historyEntries.push({
      matrixId: matrix.id,
      previousState: null,
      newState: 'DRAFT' as const,
      changedBy: def.creatorId,
      notes: 'Matriz creada',
    });

    if (def.state !== 'DRAFT') {
      historyEntries.push({
        matrixId: matrix.id,
        previousState: 'DRAFT' as const,
        newState: 'PENDING_APPROVAL' as const,
        changedBy: def.creatorId,
        notes: 'Enviada para aprobacion',
      });
    }

    if (def.state === 'APPROVED') {
      historyEntries.push({
        matrixId: matrix.id,
        previousState: 'PENDING_APPROVAL' as const,
        newState: 'APPROVED' as const,
        changedBy: def.approvedBy ?? def.creatorId,
        notes: 'Aprobada por supervisor',
      });
    }

    if (def.state === 'REJECTED') {
      historyEntries.push({
        matrixId: matrix.id,
        previousState: 'PENDING_APPROVAL' as const,
        newState: 'REJECTED' as const,
        changedBy: def.approvedBy ?? def.creatorId,
        notes: 'Rechazada: precios fuera de rango',
      });
    }

    await db.insert(matrixStateHistory).values(historyEntries).onConflictDoNothing();
  }

  process.stdout.write(
    `Created ${matricesCreated} offer matrices with ${lineItemsCreated} line items\n`
  );

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
