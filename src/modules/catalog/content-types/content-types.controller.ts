import type { Request, Response } from 'express';
import * as service from './content-types.service.js';

export async function list(_req: Request, res: Response) {
  const data = await service.listContentTypes();
  res.json({ success: true, data });
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getContentTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const data = await service.createContentType(req.body);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateContentType(req.params.id, req.body);
  res.json({ success: true, data });
}

export async function disable(req: Request<{ id: string }>, res: Response) {
  await service.disableContentType(req.params.id);
  res.json({ success: true, data: null });
}
