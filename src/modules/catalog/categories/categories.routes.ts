import {
  CreateCategoryRequestSchema,
  ListCategoriesQuerySchema,
  UpdateCategoryRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './categories.controller.js';

export const categoriesRoutes = Router();

categoriesRoutes.get(
  '/',
  authorize('categories.read'),
  validate({ query: ListCategoriesQuerySchema }),
  controller.listCategories
);

categoriesRoutes.get('/tree', authorize('categories.read'), controller.getCategoryTree);

categoriesRoutes.get(
  '/:id',
  authorize('categories.read'),
  validate({ params: IdParamSchema }),
  controller.getCategoryById
);

categoriesRoutes.post(
  '/',
  authorize('categories.create'),
  validate({ body: CreateCategoryRequestSchema }),
  controller.createCategory
);

categoriesRoutes.patch(
  '/:id',
  authorize('categories.update'),
  validate({ params: IdParamSchema, body: UpdateCategoryRequestSchema }),
  controller.updateCategory
);

categoriesRoutes.patch(
  '/:id/disable',
  authorize('categories.delete'),
  validate({ params: IdParamSchema }),
  controller.disableCategory
);
