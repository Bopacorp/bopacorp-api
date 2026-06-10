import {
  CreateNotificationRequestSchema,
  ListNotificationsQuerySchema,
  UpdateNotificationRequestSchema,
} from '@bopacorp/shared/notifications';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './notifications.controller.js';

export const notificationsRoutes = Router();

notificationsRoutes.get(
  '/',
  authenticate,
  authorize('notifications.read'),
  validate({ query: ListNotificationsQuerySchema }),
  controller.listNotifications
);

notificationsRoutes.get(
  '/unread-count',
  authenticate,
  authorize('notifications.read'),
  controller.getUnreadCount
);

notificationsRoutes.get(
  '/:id',
  authenticate,
  authorize('notifications.read'),
  validate({ params: IdParamSchema }),
  controller.getNotificationById
);

notificationsRoutes.post(
  '/',
  authenticate,
  authorize('notifications.create'),
  validate({ body: CreateNotificationRequestSchema }),
  controller.createNotification
);

notificationsRoutes.put(
  '/mark-all-read',
  authenticate,
  authorize('notifications.update'),
  controller.markAllRead
);

notificationsRoutes.put(
  '/:id',
  authenticate,
  authorize('notifications.update'),
  validate({ params: IdParamSchema, body: UpdateNotificationRequestSchema }),
  controller.updateNotification
);

notificationsRoutes.delete(
  '/:id',
  authenticate,
  authorize('notifications.delete'),
  validate({ params: IdParamSchema }),
  controller.removeNotification
);
