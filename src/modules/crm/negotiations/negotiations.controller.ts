import type {
  ChangeNegotiationStateRequest,
  CreateNegotiationRequest,
  ListNegotiationsQuery,
  UpdateNegotiationRequest,
} from '@bopacorp/shared/crm';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './negotiations.service.js';

export async function listNegotiations(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const query = req.query as unknown as ListNegotiationsQuery;
  const result = await service.listNegotiations(query, req.user);
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
