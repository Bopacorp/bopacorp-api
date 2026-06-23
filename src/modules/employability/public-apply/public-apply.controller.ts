import type { ApplyJobVacancyRequest } from '@bopacorp/shared/employability';
import { BadRequestError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './public-apply.service.js';

export async function applyJobVacancy(req: Request, res: Response) {
  if (!req.file) {
    throw new BadRequestError('No PDF file provided');
  }

  const data = await service.applyJobVacancy(
    req.body as ApplyJobVacancyRequest,
    req.file.buffer,
    req.file.originalname,
    req.file.size,
    req.file.mimetype
  );

  res.status(201).json({ success: true, data });
}
