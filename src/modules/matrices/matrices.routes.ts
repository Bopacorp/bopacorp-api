import {
  ChangeMatrixStateRequestSchema,
  CreateMatrixAttachmentRequestSchema,
  CreateMatrixLineItemRequestSchema,
  CreateOfferMatrixRequestSchema,
  ListMatrixAttachmentsQuerySchema,
  ListMatrixLineItemsQuerySchema,
  ListMatrixStateHistoryQuerySchema,
  ListOfferMatricesQuerySchema,
  UpdateMatrixLineItemRequestSchema,
  UpdateOfferMatrixRequestSchema,
} from '@bopacorp/shared/matrices';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './matrices.controller.js';

export const matricesRoutes = Router();

// ── Offer Matrices ──

matricesRoutes.get(
  '/',
  authenticate,
  authorize('offer_matrices.read'),
  validate({ query: ListOfferMatricesQuerySchema }),
  controller.listOfferMatrices
);

matricesRoutes.get(
  '/:id',
  authenticate,
  authorize('offer_matrices.read'),
  validate({ params: IdParamSchema }),
  controller.getOfferMatrixById
);

matricesRoutes.post(
  '/',
  authenticate,
  authorize('offer_matrices.create'),
  validate({ body: CreateOfferMatrixRequestSchema }),
  controller.createOfferMatrix
);

matricesRoutes.patch(
  '/:id',
  authenticate,
  authorize('offer_matrices.update'),
  validate({ params: IdParamSchema, body: UpdateOfferMatrixRequestSchema }),
  controller.updateOfferMatrix
);

matricesRoutes.delete(
  '/:id',
  authenticate,
  authorize('offer_matrices.delete'),
  validate({ params: IdParamSchema }),
  controller.removeOfferMatrix
);

matricesRoutes.patch(
  '/:id/state',
  authenticate,
  authorize('offer_matrices.change_state'),
  validate({ params: IdParamSchema, body: ChangeMatrixStateRequestSchema }),
  controller.changeMatrixState
);

// ── Matrix Line Items ──

matricesRoutes.get(
  '/:id/line-items',
  authenticate,
  authorize('matrix_line_items.read'),
  validate({ params: IdParamSchema, query: ListMatrixLineItemsQuerySchema }),
  controller.listMatrixLineItems
);

matricesRoutes.post(
  '/:id/line-items',
  authenticate,
  authorize('matrix_line_items.create'),
  validate({ params: IdParamSchema, body: CreateMatrixLineItemRequestSchema }),
  controller.createMatrixLineItem
);

matricesRoutes.patch(
  '/:id/line-items/:lineItemId',
  authenticate,
  authorize('matrix_line_items.update'),
  validate({ params: IdParamSchema, body: UpdateMatrixLineItemRequestSchema }),
  controller.updateMatrixLineItem
);

matricesRoutes.delete(
  '/:id/line-items/:lineItemId',
  authenticate,
  authorize('matrix_line_items.delete'),
  validate({ params: IdParamSchema }),
  controller.removeMatrixLineItem
);

// ── Matrix Attachments ──

matricesRoutes.get(
  '/:id/attachments',
  authenticate,
  authorize('matrix_attachments.read'),
  validate({ params: IdParamSchema, query: ListMatrixAttachmentsQuerySchema }),
  controller.listMatrixAttachments
);

matricesRoutes.post(
  '/:id/attachments',
  authenticate,
  authorize('matrix_attachments.create'),
  validate({ params: IdParamSchema, body: CreateMatrixAttachmentRequestSchema }),
  controller.createMatrixAttachment
);

matricesRoutes.delete(
  '/:id/attachments/:attachmentId',
  authenticate,
  authorize('matrix_attachments.delete'),
  validate({ params: IdParamSchema }),
  controller.removeMatrixAttachment
);

// ── Matrix State History ──

matricesRoutes.get(
  '/:id/history',
  authenticate,
  authorize('offer_matrices.read'),
  validate({ params: IdParamSchema, query: ListMatrixStateHistoryQuerySchema }),
  controller.listMatrixStateHistory
);
