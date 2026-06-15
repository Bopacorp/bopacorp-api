import type { Readable } from 'node:stream';
import type {
  ApplyJobVacancyRequest,
  CreateCandidateRequest,
  CreateJobApplicationRequest,
  CreateJobVacancyRequest,
  ListCandidateResumesQuery,
  ListCandidatesQuery,
  ListJobApplicationsQuery,
  ListJobVacanciesQuery,
  PublicJobVacancyResponse,
  UpdateCandidateRequest,
  UpdateJobApplicationRequest,
  UpdateJobVacancyRequest,
  UploadCandidateResumeRequest,
} from '@bopacorp/shared/employability';
import { BadRequestError, UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './employability.service.js';

// Vacancies

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

// Published vacancies

export async function listPublishedVacancies(req: Request, res: Response) {
  const query = req.query as unknown as ListJobVacanciesQuery;
  const result = await service.listPublishedVacancies(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getPublishedVacancyById(req: Request<{ id: string }>, res: Response) {
  const data: PublicJobVacancyResponse = await service.getPublishedVacancyById(req.params.id);
  res.json({ success: true, data });
}

// Public apply

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

// Candidates

export async function listCandidates(req: Request, res: Response) {
  const query = req.query as unknown as ListCandidatesQuery;
  const result = await service.listCandidates(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getCandidateById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getCandidateById(req.params.id);
  res.json({ success: true, data });
}

export async function createCandidate(req: Request, res: Response) {
  const data = await service.createCandidate(req.body as CreateCandidateRequest);
  res.status(201).json({ success: true, data });
}

export async function updateCandidate(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateCandidate(req.params.id, req.body as UpdateCandidateRequest);
  res.json({ success: true, data });
}

export async function removeCandidate(req: Request<{ id: string }>, res: Response) {
  await service.removeCandidate(req.params.id);
  res.json({ success: true, data: null });
}

// Job applications

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

// Candidate resumes

export async function listCandidateResumes(req: Request, res: Response) {
  const query = req.query as unknown as ListCandidateResumesQuery;
  const result = await service.listCandidateResumes(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getCandidateResumeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getCandidateResumeById(req.params.id);
  res.json({ success: true, data });
}

// shoud this exist?
// why would we upload a resume without applying to a vacancy?
export async function uploadCandidateResume(req: Request, res: Response) {
  if (!req.file) {
    throw new BadRequestError('No PDF file provided');
  }

  const data = await service.uploadCandidateResume(
    req.body as UploadCandidateResumeRequest,
    req.file.buffer,
    req.file.originalname,
    req.file.size,
    req.file.mimetype
  );

  res.status(201).json({ success: true, data });
}

export async function downloadCandidateResume(req: Request<{ id: string }>, res: Response) {
  const { stream, resume } = await service.downloadCandidateResume(req.params.id);

  res.setHeader('Content-Type', resume.mimeType);

  const safeFilename = resume.filename.replace(/["\r\n]/g, '');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

  const readable = stream as Readable;

  readable.on('error', () => {
    if (!res.headersSent) {
      res.status(500).end();
    }
    readable.destroy();
  });

  res.on('error', () => {
    readable.destroy();
  });

  readable.pipe(res);
}

export async function removeCandidateResume(req: Request<{ id: string }>, res: Response) {
  await service.removeCandidateResume(req.params.id);
  res.json({ success: true, data: null });
}
