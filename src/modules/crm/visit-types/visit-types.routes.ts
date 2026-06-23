import {
  CreateVisitTypeRequestSchema,
  ListVisitTypesQuerySchema,
  UpdateVisitTypeRequestSchema,
} from '@bopacorp/shared/crm';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './visit-types.controller.js';

export const visitTypesRoutes = Router();

visitTypesRoutes.get(
  '/',
  authenticate,
  authorize('visit_types.read'),
  validate({ query: ListVisitTypesQuerySchema }),
  controller.listVisitTypes
);

visitTypesRoutes.get(
  '/:id',
  authenticate,
  authorize('visit_types.read'),
  validate({ params: IdParamSchema }),
  controller.getVisitTypeById
);

visitTypesRoutes.post(
  '/',
  authenticate,
  authorize('visit_types.create'),
  validate({ body: CreateVisitTypeRequestSchema }),
  controller.createVisitType
);

visitTypesRoutes.patch(
  '/:id',
  authenticate,
  authorize('visit_types.update'),
  validate({ params: IdParamSchema, body: UpdateVisitTypeRequestSchema }),
  controller.updateVisitType
);

visitTypesRoutes.delete(
  '/:id',
  authenticate,
  authorize('visit_types.delete'),
  validate({ params: IdParamSchema }),
  controller.removeVisitType
);
