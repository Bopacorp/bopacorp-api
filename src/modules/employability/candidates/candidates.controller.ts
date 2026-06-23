import type {
  CreateCandidateRequest,
  ListCandidatesQuery,
  UpdateCandidateRequest,
} from '@bopacorp/shared/employability';
import type { Request, Response } from 'express';
import * as service from './candidates.service.js';

export async function listCandidates(req: Request, res: Response) {
  const query = req.query as unknown as ListCandidatesQuery;
  const result = await service.listCandidates(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getCandidateById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getCandidateById(req.params.id);
  res.json({ success: true, data });
}

export async function createCandidate(req: Request, res: Response) {
  const data = await service.createCandidate(req.body as CreateCandidateRequest);
  res.status(201).json({ success: true, data });
}

export async function updateCandidate(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateCandidate(req.params.id, req.body as UpdateCandidateRequest);
  res.json({ success: true, data });
}

export async function removeCandidate(req: Request<{ id: string }>, res: Response) {
  await service.removeCandidate(req.params.id);
  res.json({ success: true, data: null });
}
