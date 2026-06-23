import type {
  CreateCategoryRequest,
  ListCategoriesQuery,
  UpdateCategoryRequest,
} from '@bopacorp/shared/catalog';
import type { Request, Response } from 'express';
import * as service from './categories.service.js';

export async function listCategories(req: Request, res: Response) {
  const query = req.query as unknown as ListCategoriesQuery;
  const data = await service.listCategories(query);
  res.json({ success: true, data });
}

export async function getCategoryTree(_req: Request, res: Response) {
  const data = await service.getCategoryTree();
  res.json({ success: true, data });
}

export async function getCategoryById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getCategoryById(req.params.id);
  res.json({ success: true, data });
}

export async function createCategory(req: Request, res: Response) {
  const data = await service.createCategory(req.body as CreateCategoryRequest);
  res.status(201).json({ success: true, data });
}

export async function updateCategory(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateCategory(req.params.id, req.body as UpdateCategoryRequest);
  res.json({ success: true, data });
}

export async function disableCategory(req: Request<{ id: string }>, res: Response) {
  await service.disableCategory(req.params.id);
  res.json({ success: true, data: null });
}
