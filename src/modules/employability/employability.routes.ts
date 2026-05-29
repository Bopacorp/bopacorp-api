import {
  CreateCandidateRequestSchema,
  CreateCandidateResumeRequestSchema,
  CreateJobApplicationRequestSchema,
  CreateJobVacancyRequestSchema,
  ListCandidateResumesQuerySchema,
  ListCandidatesQuerySchema,
  ListJobApplicationsQuerySchema,
  ListJobVacanciesQuerySchema,
  UpdateCandidateRequestSchema,
  UpdateJobApplicationRequestSchema,
  UpdateJobVacancyRequestSchema,
} from '@bopacorp/shared/employability';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './employability.controller.js';

export const employabilityRoutes = Router();

// Published vacancies (public)
employabilityRoutes.get(
  '/vacancies/published',
  validate({ query: ListJobVacanciesQuerySchema }),
  controller.listPublishedVacancies
);

// Vacancies (admin)
employabilityRoutes.get(
  '/vacancies',
  authenticate,
  authorize('job_vacancies.read'),
  validate({ query: ListJobVacanciesQuerySchema }),
  controller.listVacancies
);

employabilityRoutes.get(
  '/vacancies/:id',
  authenticate,
  authorize('job_vacancies.read'),
  validate({ params: IdParamSchema }),
  controller.getVacancyById
);

employabilityRoutes.post(
  '/vacancies',
  authenticate,
  authorize('job_vacancies.create'),
  validate({ body: CreateJobVacancyRequestSchema }),
  controller.createVacancy
);

employabilityRoutes.patch(
  '/vacancies/:id',
  authenticate,
  authorize('job_vacancies.update'),
  validate({ params: IdParamSchema, body: UpdateJobVacancyRequestSchema }),
  controller.updateVacancy
);

employabilityRoutes.delete(
  '/vacancies/:id',
  authenticate,
  authorize('job_vacancies.delete'),
  validate({ params: IdParamSchema }),
  controller.removeVacancy
);

// Candidates (admin)
employabilityRoutes.get(
  '/candidates',
  authenticate,
  authorize('candidates.read'),
  validate({ query: ListCandidatesQuerySchema }),
  controller.listCandidates
);

employabilityRoutes.get(
  '/candidates/:id',
  authenticate,
  authorize('candidates.read'),
  validate({ params: IdParamSchema }),
  controller.getCandidateById
);

employabilityRoutes.post(
  '/candidates',
  authenticate,
  authorize('candidates.create'),
  validate({ body: CreateCandidateRequestSchema }),
  controller.createCandidate
);

employabilityRoutes.patch(
  '/candidates/:id',
  authenticate,
  authorize('candidates.update'),
  validate({ params: IdParamSchema, body: UpdateCandidateRequestSchema }),
  controller.updateCandidate
);

employabilityRoutes.delete(
  '/candidates/:id',
  authenticate,
  authorize('candidates.delete'),
  validate({ params: IdParamSchema }),
  controller.removeCandidate
);

// Job applications (admin)
employabilityRoutes.get(
  '/job-applications',
  authenticate,
  authorize('job_applications.read'),
  validate({ query: ListJobApplicationsQuerySchema }),
  controller.listJobApplications
);

employabilityRoutes.get(
  '/job-applications/:id',
  authenticate,
  authorize('job_applications.read'),
  validate({ params: IdParamSchema }),
  controller.getJobApplicationById
);

employabilityRoutes.post(
  '/job-applications',
  authenticate,
  authorize('job_applications.create'),
  validate({ body: CreateJobApplicationRequestSchema }),
  controller.createJobApplication
);

employabilityRoutes.patch(
  '/job-applications/:id',
  authenticate,
  authorize('job_applications.update'),
  validate({ params: IdParamSchema, body: UpdateJobApplicationRequestSchema }),
  controller.updateJobApplication
);

employabilityRoutes.delete(
  '/job-applications/:id',
  authenticate,
  authorize('job_applications.delete'),
  validate({ params: IdParamSchema }),
  controller.removeJobApplication
);

// Candidate resumes (admin)
employabilityRoutes.get(
  '/candidate-resumes',
  authenticate,
  authorize('candidate_resumes.read'),
  validate({ query: ListCandidateResumesQuerySchema }),
  controller.listCandidateResumes
);

employabilityRoutes.get(
  '/candidate-resumes/:id',
  authenticate,
  authorize('candidate_resumes.read'),
  validate({ params: IdParamSchema }),
  controller.getCandidateResumeById
);

employabilityRoutes.post(
  '/candidate-resumes',
  authenticate,
  authorize('candidate_resumes.create'),
  validate({ body: CreateCandidateResumeRequestSchema }),
  controller.createCandidateResume
);

employabilityRoutes.delete(
  '/candidate-resumes/:id',
  authenticate,
  authorize('candidate_resumes.delete'),
  validate({ params: IdParamSchema }),
  controller.removeCandidateResume
);
