import type {
  CreateCatalogItemRequest,
  ListCatalogItemsQuery,
  UpdateCatalogItemRequest,
} from '@bopacorp/shared/catalog';
import { BadRequestError } from '@shared/errors/http-error.js';
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

export async function uploadImage(req: Request<{ id: string }>, res: Response) {
  if (!req.file) {
    throw new BadRequestError('No image file provided');
  }
  const data = await service.uploadItemImage(req.params.id, req.file);
  res.json({ success: true, data });
}

export async function deleteImage(req: Request<{ id: string }>, res: Response) {
  await service.deleteItemImage(req.params.id);
  res.json({ success: true, data: null });
}
