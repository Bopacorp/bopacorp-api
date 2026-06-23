import {
  CreateTierRequestSchema,
  ListTiersQuerySchema,
  UpdateTierRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './tiers.controller.js';

export const tiersRoutes = Router();

tiersRoutes.get(
  '/',
  authorize('tiers.read'),
  validate({ query: ListTiersQuerySchema }),
  controller.listTiers
);

tiersRoutes.get(
  '/:id',
  authorize('tiers.read'),
  validate({ params: IdParamSchema }),
  controller.getTierById
);

tiersRoutes.post(
  '/',
  authorize('tiers.create'),
  validate({ body: CreateTierRequestSchema }),
  controller.createTier
);

tiersRoutes.patch(
  '/:id',
  authorize('tiers.update'),
  validate({ params: IdParamSchema, body: UpdateTierRequestSchema }),
  controller.updateTier
);

tiersRoutes.patch(
  '/:id/disable',
  authorize('tiers.delete'),
  validate({ params: IdParamSchema }),
  controller.disableTier
);
