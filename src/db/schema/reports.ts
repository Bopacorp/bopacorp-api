import { sql } from 'drizzle-orm';
import {
  check,
  date,
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
import { employees } from './core.js';

export const reportsSchema = pgSchema('reports');

export const reportTypeEnum = pgEnum('report_type', [
  'COMMERCIAL_PERFORMANCE',
  'OPERATIONAL',
  'ADVISOR_DASHBOARD',
]);

export const salesObjectives = reportsSchema.table(
  'sales_objectives',
  {
    id: uuid().primaryKey().defaultRandom(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    advisorId: uuid('advisor_id').references(() => employees.userId, {
      onDelete: 'set null',
    }),
    targetSalesAmount: decimal('target_sales_amount', {
      precision: 15,
      scale: 2,
    }).notNull(),
    targetClosedDeals: integer('target_closed_deals').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    check('chk_objective_period', sql`period_end >= period_start`),
    index('idx_sales_objectives_created_by').on(t.createdBy),
    index('idx_sales_objectives_advisor').on(t.advisorId),
    index('idx_sales_objectives_period').on(t.periodStart, t.periodEnd),
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
