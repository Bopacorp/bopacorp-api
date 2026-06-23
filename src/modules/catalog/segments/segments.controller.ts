import type {
  CreateSegmentRequest,
  ListSegmentsQuery,
  UpdateSegmentRequest,
} from '@bopacorp/shared/catalog';
import type { Request, Response } from 'express';
import * as service from './segments.service.js';

export async function listSegments(req: Request, res: Response) {
  const query = req.query as unknown as ListSegmentsQuery;
  const data = await service.listSegments(query);
  res.json({ success: true, data });
}

export async function getSegmentById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getSegmentById(req.params.id);
  res.json({ success: true, data });
}

export async function createSegment(req: Request, res: Response) {
  const data = await service.createSegment(req.body as CreateSegmentRequest);
  res.status(201).json({ success: true, data });
}

export async function updateSegment(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateSegment(req.params.id, req.body as UpdateSegmentRequest);
  res.json({ success: true, data });
}

export async function disableSegment(req: Request<{ id: string }>, res: Response) {
  await service.disableSegment(req.params.id);
  res.json({ success: true, data: null });
}
