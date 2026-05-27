import {
  CreateCatalogItemRequestSchema,
  ListCatalogItemsQuerySchema,
  UpdateCatalogItemRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './catalog-items.controller.js';

export const catalogItemsRoutes = Router();

catalogItemsRoutes.get(
  '/',
  authorize('catalog_items.read'),
  validate({ query: ListCatalogItemsQuerySchema }),
  controller.list
);

catalogItemsRoutes.get(
  '/:id',
  authorize('catalog_items.read'),
  validate({ params: IdParamSchema }),
  controller.getById
);

catalogItemsRoutes.post(
  '/',
  authorize('catalog_items.create'),
  validate({ body: CreateCatalogItemRequestSchema }),
  controller.create
);

catalogItemsRoutes.patch(
  '/:id',
  authorize('catalog_items.update'),
  validate({ params: IdParamSchema, body: UpdateCatalogItemRequestSchema }),
  controller.update
);

catalogItemsRoutes.delete(
  '/:id',
  authorize('catalog_items.delete'),
  validate({ params: IdParamSchema }),
  controller.remove
);
