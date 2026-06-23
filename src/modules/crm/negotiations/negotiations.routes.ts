import {
  ChangeNegotiationStateRequestSchema,
  CreateNegotiationRequestSchema,
  ListNegotiationsQuerySchema,
  UpdateNegotiationRequestSchema,
} from '@bopacorp/shared/crm';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './negotiations.controller.js';

export const negotiationsRoutes = Router();

negotiationsRoutes.get(
  '/',
  authenticate,
  authorize('negotiations.read'),
  validate({ query: ListNegotiationsQuerySchema }),
  controller.listNegotiations
);

negotiationsRoutes.get(
  '/:id',
  authenticate,
  authorize('negotiations.read'),
  validate({ params: IdParamSchema }),
  controller.getNegotiationById
);

negotiationsRoutes.post(
  '/',
  authenticate,
  authorize('negotiations.create'),
  validate({ body: CreateNegotiationRequestSchema }),
  controller.createNegotiation
);

negotiationsRoutes.patch(
  '/:id',
  authenticate,
  authorize('negotiations.update'),
  validate({ params: IdParamSchema, body: UpdateNegotiationRequestSchema }),
  controller.updateNegotiation
);

negotiationsRoutes.delete(
  '/:id',
  authenticate,
  authorize('negotiations.delete'),
  validate({ params: IdParamSchema }),
  controller.removeNegotiation
);

negotiationsRoutes.patch(
  '/:id/state',
  authenticate,
  authorize('negotiations.change_state'),
  validate({ params: IdParamSchema, body: ChangeNegotiationStateRequestSchema }),
  controller.changeNegotiationState
);

negotiationsRoutes.get(
  '/:id/history',
  authenticate,
  authorize('negotiations.read'),
  validate({ params: IdParamSchema }),
  controller.getNegotiationHistory
);
