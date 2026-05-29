import {
  CreateContentBlockRequestSchema,
  CreateContentTypeRequestSchema,
  ListContentBlocksQuerySchema,
  UpdateContentBlockRequestSchema,
  UpdateContentTypeRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './catalog.controller.js';

export const catalogRoutes = Router();

catalogRoutes.get('/content-types', authorize('content_types.read'), controller.list);

catalogRoutes.get(
  '/content-types/:id',
  authorize('content_types.read'),
  validate({ params: IdParamSchema }),
  controller.getById
);

catalogRoutes.post(
  '/content-types',
  authorize('content_types.create'),
  validate({ body: CreateContentTypeRequestSchema }),
  controller.create
);

catalogRoutes.patch(
  '/content-types/:id',
  authorize('content_types.update'),
  validate({ params: IdParamSchema, body: UpdateContentTypeRequestSchema }),
  controller.update
);

catalogRoutes.patch(
  '/content-types/:id/disable',
  authorize('content_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disable
);

catalogRoutes.get(
  '/content-blocks',
  // authorize('content_blocks.read'),
  validate({ query: ListContentBlocksQuerySchema }),
  controller.listContentBlocks
);

catalogRoutes.get(
  '/content-blocks/:id',
  authorize('content_blocks.read'),
  validate({ params: IdParamSchema }),
  controller.getContentBlockById
);

catalogRoutes.post(
  '/content-blocks',
  authorize('content_blocks.create'),
  validate({ body: CreateContentBlockRequestSchema }),
  controller.createContentBlock
);

catalogRoutes.patch(
  '/content-blocks/:id',
  authorize('content_blocks.update'),
  validate({ params: IdParamSchema, body: UpdateContentBlockRequestSchema }),
  controller.updateContentBlock
);

catalogRoutes.delete(
  '/content-blocks/:id',
  authorize('content_blocks.delete'),
  validate({ params: IdParamSchema }),
  controller.deleteContentBlock
);
