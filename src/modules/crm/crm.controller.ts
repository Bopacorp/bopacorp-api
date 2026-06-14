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
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './crm.service.js';

// ── Negotiation States ──

export async function listNegotiationStates(req: Request, res: Response) {
  const query = req.query as unknown as ListNegotiationStatesQuery;
  const result = await service.listNegotiationStates(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getNegotiationStateById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getNegotiationStateById(req.params.id);
  res.json({ success: true, data });
}

export async function createNegotiationState(req: Request, res: Response) {
  const data = await service.createNegotiationState(req.body as CreateNegotiationStateRequest);
  res.status(201).json({ success: true, data });
}

export async function updateNegotiationState(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateNegotiationState(
    req.params.id,
    req.body as UpdateNegotiationStateRequest
  );
  res.json({ success: true, data });
}

export async function removeNegotiationState(req: Request<{ id: string }>, res: Response) {
  await service.removeNegotiationState(req.params.id);
  res.json({ success: true, data: null });
}

// ── Visit Types ──

export async function listVisitTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListVisitTypesQuery;
  const result = await service.listVisitTypes(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getVisitTypeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getVisitTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function createVisitType(req: Request, res: Response) {
  const data = await service.createVisitType(req.body as CreateVisitTypeRequest);
  res.status(201).json({ success: true, data });
}

export async function updateVisitType(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateVisitType(req.params.id, req.body as UpdateVisitTypeRequest);
  res.json({ success: true, data });
}

export async function removeVisitType(req: Request<{ id: string }>, res: Response) {
  await service.removeVisitType(req.params.id);
  res.json({ success: true, data: null });
}

// ── Business Clients ──

export async function listBusinessClients(req: Request, res: Response) {
  const query = req.query as unknown as ListBusinessClientsQuery;
  const result = await service.listBusinessClients(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getBusinessClientById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getBusinessClientById(req.params.id);
  res.json({ success: true, data });
}

export async function createBusinessClient(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createBusinessClient(
    req.body as CreateBusinessClientRequest,
    req.user.id
  );
  res.status(201).json({ success: true, data });
}

export async function updateBusinessClient(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateBusinessClient(
    req.params.id,
    req.body as UpdateBusinessClientRequest
  );
  res.json({ success: true, data });
}

export async function removeBusinessClient(req: Request<{ id: string }>, res: Response) {
  await service.removeBusinessClient(req.params.id);
  res.json({ success: true, data: null });
}

// ── Negotiations ──

export async function listNegotiations(req: Request, res: Response) {
  const query = req.query as unknown as ListNegotiationsQuery;
  const result = await service.listNegotiations(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getNegotiationById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getNegotiationById(req.params.id);
  res.json({ success: true, data });
}

export async function createNegotiation(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createNegotiation(req.user.id, req.body as CreateNegotiationRequest);
  res.status(201).json({ success: true, data });
}

export async function updateNegotiation(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateNegotiation(req.params.id, req.body as UpdateNegotiationRequest);
  res.json({ success: true, data });
}

export async function removeNegotiation(req: Request<{ id: string }>, res: Response) {
  await service.removeNegotiation(req.params.id);
  res.json({ success: true, data: null });
}

export async function changeNegotiationState(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.changeNegotiationState(
    req.params.id,
    req.user.id,
    req.body as ChangeNegotiationStateRequest
  );
  res.json({ success: true, data });
}

export async function getNegotiationHistory(req: Request<{ id: string }>, res: Response) {
  const data = await service.getNegotiationHistory(req.params.id);
  res.json({ success: true, data });
}

// ── Visits ──

export async function listVisits(req: Request, res: Response) {
  const query = req.query as unknown as ListVisitsQuery;
  const result = await service.listVisits(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getVisitById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getVisitById(req.params.id);
  res.json({ success: true, data });
}

export async function createVisit(req: Request, res: Response) {
  const data = await service.createVisit(req.body as CreateVisitRequest);
  res.status(201).json({ success: true, data });
}

export async function updateVisit(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateVisit(req.params.id, req.body as UpdateVisitRequest);
  res.json({ success: true, data });
}

export async function removeVisit(req: Request<{ id: string }>, res: Response) {
  await service.removeVisit(req.params.id);
  res.json({ success: true, data: null });
}

export async function verifyVisit(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.verifyVisit(
    req.params.id,
    req.user.id,
    req.body as VerifyVisitRequest
  );
  res.json({ success: true, data });
}
