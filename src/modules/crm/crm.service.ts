import type {
  ChangeNegotiationStateRequest,
  CreateBusinessClientRequest,
  CreateNegotiationRequest,
  CreateNegotiationStateRequest,
  CreateVisitRequest,
  CreateVisitTypeRequest,
  ListBusinessClientsQuery,
  ListNegotiationStatesQuery,
  ListNegotiationsQuery,
  ListVisitsQuery,
  ListVisitTypesQuery,
  UpdateBusinessClientRequest,
  UpdateNegotiationRequest,
  UpdateNegotiationStateRequest,
  UpdateVisitRequest,
  UpdateVisitTypeRequest,
  VerifyVisitRequest,
} from '@bopacorp/shared/crm';
import { users } from '@db/schema/auth.js';
import { employees } from '@db/schema/core.js';
import {
  businessClients,
  negotiationStateHistory,
  negotiationStates,
  negotiations,
  visits,
  visitTypes,
} from '@db/schema/crm.js';
import { db } from '@lib/db.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { and, eq, gte, ilike, isNull, lte, or, type SQL, sql } from 'drizzle-orm';

// ── Helpers ──

function formatDateTime(d: Date | null): string {
  return d ? d.toISOString() : '';
}

// ── Negotiation States ──

export async function listNegotiationStates(query: ListNegotiationStatesQuery) {
  const conditions = [];

  if (query.isActive !== undefined) {
    conditions.push(eq(negotiationStates.isActive, query.isActive));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(or(ilike(negotiationStates.name, term), ilike(negotiationStates.code, term)));
  }

  const where = conditions.length > 0 ? and(...conditions) : sql`true`;

  const totalItems = await db.$count(negotiationStates, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(negotiationStates)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(negotiationStates.createdAt);

  return {
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getNegotiationStateById(id: string) {
  const row = await db.query.negotiationStates.findFirst({
    where: eq(negotiationStates.id, id),
  });

  if (!row) {
    throw new NotFoundError('Negotiation state', id);
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createNegotiationState(data: CreateNegotiationStateRequest) {
  const existing = await db
    .select()
    .from(negotiationStates)
    .where(eq(negotiationStates.code, data.code));

  if (existing.length > 0) {
    throw new ConflictError('Negotiation state with this code already exists');
  }

  const [row] = await db
    .insert(negotiationStates)
    .values({
      code: data.code,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create negotiation state');
  }

  return getNegotiationStateById(row.id);
}

export async function updateNegotiationState(id: string, data: UpdateNegotiationStateRequest) {
  await getNegotiationStateById(id);

  const updateData: Partial<typeof negotiationStates.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) {
    const existing = await db
      .select()
      .from(negotiationStates)
      .where(and(eq(negotiationStates.code, data.code), eq(negotiationStates.id, id)));

    if (existing.length > 0) {
      throw new ConflictError('Negotiation state with this code already exists');
    }
    updateData.code = data.code;
  }

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(negotiationStates).set(updateData).where(eq(negotiationStates.id, id));
  }

  return getNegotiationStateById(id);
}

export async function removeNegotiationState(id: string) {
  await getNegotiationStateById(id);

  const inUse = await db
    .select({ count: negotiationStates.id })
    .from(negotiations)
    .where(eq(negotiations.stateId, id));

  if (inUse.length > 0) {
    await db
      .update(negotiationStates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(negotiationStates.id, id));
    return;
  }

  await db.delete(negotiationStates).where(eq(negotiationStates.id, id));
}

// ── Visit Types ──

export async function listVisitTypes(query: ListVisitTypesQuery) {
  const conditions = [];

  if (query.isActive !== undefined) {
    conditions.push(eq(visitTypes.isActive, query.isActive));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(or(ilike(visitTypes.name, term), ilike(visitTypes.code, term)));
  }

  const where = conditions.length > 0 ? and(...conditions) : sql`true`;

  const totalItems = await db.$count(visitTypes, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(visitTypes)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(visitTypes.createdAt);

  return {
    data: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getVisitTypeById(id: string) {
  const row = await db.query.visitTypes.findFirst({
    where: eq(visitTypes.id, id),
  });

  if (!row) {
    throw new NotFoundError('Visit type', id);
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createVisitType(data: CreateVisitTypeRequest) {
  const existing = await db.select().from(visitTypes).where(eq(visitTypes.code, data.code));

  if (existing.length > 0) {
    throw new ConflictError('Visit type with this code already exists');
  }

  const [row] = await db
    .insert(visitTypes)
    .values({
      code: data.code,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create visit type');
  }

  return getVisitTypeById(row.id);
}

export async function updateVisitType(id: string, data: UpdateVisitTypeRequest) {
  await getVisitTypeById(id);

  const updateData: Partial<typeof visitTypes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) {
    const existing = await db
      .select()
      .from(visitTypes)
      .where(and(eq(visitTypes.code, data.code), eq(visitTypes.id, id)));

    if (existing.length > 0) {
      throw new ConflictError('Visit type with this code already exists');
    }
    updateData.code = data.code;
  }

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(visitTypes).set(updateData).where(eq(visitTypes.id, id));
  }

  return getVisitTypeById(id);
}

export async function removeVisitType(id: string) {
  await getVisitTypeById(id);

  const inUse = await db
    .select({ count: visits.id })
    .from(visits)
    .where(eq(visits.visitTypeId, id));

  if (inUse.length > 0) {
    await db
      .update(visitTypes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(visitTypes.id, id));
    return;
  }

  await db.delete(visitTypes).where(eq(visitTypes.id, id));
}

// ── Business Clients ──

export async function listBusinessClients(query: ListBusinessClientsQuery) {
  const conditions = [];
  conditions.push(isNull(businessClients.deletedAt));

  if (query.isActive !== undefined) {
    conditions.push(eq(businessClients.isActive, query.isActive));
  }

  if (query.advisorId) {
    conditions.push(eq(businessClients.advisorId, query.advisorId));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(businessClients.businessName, term),
        ilike(businessClients.contactName, term),
        ilike(businessClients.ruc, term)
      ) as SQL<unknown>
    );
  }

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(businessClients, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: businessClients.id,
      ruc: businessClients.ruc,
      businessName: businessClients.businessName,
      contactName: businessClients.contactName,
      isActive: businessClients.isActive,
      createdAt: businessClients.createdAt,
      updatedAt: businessClients.updatedAt,
      advisor: { id: users.id, username: users.username },
    })
    .from(businessClients)
    .leftJoin(users, eq(businessClients.advisorId, users.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(businessClients.createdAt);

  return {
    data: rows.map((row) => ({
      ...row,
      advisor: row.advisor ? row.advisor : null,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getBusinessClientById(id: string) {
  const row = await db.query.businessClients.findFirst({
    where: and(eq(businessClients.id, id), isNull(businessClients.deletedAt)),
    with: { advisor: { with: { user: true } } },
  });

  if (!row) {
    throw new NotFoundError('Business client', id);
  }

  const advisor = row.advisor;
  const user = advisor?.user;

  return {
    id: row.id,
    ruc: row.ruc,
    businessName: row.businessName,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    address: row.address,
    activeServicesCount: row.activeServicesCount,
    currentMonthlyBilling: Number(row.currentMonthlyBilling),
    isActive: row.isActive,
    advisor: advisor
      ? {
          id: advisor.userId,
          username: user?.username ?? '',
          email: user?.email ?? '',
          profile: null,
        }
      : null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createBusinessClient(data: CreateBusinessClientRequest) {
  const existing = await db
    .select()
    .from(businessClients)
    .where(and(eq(businessClients.ruc, data.ruc), isNull(businessClients.deletedAt)));

  if (existing.length > 0) {
    throw new ConflictError('Business client with this RUC already exists');
  }

  if (data.advisorId) {
    const advisor = await db.query.employees.findFirst({
      where: eq(employees.userId, data.advisorId),
    });

    if (!advisor) {
      throw new NotFoundError('Advisor', data.advisorId);
    }
  }

  const [row] = await db
    .insert(businessClients)
    .values({
      advisorId: data.advisorId,
      ruc: data.ruc,
      businessName: data.businessName,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      address: data.address,
      activeServicesCount: data.activeServicesCount,
      currentMonthlyBilling: data.currentMonthlyBilling.toString(),
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create business client');
  }

  return getBusinessClientById(row.id);
}

export async function updateBusinessClient(id: string, data: UpdateBusinessClientRequest) {
  await getBusinessClientById(id);

  const updateData: Partial<typeof businessClients.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.ruc !== undefined) {
    const existing = await db
      .select()
      .from(businessClients)
      .where(and(eq(businessClients.ruc, data.ruc), isNull(businessClients.deletedAt)));

    if (existing.length > 0 && existing[0]?.id !== id) {
      throw new ConflictError('Business client with this RUC already exists');
    }
    updateData.ruc = data.ruc;
  }

  if (data.advisorId !== undefined) {
    if (data.advisorId) {
      const advisor = await db.query.employees.findFirst({
        where: eq(employees.userId, data.advisorId),
      });

      if (!advisor) {
        throw new NotFoundError('Advisor', data.advisorId);
      }
    }
    updateData.advisorId = data.advisorId;
  }

  if (data.businessName !== undefined) updateData.businessName = data.businessName;
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.activeServicesCount !== undefined)
    updateData.activeServicesCount = data.activeServicesCount;
  if (data.currentMonthlyBilling !== undefined)
    updateData.currentMonthlyBilling = data.currentMonthlyBilling.toString();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(businessClients).set(updateData).where(eq(businessClients.id, id));
  }

  return getBusinessClientById(id);
}

export async function removeBusinessClient(id: string) {
  await getBusinessClientById(id);
  await db.update(businessClients).set({ deletedAt: new Date() }).where(eq(businessClients.id, id));
}

// ── Negotiations ──

export async function listNegotiations(query: ListNegotiationsQuery) {
  const conditions = [];
  conditions.push(isNull(negotiations.deletedAt));

  if (query.isActive !== undefined) {
    conditions.push(eq(negotiations.isActive, query.isActive));
  }

  if (query.clientId) {
    conditions.push(eq(negotiations.clientId, query.clientId));
  }

  if (query.advisorId) {
    conditions.push(eq(negotiations.advisorId, query.advisorId));
  }

  if (query.stateId) {
    conditions.push(eq(negotiations.stateId, query.stateId));
  }

  if (query.search) {
    conditions.push(ilike(negotiations.observations, `%${query.search}%`));
  }

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(negotiations, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: negotiations.id,
      startDate: negotiations.startDate,
      estimatedCloseDate: negotiations.estimatedCloseDate,
      isActive: negotiations.isActive,
      createdAt: negotiations.createdAt,
      updatedAt: negotiations.updatedAt,
      client: { id: businessClients.id, businessName: businessClients.businessName },
      advisor: { id: users.id, username: users.username },
      state: {
        id: negotiationStates.id,
        code: negotiationStates.code,
        name: negotiationStates.name,
      },
    })
    .from(negotiations)
    .innerJoin(businessClients, eq(negotiations.clientId, businessClients.id))
    .innerJoin(users, eq(negotiations.advisorId, users.id))
    .innerJoin(negotiationStates, eq(negotiations.stateId, negotiationStates.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(negotiations.createdAt);

  return {
    data: rows.map((row) => ({
      ...row,
      startDate: row.startDate,
      estimatedCloseDate: row.estimatedCloseDate,
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getNegotiationById(id: string) {
  const row = await db.query.negotiations.findFirst({
    where: and(eq(negotiations.id, id), isNull(negotiations.deletedAt)),
    with: {
      client: true,
      advisor: { with: { user: true } },
      state: true,
    },
  });

  if (!row) {
    throw new NotFoundError('Negotiation', id);
  }

  const advisor = row.advisor;
  const user = advisor?.user;

  return {
    id: row.id,
    startDate: row.startDate,
    estimatedCloseDate: row.estimatedCloseDate,
    observations: row.observations,
    isActive: row.isActive,
    client: {
      id: row.client.id,
      businessName: row.client.businessName,
      contactName: row.client.contactName,
    },
    advisor: {
      id: advisor.userId,
      username: user?.username ?? '',
      email: user?.email ?? '',
      profile: null,
    },
    state: {
      id: row.state.id,
      code: row.state.code,
      name: row.state.name,
    },
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createNegotiation(userId: string, data: CreateNegotiationRequest) {
  const client = await db.query.businessClients.findFirst({
    where: and(eq(businessClients.id, data.clientId), isNull(businessClients.deletedAt)),
  });

  if (!client) {
    throw new NotFoundError('Business client', data.clientId);
  }

  const advisor = await db.query.employees.findFirst({
    where: eq(employees.userId, data.advisorId),
  });

  if (!advisor) {
    throw new NotFoundError('Advisor', data.advisorId);
  }

  const state = await db.query.negotiationStates.findFirst({
    where: eq(negotiationStates.id, data.stateId),
  });

  if (!state) {
    throw new NotFoundError('Negotiation state', data.stateId);
  }

  const [row] = await db
    .insert(negotiations)
    .values({
      clientId: data.clientId,
      advisorId: data.advisorId,
      stateId: data.stateId,
      startDate: data.startDate ?? new Date().toISOString().slice(0, 10),
      estimatedCloseDate: data.estimatedCloseDate ?? null,
      observations: data.observations,
      isActive: data.isActive,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create negotiation');
  }

  await db.insert(negotiationStateHistory).values({
    negotiationId: row.id,
    newStateId: data.stateId,
    changedBy: userId,
    notes: 'Initial state',
  });

  return getNegotiationById(row.id);
}

export async function updateNegotiation(id: string, data: UpdateNegotiationRequest) {
  await getNegotiationById(id);

  const updateData: Partial<typeof negotiations.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.clientId !== undefined) {
    const client = await db.query.businessClients.findFirst({
      where: and(eq(businessClients.id, data.clientId), isNull(businessClients.deletedAt)),
    });

    if (!client) {
      throw new NotFoundError('Business client', data.clientId);
    }
    updateData.clientId = data.clientId;
  }

  if (data.advisorId !== undefined) {
    const advisor = await db.query.employees.findFirst({
      where: eq(employees.userId, data.advisorId),
    });

    if (!advisor) {
      throw new NotFoundError('Advisor', data.advisorId);
    }
    updateData.advisorId = data.advisorId;
  }

  if (data.stateId !== undefined) {
    const state = await db.query.negotiationStates.findFirst({
      where: eq(negotiationStates.id, data.stateId),
    });

    if (!state) {
      throw new NotFoundError('Negotiation state', data.stateId);
    }
    updateData.stateId = data.stateId;
  }

  if (data.startDate !== undefined) updateData.startDate = data.startDate;
  if (data.estimatedCloseDate !== undefined)
    updateData.estimatedCloseDate = data.estimatedCloseDate ?? null;
  if (data.observations !== undefined) updateData.observations = data.observations;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 1) {
    await db.update(negotiations).set(updateData).where(eq(negotiations.id, id));
  }

  return getNegotiationById(id);
}

export async function removeNegotiation(id: string) {
  await getNegotiationById(id);
  await db.update(negotiations).set({ deletedAt: new Date() }).where(eq(negotiations.id, id));
}

export async function changeNegotiationState(
  id: string,
  userId: string,
  data: ChangeNegotiationStateRequest
) {
  const negotiation = await getNegotiationById(id);

  const newState = await db.query.negotiationStates.findFirst({
    where: eq(negotiationStates.id, data.stateId),
  });

  if (!newState) {
    throw new NotFoundError('Negotiation state', data.stateId);
  }

  if (negotiation.state.id === data.stateId) {
    return negotiation;
  }

  await db
    .update(negotiations)
    .set({ stateId: data.stateId, updatedAt: new Date() })
    .where(eq(negotiations.id, id));

  await db.insert(negotiationStateHistory).values({
    negotiationId: id,
    previousStateId: negotiation.state.id,
    newStateId: data.stateId,
    changedBy: userId,
    notes: data.notes,
  });

  return getNegotiationById(id);
}

export async function getNegotiationHistory(id: string) {
  await getNegotiationById(id);

  const historyRows = await db.query.negotiationStateHistory.findMany({
    where: eq(negotiationStateHistory.negotiationId, id),
    with: {
      previousState: true,
      newState: true,
      changedBy: true,
    },
    orderBy: negotiationStateHistory.createdAt,
  });

  return historyRows.map((h) => ({
    id: h.id,
    previousState: h.previousState
      ? {
          id: h.previousState.id,
          code: h.previousState.code,
          name: h.previousState.name,
        }
      : null,
    newState: {
      id: h.newState.id,
      code: h.newState.code,
      name: h.newState.name,
    },
    changedBy: {
      id: h.changedBy.id,
      username: h.changedBy.username,
    },
    notes: h.notes,
    createdAt: formatDateTime(h.createdAt),
  }));
}

// ── Visits ──

export async function listVisits(query: ListVisitsQuery) {
  const conditions = [];
  conditions.push(isNull(visits.deletedAt));

  if (query.isVerified !== undefined) {
    conditions.push(eq(visits.isVerified, query.isVerified));
  }

  if (query.clientId) {
    conditions.push(eq(visits.clientId, query.clientId));
  }

  if (query.advisorId) {
    conditions.push(eq(visits.advisorId, query.advisorId));
  }

  if (query.visitTypeId) {
    conditions.push(eq(visits.visitTypeId, query.visitTypeId));
  }

  if (query.dateFrom) {
    conditions.push(gte(visits.visitDate, new Date(query.dateFrom)));
  }

  if (query.dateTo) {
    const endOfDay = new Date(query.dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(visits.visitDate, endOfDay));
  }

  if (query.search) {
    conditions.push(ilike(visits.observations, `%${query.search}%`));
  }

  const where = and(...conditions) ?? sql`true`;

  const totalItems = await db.$count(visits, where as SQL<unknown>);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: visits.id,
      visitDate: visits.visitDate,
      isVerified: visits.isVerified,
      createdAt: visits.createdAt,
      updatedAt: visits.updatedAt,
      client: { id: businessClients.id, businessName: businessClients.businessName },
      advisor: { id: users.id, username: users.username },
      visitType: { id: visitTypes.id, name: visitTypes.name },
    })
    .from(visits)
    .innerJoin(businessClients, eq(visits.clientId, businessClients.id))
    .innerJoin(users, eq(visits.advisorId, users.id))
    .innerJoin(visitTypes, eq(visits.visitTypeId, visitTypes.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(visits.visitDate);

  return {
    data: rows.map((row) => ({
      ...row,
      visitDate: formatDateTime(row.visitDate),
      createdAt: formatDateTime(row.createdAt),
      updatedAt: formatDateTime(row.updatedAt),
    })),
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getVisitById(id: string) {
  const row = await db.query.visits.findFirst({
    where: and(eq(visits.id, id), isNull(visits.deletedAt)),
    with: {
      client: true,
      advisor: { with: { user: true } },
      visitType: true,
      verifiedBy: true,
      negotiation: { with: { client: true } },
    },
  });

  if (!row) {
    throw new NotFoundError('Visit', id);
  }

  const advisor = row.advisor;
  const user = advisor?.user;

  return {
    id: row.id,
    visitDate: formatDateTime(row.visitDate),
    observations: row.observations,
    isVerified: row.isVerified,
    supervisorComment: row.supervisorComment,
    gpsLatitude: row.gpsLatitude ? Number(row.gpsLatitude) : null,
    gpsLongitude: row.gpsLongitude ? Number(row.gpsLongitude) : null,
    gpsAccuracy: row.gpsAccuracy ? Number(row.gpsAccuracy) : null,
    gpsTimestamp: row.gpsTimestamp ? formatDateTime(row.gpsTimestamp) : null,
    negotiation: row.negotiation
      ? {
          id: row.negotiation.id,
          client: {
            id: row.negotiation.client.id,
            businessName: row.negotiation.client.businessName,
          },
        }
      : null,
    client: {
      id: row.client.id,
      businessName: row.client.businessName,
      contactName: row.client.contactName,
    },
    advisor: {
      id: advisor.userId,
      username: user?.username ?? '',
      email: user?.email ?? '',
      profile: null,
    },
    verifiedBy: row.verifiedBy
      ? { id: row.verifiedBy.id, username: row.verifiedBy.username }
      : null,
    visitType: {
      id: row.visitType.id,
      name: row.visitType.name,
    },
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function createVisit(data: CreateVisitRequest) {
  const client = await db.query.businessClients.findFirst({
    where: and(eq(businessClients.id, data.clientId), isNull(businessClients.deletedAt)),
  });

  if (!client) {
    throw new NotFoundError('Business client', data.clientId);
  }

  const advisor = await db.query.employees.findFirst({
    where: eq(employees.userId, data.advisorId),
  });

  if (!advisor) {
    throw new NotFoundError('Advisor', data.advisorId);
  }

  const visitType = await db.query.visitTypes.findFirst({
    where: eq(visitTypes.id, data.visitTypeId),
  });

  if (!visitType) {
    throw new NotFoundError('Visit type', data.visitTypeId);
  }

  if (data.negotiationId) {
    const negotiation = await db.query.negotiations.findFirst({
      where: and(eq(negotiations.id, data.negotiationId), isNull(negotiations.deletedAt)),
    });

    if (!negotiation) {
      throw new NotFoundError('Negotiation', data.negotiationId);
    }
  }

  const [row] = await db
    .insert(visits)
    .values({
      negotiationId: data.negotiationId,
      clientId: data.clientId,
      advisorId: data.advisorId,
      visitTypeId: data.visitTypeId,
      visitDate: new Date(data.visitDate),
      observations: data.observations,
      gpsLatitude: data.gpsLatitude?.toString(),
      gpsLongitude: data.gpsLongitude?.toString(),
      gpsAccuracy: data.gpsAccuracy?.toString(),
      gpsTimestamp: data.gpsTimestamp ? new Date(data.gpsTimestamp) : null,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create visit');
  }

  return getVisitById(row.id);
}

export async function updateVisit(id: string, data: UpdateVisitRequest) {
  await getVisitById(id);

  const updateData: Partial<typeof visits.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.clientId !== undefined) {
    const client = await db.query.businessClients.findFirst({
      where: and(eq(businessClients.id, data.clientId), isNull(businessClients.deletedAt)),
    });

    if (!client) {
      throw new NotFoundError('Business client', data.clientId);
    }
    updateData.clientId = data.clientId;
  }

  if (data.advisorId !== undefined) {
    const advisor = await db.query.employees.findFirst({
      where: eq(employees.userId, data.advisorId),
    });

    if (!advisor) {
      throw new NotFoundError('Advisor', data.advisorId);
    }
    updateData.advisorId = data.advisorId;
  }

  if (data.visitTypeId !== undefined) {
    const visitType = await db.query.visitTypes.findFirst({
      where: eq(visitTypes.id, data.visitTypeId),
    });

    if (!visitType) {
      throw new NotFoundError('Visit type', data.visitTypeId);
    }
    updateData.visitTypeId = data.visitTypeId;
  }

  if (data.negotiationId !== undefined) {
    if (data.negotiationId) {
      const negotiation = await db.query.negotiations.findFirst({
        where: and(eq(negotiations.id, data.negotiationId), isNull(negotiations.deletedAt)),
      });

      if (!negotiation) {
        throw new NotFoundError('Negotiation', data.negotiationId);
      }
    }
    updateData.negotiationId = data.negotiationId;
  }

  if (data.visitDate !== undefined) updateData.visitDate = new Date(data.visitDate);
  if (data.observations !== undefined) updateData.observations = data.observations;
  if (data.gpsLatitude !== undefined) updateData.gpsLatitude = data.gpsLatitude?.toString();
  if (data.gpsLongitude !== undefined) updateData.gpsLongitude = data.gpsLongitude?.toString();
  if (data.gpsAccuracy !== undefined) updateData.gpsAccuracy = data.gpsAccuracy?.toString();
  if (data.gpsTimestamp !== undefined)
    updateData.gpsTimestamp = data.gpsTimestamp ? new Date(data.gpsTimestamp) : null;

  if (Object.keys(updateData).length > 1) {
    await db.update(visits).set(updateData).where(eq(visits.id, id));
  }

  return getVisitById(id);
}

export async function removeVisit(id: string) {
  await getVisitById(id);
  await db.update(visits).set({ deletedAt: new Date() }).where(eq(visits.id, id));
}

export async function verifyVisit(id: string, userId: string, data: VerifyVisitRequest) {
  await getVisitById(id);

  await db
    .update(visits)
    .set({
      isVerified: data.isVerified,
      verifiedBy: userId,
      supervisorComment: data.supervisorComment,
      updatedAt: new Date(),
    })
    .where(eq(visits.id, id));

  return getVisitById(id);
}
