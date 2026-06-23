import {
  ListCandidateResumesQuerySchema,
  UploadCandidateResumeRequestSchema,
} from '@bopacorp/shared/employability';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { uploadSinglePdf } from '@shared/middleware/upload.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './candidate-resumes.controller.js';

export const candidateResumesRoutes = Router();

candidateResumesRoutes.get(
  '/',
  authenticate,
  authorize('candidate_resumes.read'),
  validate({ query: ListCandidateResumesQuerySchema }),
  controller.listCandidateResumes
);

candidateResumesRoutes.get(
  '/:id',
  authenticate,
  authorize('candidate_resumes.read'),
  validate({ params: IdParamSchema }),
  controller.getCandidateResumeById
);

candidateResumesRoutes.get(
  '/:id/download',
  authenticate,
  authorize('candidate_resumes.read'),
  validate({ params: IdParamSchema }),
  controller.downloadCandidateResume
);

candidateResumesRoutes.post(
  '/',
  authenticate,
  authorize('candidate_resumes.create'),
  uploadSinglePdf,
  validate({ body: UploadCandidateResumeRequestSchema }),
  controller.uploadCandidateResume
);

candidateResumesRoutes.delete(
  '/:id',
  authenticate,
  authorize('candidate_resumes.delete'),
  validate({ params: IdParamSchema }),
  controller.removeCandidateResume
);
