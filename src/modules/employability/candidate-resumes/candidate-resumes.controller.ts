import type { Readable } from 'node:stream';
import type {
  ListCandidateResumesQuery,
  UploadCandidateResumeRequest,
} from '@bopacorp/shared/employability';
import { BadRequestError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './candidate-resumes.service.js';

export async function listCandidateResumes(req: Request, res: Response) {
  const query = req.query as unknown as ListCandidateResumesQuery;
  const result = await service.listCandidateResumes(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getCandidateResumeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getCandidateResumeById(req.params.id);
  res.json({ success: true, data });
}

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
