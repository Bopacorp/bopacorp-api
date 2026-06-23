import type {
  CreateVisitRequest,
  ListVisitsQuery,
  UpdateVisitRequest,
  VerifyVisitRequest,
} from '@bopacorp/shared/crm';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './visits.service.js';

export async function listVisits(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const query = req.query as unknown as ListVisitsQuery;
  const result = await service.listVisits(query, req.user);
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
