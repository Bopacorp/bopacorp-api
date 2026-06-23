import {
  CreateJobApplicationRequestSchema,
  ListJobApplicationsQuerySchema,
  UpdateJobApplicationRequestSchema,
} from '@bopacorp/shared/employability';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './job-applications.controller.js';

export const jobApplicationsRoutes = Router();

jobApplicationsRoutes.get(
  '/',
  authenticate,
  authorize('job_applications.read'),
  validate({ query: ListJobApplicationsQuerySchema }),
  controller.listJobApplications
);

jobApplicationsRoutes.get(
  '/:id',
  authenticate,
  authorize('job_applications.read'),
  validate({ params: IdParamSchema }),
  controller.getJobApplicationById
);

jobApplicationsRoutes.post(
  '/',
  authenticate,
  authorize('job_applications.create'),
  validate({ body: CreateJobApplicationRequestSchema }),
  controller.createJobApplication
);

jobApplicationsRoutes.patch(
  '/:id',
  authenticate,
  authorize('job_applications.update'),
  validate({ params: IdParamSchema, body: UpdateJobApplicationRequestSchema }),
  controller.updateJobApplication
);

jobApplicationsRoutes.delete(
  '/:id',
  authenticate,
  authorize('job_applications.delete'),
  validate({ params: IdParamSchema }),
  controller.removeJobApplication
);
