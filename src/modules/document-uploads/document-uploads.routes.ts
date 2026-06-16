import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { uploadSingleDocument } from '@shared/middleware/upload.js';
import { Router } from 'express';
import * as controller from './document-uploads.controller.js';

export const documentUploadsRoutes = Router();

documentUploadsRoutes.post(
  '/',
  authenticate,
  authorize('negotiation_documents.create'),
  uploadSingleDocument,
  controller.uploadDocument
);
