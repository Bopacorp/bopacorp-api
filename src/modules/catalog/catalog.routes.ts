import {
  CreateContentTypeRequestSchema,
  UpdateContentTypeRequestSchema,
} from '@bopacorp/shared/catalog';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './catalog.controller.js';

export const catalogRoutes = Router();

catalogRoutes.get('/content-types', controller.list);

catalogRoutes.get('/content-types/:id', validate({ params: IdParamSchema }), controller.getById);

catalogRoutes.post(
  '/content-types',
  validate({ body: CreateContentTypeRequestSchema }),
  controller.create
);

catalogRoutes.patch(
  '/content-types/:id',
  validate({ params: IdParamSchema, body: UpdateContentTypeRequestSchema }),
  controller.update
);

catalogRoutes.patch(
  '/content-types/:id/disable',
  validate({ params: IdParamSchema }),
  controller.disable
);
