import {
  CreateContactRequestSchema,
  ListContactRequestsQuerySchema,
} from '@bopacorp/shared/catalog';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './contact-requests.controller.js';

export const contactRequestsRoutes = Router();

contactRequestsRoutes.post('/', validate({ body: CreateContactRequestSchema }), controller.create);

contactRequestsRoutes.get(
  '/',
  authenticate,
  authorize('contact_requests.read'),
  validate({ query: ListContactRequestsQuerySchema }),
  controller.list
);

contactRequestsRoutes.get(
  '/:id',
  authenticate,
  authorize('contact_requests.read'),
  validate({ params: IdParamSchema }),
  controller.getById
);

contactRequestsRoutes.patch(
  '/:id',
  authenticate,
  authorize('contact_requests.update'),
  validate({ params: IdParamSchema }),
  controller.attend
);
