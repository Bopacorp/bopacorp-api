import {
  CreateJobVacancyRequestSchema,
  ListJobVacanciesQuerySchema,
  UpdateJobVacancyRequestSchema,
} from '@bopacorp/shared/employability';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './vacancies.controller.js';

export const vacanciesRoutes = Router();

const publicReadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});

vacanciesRoutes.get(
  '/published',
  validate({ query: ListJobVacanciesQuerySchema }),
  controller.listPublishedVacancies
);

vacanciesRoutes.get(
  '/:id/public',
  publicReadRateLimit,
  validate({ params: IdParamSchema }),
  controller.getPublishedVacancyById
);

vacanciesRoutes.get(
  '/',
  authenticate,
  authorize('job_vacancies.read'),
  validate({ query: ListJobVacanciesQuerySchema }),
  controller.listVacancies
);

vacanciesRoutes.get(
  '/:id',
  authenticate,
  authorize('job_vacancies.read'),
  validate({ params: IdParamSchema }),
  controller.getVacancyById
);

vacanciesRoutes.post(
  '/',
  authenticate,
  authorize('job_vacancies.create'),
  validate({ body: CreateJobVacancyRequestSchema }),
  controller.createVacancy
);

vacanciesRoutes.patch(
  '/:id',
  authenticate,
  authorize('job_vacancies.update'),
  validate({ params: IdParamSchema, body: UpdateJobVacancyRequestSchema }),
  controller.updateVacancy
);

vacanciesRoutes.delete(
  '/:id',
  authenticate,
  authorize('job_vacancies.delete'),
  validate({ params: IdParamSchema }),
  controller.removeVacancy
);
