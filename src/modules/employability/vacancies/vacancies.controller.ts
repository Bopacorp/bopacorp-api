import type {
  CreateJobVacancyRequest,
  ListJobVacanciesQuery,
  PublicJobVacancyResponse,
  UpdateJobVacancyRequest,
} from '@bopacorp/shared/employability';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './vacancies.service.js';

export async function listVacancies(req: Request, res: Response) {
  const query = req.query as unknown as ListJobVacanciesQuery;
  const result = await service.listVacancies(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getVacancyById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getVacancyById(req.params.id);
  res.json({ success: true, data });
}

export async function createVacancy(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createVacancy(req.user.id, req.body as CreateJobVacancyRequest);
  res.status(201).json({ success: true, data });
}

export async function updateVacancy(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateVacancy(req.params.id, req.body as UpdateJobVacancyRequest);
  res.json({ success: true, data });
}

export async function removeVacancy(req: Request<{ id: string }>, res: Response) {
  await service.removeVacancy(req.params.id);
  res.json({ success: true, data: null });
}

export async function listPublishedVacancies(req: Request, res: Response) {
  const query = req.query as unknown as ListJobVacanciesQuery;
  const result = await service.listPublishedVacancies(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getPublishedVacancyById(req: Request<{ id: string }>, res: Response) {
  const data: PublicJobVacancyResponse = await service.getPublishedVacancyById(req.params.id);
  res.json({ success: true, data });
}
