import type { EncryptionMetadata } from '@lib/encryption.js';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  decimal,
  index,
  jsonb,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { negotiations } from './crm.js';

export const documentsSchema = pgSchema('documents');

export const documentStateEnum = pgEnum('document_state', [
  'PENDING_APPROVAL',
  'ACCEPTED',
  'REJECTED',
]);

export const documentTypes = documentsSchema.table('document_types', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isMandatory: boolean('is_mandatory').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const negotiationDocuments = documentsSchema.table(
  'negotiation_documents',
  {
    id: uuid().primaryKey().defaultRandom(),
    negotiationId: uuid('negotiation_id')
      .notNull()
      .references(() => negotiations.id, { onDelete: 'cascade' }),
    documentTypeId: uuid('document_type_id')
      .notNull()
      .references(() => documentTypes.id, { onDelete: 'restrict' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    state: documentStateEnum().notNull().default('PENDING_APPROVAL'),
    filename: varchar({ length: 255 }).notNull(),
    fileExtension: varchar('file_extension', { length: 10 }).notNull(),
    fileSizeMb: decimal('file_size_mb', { precision: 8, scale: 2 }).notNull(),
    storagePath: varchar('storage_path', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    reviewDate: timestamp('review_date', { withTimezone: true }),
    coordinatorMessage: text('coordinator_message'),
    encryptionMetadata: jsonb('encryption_metadata').$type<EncryptionMetadata>(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_negotiation_docs_negotiation').on(t.negotiationId),
    index('idx_negotiation_docs_type').on(t.documentTypeId),
    index('idx_negotiation_docs_uploaded_by').on(t.uploadedBy),
    index('idx_negotiation_docs_reviewed_by').on(t.reviewedBy),
    index('idx_negotiation_docs_state').on(t.state).where(sql`deleted_at IS NULL`),
    check('chk_file_size_mb', sql`file_size_mb > 0 AND file_size_mb <= 50`),
  ]
);

export const documentStateHistory = documentsSchema.table(
  'document_state_history',
  {
    id: uuid().primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => negotiationDocuments.id, { onDelete: 'cascade' }),
    previousState: documentStateEnum(),
    newState: documentStateEnum().notNull(),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_doc_state_history_document').on(t.documentId),
    index('idx_doc_state_history_new').on(t.newState),
    index('idx_doc_state_history_changed').on(t.changedBy),
    index('idx_doc_state_history_created').on(t.createdAt),
  ]
);
