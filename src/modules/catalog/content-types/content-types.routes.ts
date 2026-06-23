import {
  CreateContentTypeRequestSchema,
  UpdateContentTypeRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './content-types.controller.js';

export const contentTypesRoutes = Router();

contentTypesRoutes.get('/', authorize('content_types.read'), controller.list);

contentTypesRoutes.get(
  '/:id',
  authorize('content_types.read'),
  validate({ params: IdParamSchema }),
  controller.getById
);

contentTypesRoutes.post(
  '/',
  authorize('content_types.create'),
  validate({ body: CreateContentTypeRequestSchema }),
  controller.create
);

contentTypesRoutes.patch(
  '/:id',
  authorize('content_types.update'),
  validate({ params: IdParamSchema, body: UpdateContentTypeRequestSchema }),
  controller.update
);

contentTypesRoutes.patch(
  '/:id/disable',
  authorize('content_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disable
);
