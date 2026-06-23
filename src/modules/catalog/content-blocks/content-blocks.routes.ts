import {
  CreateContentBlockRequestSchema,
  ListContentBlocksQuerySchema,
  UpdateContentBlockRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './content-blocks.controller.js';

export const contentBlocksRoutes = Router();

contentBlocksRoutes.get(
  '/',
  authorize('content_blocks.read'),
  validate({ query: ListContentBlocksQuerySchema }),
  controller.listContentBlocks
);

contentBlocksRoutes.get(
  '/:id',
  authorize('content_blocks.read'),
  validate({ params: IdParamSchema }),
  controller.getContentBlockById
);

contentBlocksRoutes.post(
  '/',
  authorize('content_blocks.create'),
  validate({ body: CreateContentBlockRequestSchema }),
  controller.createContentBlock
);

contentBlocksRoutes.patch(
  '/:id',
  authorize('content_blocks.update'),
  validate({ params: IdParamSchema, body: UpdateContentBlockRequestSchema }),
  controller.updateContentBlock
);

contentBlocksRoutes.delete(
  '/:id',
  authorize('content_blocks.delete'),
  validate({ params: IdParamSchema }),
  controller.deleteContentBlock
);
