import type {
  CreateItemTypeRequest,
  ListItemTypesQuery,
  UpdateItemTypeRequest,
} from '@bopacorp/shared/catalog';
import type { Request, Response } from 'express';
import * as service from './item-types.service.js';

export async function listItemTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListItemTypesQuery;
  const data = await service.listItemTypes(query);
  res.json({ success: true, data });
}

export async function getItemTypeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getItemTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function createItemType(req: Request, res: Response) {
  const data = await service.createItemType(req.body as CreateItemTypeRequest);
  res.status(201).json({ success: true, data });
}

export async function updateItemType(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateItemType(req.params.id, req.body as UpdateItemTypeRequest);
  res.json({ success: true, data });
}

export async function disableItemType(req: Request<{ id: string }>, res: Response) {
  await service.disableItemType(req.params.id);
  res.json({ success: true, data: null });
}
