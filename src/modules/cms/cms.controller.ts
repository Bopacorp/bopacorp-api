import type { Request, Response } from 'express';
import * as service from './cms.service.js';

export async function getLandingBlocks(_req: Request, res: Response) {
  const data = await service.getPublicBlocks();
  res.json({ success: true, data });
}
