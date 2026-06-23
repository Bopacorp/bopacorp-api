import {
  CreateBenefitTypeRequestSchema,
  ListBenefitTypesQuerySchema,
  UpdateBenefitTypeRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './benefit-types.controller.js';

export const benefitTypesRoutes = Router();

benefitTypesRoutes.get(
  '/',
  authorize('benefit_types.read'),
  validate({ query: ListBenefitTypesQuerySchema }),
  controller.listBenefitTypes
);

benefitTypesRoutes.get(
  '/:id',
  authorize('benefit_types.read'),
  validate({ params: IdParamSchema }),
  controller.getBenefitTypeById
);

benefitTypesRoutes.post(
  '/',
  authorize('benefit_types.create'),
  validate({ body: CreateBenefitTypeRequestSchema }),
  controller.createBenefitType
);

benefitTypesRoutes.patch(
  '/:id',
  authorize('benefit_types.update'),
  validate({ params: IdParamSchema, body: UpdateBenefitTypeRequestSchema }),
  controller.updateBenefitType
);

benefitTypesRoutes.patch(
  '/:id/disable',
  authorize('benefit_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disableBenefitType
);
