import type { ListPublicCatalogQuery } from '@bopacorp/shared';
import type { Request, Response } from 'express';
import * as service from './public-catalog.service.js';

export async function listItems(req: Request, res: Response) {
  const filters = req.query as unknown as ListPublicCatalogQuery;
  const data = await service.listPublicCatalogItems(filters);
  res.json({ success: true, data });
}

export async function listCategories(_req: Request, res: Response) {
  const data = await service.listPublicCategories();
  res.json({ success: true, data });
}

export async function listSegments(_req: Request, res: Response) {
  const data = await service.listPublicSegments();
  res.json({ success: true, data });
}
