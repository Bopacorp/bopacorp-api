import {
  CreateCandidateRequestSchema,
  ListCandidatesQuerySchema,
  UpdateCandidateRequestSchema,
} from '@bopacorp/shared/employability';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './candidates.controller.js';

export const candidatesRoutes = Router();

candidatesRoutes.get(
  '/',
  authenticate,
  authorize('candidates.read'),
  validate({ query: ListCandidatesQuerySchema }),
  controller.listCandidates
);

candidatesRoutes.get(
  '/:id',
  authenticate,
  authorize('candidates.read'),
  validate({ params: IdParamSchema }),
  controller.getCandidateById
);

candidatesRoutes.post(
  '/',
  authenticate,
  authorize('candidates.create'),
  validate({ body: CreateCandidateRequestSchema }),
  controller.createCandidate
);

candidatesRoutes.patch(
  '/:id',
  authenticate,
  authorize('candidates.update'),
  validate({ params: IdParamSchema, body: UpdateCandidateRequestSchema }),
  controller.updateCandidate
);

candidatesRoutes.delete(
  '/:id',
  authenticate,
  authorize('candidates.delete'),
  validate({ params: IdParamSchema }),
  controller.removeCandidate
);
