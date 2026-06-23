import {
  CreateBusinessClientRequestSchema,
  ListBusinessClientsQuerySchema,
  UpdateBusinessClientRequestSchema,
} from '@bopacorp/shared/crm';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './business-clients.controller.js';

export const businessClientsRoutes = Router();

businessClientsRoutes.get(
  '/',
  authenticate,
  authorize('business_clients.read'),
  validate({ query: ListBusinessClientsQuerySchema }),
  controller.listBusinessClients
);

businessClientsRoutes.get(
  '/:id',
  authenticate,
  authorize('business_clients.read'),
  validate({ params: IdParamSchema }),
  controller.getBusinessClientById
);

businessClientsRoutes.post(
  '/',
  authenticate,
  authorize('business_clients.create'),
  validate({ body: CreateBusinessClientRequestSchema }),
  controller.createBusinessClient
);

businessClientsRoutes.patch(
  '/:id',
  authenticate,
  authorize('business_clients.update'),
  validate({ params: IdParamSchema, body: UpdateBusinessClientRequestSchema }),
  controller.updateBusinessClient
);

businessClientsRoutes.delete(
  '/:id',
  authenticate,
  authorize('business_clients.delete'),
  validate({ params: IdParamSchema }),
  controller.removeBusinessClient
);
