import {
  CreateContractTypeRequestSchema,
  ListContractTypesQuerySchema,
  UpdateContractTypeRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './contract-types.controller.js';

export const contractTypesRoutes = Router();

contractTypesRoutes.get(
  '/',
  authorize('contract_types.read'),
  validate({ query: ListContractTypesQuerySchema }),
  controller.listContractTypes
);

contractTypesRoutes.get(
  '/:id',
  authorize('contract_types.read'),
  validate({ params: IdParamSchema }),
  controller.getContractTypeById
);

contractTypesRoutes.post(
  '/',
  authorize('contract_types.create'),
  validate({ body: CreateContractTypeRequestSchema }),
  controller.createContractType
);

contractTypesRoutes.patch(
  '/:id',
  authorize('contract_types.update'),
  validate({ params: IdParamSchema, body: UpdateContractTypeRequestSchema }),
  controller.updateContractType
);

contractTypesRoutes.patch(
  '/:id/disable',
  authorize('contract_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disableContractType
);
