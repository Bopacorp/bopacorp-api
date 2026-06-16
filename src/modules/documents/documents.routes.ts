import {
  ChangeDocumentStateRequestSchema,
  CreateDocumentTypeRequestSchema,
  CreateNegotiationDocumentRequestSchema,
  ListDocumentStateHistoryQuerySchema,
  ListDocumentTypesQuerySchema,
  ListNegotiationDocumentsQuerySchema,
  UpdateDocumentTypeRequestSchema,
  UpdateNegotiationDocumentRequestSchema,
} from '@bopacorp/shared/documents';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './documents.controller.js';

export const documentsRoutes = Router();

// ── Document Types ──

documentsRoutes.get(
  '/types',
  authenticate,
  authorize('document_types.read'),
  validate({ query: ListDocumentTypesQuerySchema }),
  controller.listDocumentTypes
);

documentsRoutes.get(
  '/types/:id',
  authenticate,
  authorize('document_types.read'),
  validate({ params: IdParamSchema }),
  controller.getDocumentTypeById
);

documentsRoutes.post(
  '/types',
  authenticate,
  authorize('document_types.create'),
  validate({ body: CreateDocumentTypeRequestSchema }),
  controller.createDocumentType
);

documentsRoutes.patch(
  '/types/:id',
  authenticate,
  authorize('document_types.update'),
  validate({ params: IdParamSchema, body: UpdateDocumentTypeRequestSchema }),
  controller.updateDocumentType
);

documentsRoutes.delete(
  '/types/:id',
  authenticate,
  authorize('document_types.delete'),
  validate({ params: IdParamSchema }),
  controller.removeDocumentType
);

// ── Negotiation Documents ──

documentsRoutes.get(
  '/',
  authenticate,
  authorize('negotiation_documents.read'),
  validate({ query: ListNegotiationDocumentsQuerySchema }),
  controller.listDocuments
);

documentsRoutes.get(
  '/:id',
  authenticate,
  authorize('negotiation_documents.read'),
  validate({ params: IdParamSchema }),
  controller.getDocumentById
);

documentsRoutes.post(
  '/',
  authenticate,
  authorize('negotiation_documents.create'),
  validate({ body: CreateNegotiationDocumentRequestSchema }),
  controller.createDocument
);

documentsRoutes.patch(
  '/:id',
  authenticate,
  authorize('negotiation_documents.update'),
  validate({ params: IdParamSchema, body: UpdateNegotiationDocumentRequestSchema }),
  controller.updateDocument
);

documentsRoutes.delete(
  '/:id',
  authenticate,
  authorize('negotiation_documents.delete'),
  validate({ params: IdParamSchema }),
  controller.removeDocument
);

documentsRoutes.patch(
  '/:id/state',
  authenticate,
  authorize('negotiation_documents.change_state'),
  validate({ params: IdParamSchema, body: ChangeDocumentStateRequestSchema }),
  controller.changeDocumentState
);

// ── Document State History ──

documentsRoutes.get(
  '/:id/history',
  authenticate,
  authorize('negotiation_documents.read'),
  validate({ params: IdParamSchema, query: ListDocumentStateHistoryQuerySchema }),
  controller.listDocumentHistory
);

documentsRoutes.get(
  '/:id/download',
  authenticate,
  authorize('negotiation_documents.read'),
  validate({ params: IdParamSchema }),
  controller.downloadDocument
);
