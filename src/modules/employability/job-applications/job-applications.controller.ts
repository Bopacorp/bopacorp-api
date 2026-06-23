import type {
  CreateJobApplicationRequest,
  ListJobApplicationsQuery,
  UpdateJobApplicationRequest,
} from '@bopacorp/shared/employability';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './job-applications.service.js';

export async function listJobApplications(req: Request, res: Response) {
  const query = req.query as unknown as ListJobApplicationsQuery;
  const result = await service.listJobApplications(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getJobApplicationById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getJobApplicationById(req.params.id);
  res.json({ success: true, data });
}

export async function createJobApplication(req: Request, res: Response) {
  const data = await service.createJobApplication(req.body as CreateJobApplicationRequest);
  res.status(201).json({ success: true, data });
}

export async function updateJobApplication(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.updateJobApplication(
    req.params.id,
    req.user.id,
    req.body as UpdateJobApplicationRequest
  );
  res.json({ success: true, data });
}

export async function removeJobApplication(req: Request<{ id: string }>, res: Response) {
  await service.removeJobApplication(req.params.id);
  res.json({ success: true, data: null });
}
