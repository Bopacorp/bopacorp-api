import { Router } from 'express';
import { candidateResumesRoutes } from './candidate-resumes/candidate-resumes.routes.js';
import { candidatesRoutes } from './candidates/candidates.routes.js';
import { jobApplicationsRoutes } from './job-applications/job-applications.routes.js';
import { publicApplyRoutes } from './public-apply/public-apply.routes.js';
import { vacanciesRoutes } from './vacancies/vacancies.routes.js';

export const employabilityRoutes = Router();

employabilityRoutes.use('/vacancies', vacanciesRoutes);
employabilityRoutes.use('/candidates', candidatesRoutes);
employabilityRoutes.use('/job-applications', jobApplicationsRoutes);
employabilityRoutes.use('/candidate-resumes', candidateResumesRoutes);
employabilityRoutes.use('/apply', publicApplyRoutes);
