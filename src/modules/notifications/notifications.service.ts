import type {
  CreateNotificationRequest,
  ListNotificationsQuery,
  UpdateNotificationRequest,
} from '@bopacorp/shared/notifications';
import { users } from '@db/schema/auth.js';
import { notifications } from '@db/schema/notifications.js';
import { db } from '@lib/db.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { formatDateTime } from '@shared/utils/format.js';
import { and, eq } from 'drizzle-orm';

export async function listNotifications(userId: string, query: ListNotificationsQuery) {
  const conditions = [eq(notifications.recipientId, userId)];

  if (query.isRead !== undefined) {
    conditions.push(eq(notifications.isRead, query.isRead));
  }

  const where = and(...conditions);

  const totalItems = await db.$count(notifications, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select()
    .from(notifications)
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(notifications.createdAt);

  const data = await Promise.all(
    rows.map(async (row) => {
      const recipient = await db.query.users.findFirst({
        where: eq(users.id, row.recipientId),
      });

      return {
        id: row.id,
        title: row.title,
        message: row.message.substring(0, 100),
        isRead: row.isRead,
        readAt: row.readAt ? formatDateTime(row.readAt) : null,
        createdAt: formatDateTime(row.createdAt),
        recipient: recipient
          ? { id: recipient.id, username: recipient.username }
          : { id: row.recipientId, username: '' },
      };
    })
  );

  return {
    data,
    meta: { page: query.page, limit: query.limit, totalItems, totalPages },
  };
}

export async function getUnreadCount(userId: string) {
  const count = await db.$count(
    notifications,
    and(eq(notifications.recipientId, userId), eq(notifications.isRead, false))
  );
  return count;
}

export async function getNotificationById(userId: string, id: string) {
  const row = await db.query.notifications.findFirst({
    where: eq(notifications.id, id),
    with: { recipient: true },
  });

  if (!row) {
    throw new NotFoundError('Notification', id);
  }

  if (row.recipientId !== userId) {
    throw new NotFoundError('Notification', id);
  }

  return {
    id: row.id,
    title: row.title,
    message: row.message,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    isRead: row.isRead,
    readAt: row.readAt ? formatDateTime(row.readAt) : null,
    createdAt: formatDateTime(row.createdAt),
    recipient: row.recipient
      ? {
          id: row.recipient.id,
          username: row.recipient.username,
          email: row.recipient.email,
          profile: null,
        }
      : null,
  };
}

export async function createNotification(data: CreateNotificationRequest) {
  const recipient = await db.query.users.findFirst({
    where: eq(users.id, data.recipientId),
  });

  if (!recipient) {
    throw new NotFoundError('User', data.recipientId);
  }

  const [row] = await db
    .insert(notifications)
    .values({
      recipientId: data.recipientId,
      title: data.title,
      message: data.message,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to create notification');
  }

  return getNotificationById(data.recipientId, row.id);
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));
}

export async function updateNotification(
  userId: string,
  id: string,
  data: UpdateNotificationRequest
) {
  await getNotificationById(userId, id);

  await db
    .update(notifications)
    .set({
      isRead: data.isRead,
      readAt: data.isRead ? new Date() : null,
    })
    .where(eq(notifications.id, id));

  return getNotificationById(userId, id);
}

export async function removeNotification(userId: string, id: string) {
  await getNotificationById(userId, id);
  await db.delete(notifications).where(eq(notifications.id, id));
}
