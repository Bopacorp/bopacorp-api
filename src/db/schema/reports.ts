import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  decimal,
  index,
  integer,
  pgEnum,
  pgSchema,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const reportsSchema = pgSchema('reports');

export const reportTypeEnum = pgEnum('report_type', [
  'COMMERCIAL_PERFORMANCE',
  'OPERATIONAL',
  'ADVISOR_DASHBOARD',
]);

export const salesTargets = reportsSchema.table(
  'sales_targets',
  {
    id: uuid().primaryKey().defaultRandom(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    tierCode: varchar('tier_code', { length: 20 }).notNull().unique(),
    tierLabel: varchar('tier_label', { length: 50 }).notNull(),
    minBilling: decimal('min_billing', { precision: 15, scale: 2 }).notNull().default('0'),
    maxBilling: decimal('max_billing', { precision: 15, scale: 2 }),
    minCloses: integer('min_closes').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check('chk_min_billing', sql`min_billing >= 0`),
    check('chk_min_closes', sql`min_closes >= 0`),
    index('idx_sales_targets_tier_code').on(t.tierCode),
  ]
);

export const reportExports = reportsSchema.table(
  'report_exports',
  {
    id: uuid().primaryKey().defaultRandom(),
    generatedBy: uuid('generated_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reportType: reportTypeEnum('report_type').notNull(),
    title: varchar({ length: 255 }).notNull(),
    filename: varchar({ length: 255 }).notNull(),
    fileExtension: varchar('file_extension', { length: 10 }).notNull(),
    fileSizeMb: decimal('file_size_mb', { precision: 8, scale: 2 }).notNull(),
    storagePath: varchar('storage_path', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check('chk_report_size', sql`file_size_mb > 0 AND file_size_mb <= 50`),
    index('idx_report_exports_generated_by').on(t.generatedBy),
    index('idx_report_exports_type').on(t.reportType),
    index('idx_report_exports_generated_at').on(t.generatedAt),
  ]
);
