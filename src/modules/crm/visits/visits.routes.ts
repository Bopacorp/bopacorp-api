import {
  CreateVisitRequestSchema,
  ListVisitsQuerySchema,
  UpdateVisitRequestSchema,
  VerifyVisitRequestSchema,
} from '@bopacorp/shared/crm';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './visits.controller.js';

export const visitsRoutes = Router();

visitsRoutes.get(
  '/',
  authenticate,
  authorize('visits.read'),
  validate({ query: ListVisitsQuerySchema }),
  controller.listVisits
);

visitsRoutes.get(
  '/:id',
  authenticate,
  authorize('visits.read'),
  validate({ params: IdParamSchema }),
  controller.getVisitById
);

visitsRoutes.post(
  '/',
  authenticate,
  authorize('visits.create'),
  validate({ body: CreateVisitRequestSchema }),
  controller.createVisit
);

visitsRoutes.patch(
  '/:id',
  authenticate,
  authorize('visits.update'),
  validate({ params: IdParamSchema, body: UpdateVisitRequestSchema }),
  controller.updateVisit
);

visitsRoutes.delete(
  '/:id',
  authenticate,
  authorize('visits.delete'),
  validate({ params: IdParamSchema }),
  controller.removeVisit
);

visitsRoutes.patch(
  '/:id/verify',
  authenticate,
  authorize('visits.verify'),
  validate({ params: IdParamSchema, body: VerifyVisitRequestSchema }),
  controller.verifyVisit
);
