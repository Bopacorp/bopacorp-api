import { BadRequestError, UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './document-uploads.service.js';

export async function uploadDocument(req: Request, res: Response) {
  if (!req.file) {
    throw new BadRequestError('Document file is required');
  }

  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const data = await service.uploadEncryptedDocument(req.file, req.user.id);
  res.status(201).json({ success: true, data });
}
