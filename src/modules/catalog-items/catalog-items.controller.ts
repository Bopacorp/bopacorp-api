import type {
  CreateCatalogItemRequest,
  ListCatalogItemsQuery,
  UpdateCatalogItemRequest,
} from '@bopacorp/shared/catalog';
import type { Request, Response } from 'express';
import * as service from './catalog-items.service.js';

export async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListCatalogItemsQuery;
  const result = await service.listCatalogItems(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getCatalogItemById(req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const data = await service.createCatalogItem(req.body as CreateCatalogItemRequest);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateCatalogItem(req.params.id, req.body as UpdateCatalogItemRequest);
  res.json({ success: true, data });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  await service.removeCatalogItem(req.params.id);
  res.json({ success: true, data: null });
}
