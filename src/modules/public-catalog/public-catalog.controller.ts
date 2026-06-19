import type { Request, Response } from 'express';
import * as service from './public-catalog.service.js';

export async function listItems(_req: Request, res: Response) {
  const data = await service.listPublicCatalogItems();
  res.json({ success: true, data });
}
