import {
  CreateItemTypeRequestSchema,
  ListItemTypesQuerySchema,
  UpdateItemTypeRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './item-types.controller.js';

export const itemTypesRoutes = Router();

itemTypesRoutes.get(
  '/',
  authorize('item_types.read'),
  validate({ query: ListItemTypesQuerySchema }),
  controller.listItemTypes
);

itemTypesRoutes.get(
  '/:id',
  authorize('item_types.read'),
  validate({ params: IdParamSchema }),
  controller.getItemTypeById
);

itemTypesRoutes.post(
  '/',
  authorize('item_types.create'),
  validate({ body: CreateItemTypeRequestSchema }),
  controller.createItemType
);

itemTypesRoutes.patch(
  '/:id',
  authorize('item_types.update'),
  validate({ params: IdParamSchema, body: UpdateItemTypeRequestSchema }),
  controller.updateItemType
);

itemTypesRoutes.patch(
  '/:id/disable',
  authorize('item_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disableItemType
);
