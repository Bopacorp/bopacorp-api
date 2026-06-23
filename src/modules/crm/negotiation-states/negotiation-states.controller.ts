import type {
  CreateNegotiationStateRequest,
  ListNegotiationStatesQuery,
  UpdateNegotiationStateRequest,
} from '@bopacorp/shared/crm';
import type { Request, Response } from 'express';
import * as service from './negotiation-states.service.js';

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
