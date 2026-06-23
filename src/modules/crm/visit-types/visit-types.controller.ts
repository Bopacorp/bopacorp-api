import type {
  CreateVisitTypeRequest,
  ListVisitTypesQuery,
  UpdateVisitTypeRequest,
} from '@bopacorp/shared/crm';
import type { Request, Response } from 'express';
import * as service from './visit-types.service.js';

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
