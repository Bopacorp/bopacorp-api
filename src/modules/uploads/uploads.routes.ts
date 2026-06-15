import { authorize } from '@shared/middleware/authorize.js';
import { handleImageUpload } from '@shared/middleware/upload-image.js';
import { Router } from 'express';
import * as controller from './uploads.controller.js';

export const uploadsRoutes = Router();

uploadsRoutes.post(
  '/images',
  authorize('content_blocks.update'),
  handleImageUpload,
  controller.uploadImage
);
