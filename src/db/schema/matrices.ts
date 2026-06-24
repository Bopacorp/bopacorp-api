import { sql } from 'drizzle-orm';
import {
  check,
  decimal,
  index,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { negotiations } from './crm.js';

export const matricesSchema = pgSchema('matrices');

export const offerMatrices = matricesSchema.table(
  'offer_matrices',
  {
    id: uuid().primaryKey().defaultRandom(),
    negotiationId: uuid('negotiation_id')
      .notNull()
      .references(() => negotiations.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    observations: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_offer_matrices_negotiation').on(t.negotiationId),
    index('idx_offer_matrices_creator').on(t.creatorId),
    index('idx_offer_matrices_created').on(t.createdAt).where(sql`deleted_at IS NULL`),
  ]
);

export const matrixAttachments = matricesSchema.table(
  'matrix_attachments',
  {
    id: uuid().primaryKey().defaultRandom(),
    matrixId: uuid('matrix_id')
      .notNull()
      .references(() => offerMatrices.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    attachmentType: varchar('attachment_type', { length: 20 }).notNull(),
    description: varchar({ length: 255 }),
    filename: varchar({ length: 255 }).notNull(),
    fileExtension: varchar('file_extension', { length: 10 }).notNull(),
    fileSizeMb: decimal('file_size_mb', { precision: 8, scale: 2 }).notNull(),
    storagePath: varchar('storage_path', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_matrix_attachments_matrix').on(t.matrixId),
    index('idx_matrix_attachments_uploaded_by').on(t.uploadedBy),
    check('chk_file_size_mb', sql`file_size_mb > 0 AND file_size_mb <= 50`),
  ]
);
