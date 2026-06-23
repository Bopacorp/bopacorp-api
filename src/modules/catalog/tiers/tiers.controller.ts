import type {
  CreateTierRequest,
  ListTiersQuery,
  UpdateTierRequest,
} from '@bopacorp/shared/catalog';
import type { Request, Response } from 'express';
import * as service from './tiers.service.js';

export async function listTiers(req: Request, res: Response) {
  const query = req.query as unknown as ListTiersQuery;
  const data = await service.listTiers(query);
  res.json({ success: true, data });
}

export async function getTierById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getTierById(req.params.id);
  res.json({ success: true, data });
}

export async function createTier(req: Request, res: Response) {
  const data = await service.createTier(req.body as CreateTierRequest);
  res.status(201).json({ success: true, data });
}

export async function updateTier(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateTier(req.params.id, req.body as UpdateTierRequest);
  res.json({ success: true, data });
}

export async function disableTier(req: Request<{ id: string }>, res: Response) {
  await service.disableTier(req.params.id);
  res.json({ success: true, data: null });
}
