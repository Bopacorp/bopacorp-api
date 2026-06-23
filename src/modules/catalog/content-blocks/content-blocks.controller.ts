import type {
  CreateContentBlockRequest,
  ListContentBlocksQuery,
  UpdateContentBlockRequest,
} from '@bopacorp/shared/catalog';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './content-blocks.service.js';

export async function listContentBlocks(req: Request, res: Response) {
  const query = req.query as unknown as ListContentBlocksQuery;
  const result = await service.listContentBlocks(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getContentBlockById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getContentBlockById(req.params.id);
  res.json({ success: true, data });
}

export async function createContentBlock(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createContentBlock(req.body as CreateContentBlockRequest, req.user.id);
  res.status(201).json({ success: true, data });
}

export async function updateContentBlock(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.updateContentBlock(
    req.params.id,
    req.body as UpdateContentBlockRequest,
    req.user.id
  );
  res.json({ success: true, data });
}

export async function deleteContentBlock(req: Request<{ id: string }>, res: Response) {
  await service.deleteContentBlock(req.params.id);
  res.json({ success: true, data: null });
}
