import type {
  CreateGeoZoneRequest,
  ListGeoZonesQuery,
  UpdateGeoZoneRequest,
} from '@bopacorp/shared/catalog';
import type { Request, Response } from 'express';
import * as service from './geo-zones.service.js';

export async function listGeoZones(req: Request, res: Response) {
  const query = req.query as unknown as ListGeoZonesQuery;
  const data = await service.listGeoZones(query);
  res.json({ success: true, data });
}

export async function getGeoZoneById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getGeoZoneById(req.params.id);
  res.json({ success: true, data });
}

export async function createGeoZone(req: Request, res: Response) {
  const data = await service.createGeoZone(req.body as CreateGeoZoneRequest);
  res.status(201).json({ success: true, data });
}

export async function updateGeoZone(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateGeoZone(req.params.id, req.body as UpdateGeoZoneRequest);
  res.json({ success: true, data });
}

export async function disableGeoZone(req: Request<{ id: string }>, res: Response) {
  await service.disableGeoZone(req.params.id);
  res.json({ success: true, data: null });
}
