import type {
  CreateNotificationRequest,
  ListNotificationsQuery,
  UpdateNotificationRequest,
} from '@bopacorp/shared/notifications';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './notifications.service.js';

export async function listNotifications(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const query = req.query as unknown as ListNotificationsQuery;
  const result = await service.listNotifications(req.user.id, query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getUnreadCount(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const count = await service.getUnreadCount(req.user.id);
  res.json({ success: true, data: { count } });
}

export async function getNotificationById(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.getNotificationById(req.user.id, req.params.id);
  res.json({ success: true, data });
}

export async function createNotification(req: Request, res: Response) {
  const data = await service.createNotification(req.body as CreateNotificationRequest);
  res.status(201).json({ success: true, data });
}

export async function markAllRead(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  await service.markAllRead(req.user.id);
  res.json({ success: true, data: null });
}

export async function updateNotification(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.updateNotification(
    req.user.id,
    req.params.id,
    req.body as UpdateNotificationRequest
  );
  res.json({ success: true, data });
}

export async function removeNotification(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  await service.removeNotification(req.user.id, req.params.id);
  res.json({ success: true, data: null });
}
