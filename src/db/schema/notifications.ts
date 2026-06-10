import { sql } from 'drizzle-orm';
import { boolean, index, pgSchema, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const notificationsSchema = pgSchema('notifications');

export const notifications = notificationsSchema.table(
  'notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: varchar({ length: 200 }).notNull(),
    message: text().notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: uuid('reference_id'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_notifications_recipient').on(t.recipientId),
    index('idx_notifications_unread').on(t.recipientId, t.isRead).where(sql`is_read = FALSE`),
    index('idx_notifications_ref').on(t.referenceType, t.referenceId),
    index('idx_notifications_created').on(t.createdAt),
  ]
);
