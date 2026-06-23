import {
  CreateSegmentRequestSchema,
  ListSegmentsQuerySchema,
  UpdateSegmentRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './segments.controller.js';

export const segmentsRoutes = Router();

segmentsRoutes.get(
  '/',
  authorize('segments.read'),
  validate({ query: ListSegmentsQuerySchema }),
  controller.listSegments
);

segmentsRoutes.get(
  '/:id',
  authorize('segments.read'),
  validate({ params: IdParamSchema }),
  controller.getSegmentById
);

segmentsRoutes.post(
  '/',
  authorize('segments.create'),
  validate({ body: CreateSegmentRequestSchema }),
  controller.createSegment
);

segmentsRoutes.patch(
  '/:id',
  authorize('segments.update'),
  validate({ params: IdParamSchema, body: UpdateSegmentRequestSchema }),
  controller.updateSegment
);

segmentsRoutes.patch(
  '/:id/disable',
  authorize('segments.delete'),
  validate({ params: IdParamSchema }),
  controller.disableSegment
);
