import { BadRequestError, UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './uploads.service.js';

export async function uploadImage(req: Request, res: Response) {
  if (!req.file) {
    throw new BadRequestError('Image is required');
  }

  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const { contentKey } = req.query as { contentKey?: string };
  const userId = req.user.id;

  const data = await service.uploadLandingImage(req.file, contentKey, userId);
  res.status(201).json({ success: true, data });
}
