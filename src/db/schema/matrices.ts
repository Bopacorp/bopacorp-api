import { sql } from 'drizzle-orm';
import {
  check,
  decimal,
  index,
  integer,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { catalogItems } from './catalog.js';
import { negotiations } from './crm.js';

export const matricesSchema = pgSchema('matrices');

export const matrixStateEnum = pgEnum('matrix_state', [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
]);

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
    approvedBy: uuid('approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    state: matrixStateEnum().notNull().default('DRAFT'),
    observations: text(),
    totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    calculatedSubsidy: decimal('calculated_subsidy', {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default('0'),
    subsidyStrategy: varchar('subsidy_strategy', { length: 50 }).notNull().default('STANDARD'),
    approvalDate: timestamp('approval_date', { withTimezone: true }),
    supervisorMessage: text('supervisor_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_offer_matrices_negotiation').on(t.negotiationId),
    index('idx_offer_matrices_creator').on(t.creatorId),
    index('idx_offer_matrices_approved_by').on(t.approvedBy),
    index('idx_offer_matrices_state').on(t.state).where(sql`deleted_at IS NULL`),
    index('idx_offer_matrices_created').on(t.createdAt).where(sql`deleted_at IS NULL`),
    check('chk_total_amount', sql`total_amount >= 0`),
    check('chk_calculated_subsidy', sql`calculated_subsidy >= 0`),
  ]
);

export const matrixLineItems = matricesSchema.table(
  'matrix_line_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    matrixId: uuid('matrix_id')
      .notNull()
      .references(() => offerMatrices.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => catalogItems.id, { onDelete: 'restrict' }),
    quantity: integer().notNull(),
    unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
    total: decimal('total', { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_matrix_line_items_matrix').on(t.matrixId),
    index('idx_matrix_line_items_item').on(t.itemId),
    uniqueIndex('uq_line_item_per_matrix').on(t.matrixId, t.itemId),
    check('chk_quantity', sql`quantity > 0`),
    check('chk_unit_price', sql`unit_price >= 0`),
    check('chk_total', sql`total >= 0`),
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

export const matrixStateHistory = matricesSchema.table(
  'matrix_state_history',
  {
    id: uuid().primaryKey().defaultRandom(),
    matrixId: uuid('matrix_id')
      .notNull()
      .references(() => offerMatrices.id, { onDelete: 'cascade' }),
    previousState: matrixStateEnum(),
    newState: matrixStateEnum().notNull(),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_matrix_state_history_matrix').on(t.matrixId),
    index('idx_matrix_state_history_new').on(t.newState),
    index('idx_matrix_state_history_changed').on(t.changedBy),
    index('idx_matrix_state_history_created').on(t.createdAt),
  ]
);
