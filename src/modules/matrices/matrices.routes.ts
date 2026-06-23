import {
  CreateMatrixAttachmentRequestSchema,
  CreateOfferMatrixRequestSchema,
  ListMatrixAttachmentsQuerySchema,
  ListOfferMatricesQuerySchema,
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
