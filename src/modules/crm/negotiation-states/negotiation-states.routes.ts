import {
  CreateNegotiationStateRequestSchema,
  ListNegotiationStatesQuerySchema,
  UpdateNegotiationStateRequestSchema,
} from '@bopacorp/shared/crm';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './negotiation-states.controller.js';

export const negotiationStatesRoutes = Router();

negotiationStatesRoutes.get(
  '/',
  authenticate,
  authorize('negotiation_states.read'),
  validate({ query: ListNegotiationStatesQuerySchema }),
  controller.listNegotiationStates
);

negotiationStatesRoutes.get(
  '/:id',
  authenticate,
  authorize('negotiation_states.read'),
  validate({ params: IdParamSchema }),
  controller.getNegotiationStateById
);

negotiationStatesRoutes.post(
  '/',
  authenticate,
  authorize('negotiation_states.create'),
  validate({ body: CreateNegotiationStateRequestSchema }),
  controller.createNegotiationState
);

negotiationStatesRoutes.patch(
  '/:id',
  authenticate,
  authorize('negotiation_states.update'),
  validate({ params: IdParamSchema, body: UpdateNegotiationStateRequestSchema }),
  controller.updateNegotiationState
);

negotiationStatesRoutes.delete(
  '/:id',
  authenticate,
  authorize('negotiation_states.delete'),
  validate({ params: IdParamSchema }),
  controller.removeNegotiationState
);
