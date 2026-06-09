import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { employees } from './core.js';

export const crmSchema = pgSchema('crm');

export const negotiationStates = crmSchema.table('negotiation_states', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const visitTypes = crmSchema.table('visit_types', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const businessClients = crmSchema.table(
  'business_clients',
  {
    id: uuid().primaryKey().defaultRandom(),
    advisorId: uuid('advisor_id').references(() => employees.userId, {
      onDelete: 'set null',
    }),
    ruc: varchar({ length: 13 }).notNull().unique(),
    businessName: varchar('business_name', { length: 200 }).notNull(),
    contactName: varchar('contact_name', { length: 200 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 20 }),
    contactEmail: varchar('contact_email', { length: 150 }),
    address: text(),
    activeServicesCount: integer('active_services_count').notNull().default(0),
    currentMonthlyBilling: decimal('current_monthly_billing', {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default('0'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_business_clients_advisor').on(t.advisorId),
    index('idx_business_clients_ruc').on(t.ruc).where(sql`deleted_at IS NULL`),
    index('idx_business_clients_active').on(t.isActive).where(sql`deleted_at IS NULL`),
    check('chk_services_count', sql`active_services_count >= 0`),
    check('chk_monthly_billing', sql`current_monthly_billing >= 0`),
  ]
);

export const negotiations = crmSchema.table(
  'negotiations',
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => businessClients.id, { onDelete: 'cascade' }),
    advisorId: uuid('advisor_id')
      .notNull()
      .references(() => employees.userId, { onDelete: 'restrict' }),
    stateId: uuid('state_id')
      .notNull()
      .references(() => negotiationStates.id, { onDelete: 'restrict' }),
    startDate: date('start_date').notNull().default(sql`CURRENT_DATE`),
    estimatedCloseDate: date('estimated_close_date'),
    observations: text(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_negotiations_client').on(t.clientId),
    index('idx_negotiations_advisor').on(t.advisorId),
    index('idx_negotiations_state').on(t.stateId).where(sql`deleted_at IS NULL`),
    index('idx_negotiations_active').on(t.isActive).where(sql`deleted_at IS NULL`),
    index('idx_negotiations_dates').on(t.startDate, t.estimatedCloseDate),
    check(
      'chk_negotiation_dates',
      sql`estimated_close_date IS NULL OR estimated_close_date >= start_date`
    ),
  ]
);

export const negotiationStateHistory = crmSchema.table(
  'negotiation_state_history',
  {
    id: uuid().primaryKey().defaultRandom(),
    negotiationId: uuid('negotiation_id')
      .notNull()
      .references(() => negotiations.id, { onDelete: 'cascade' }),
    previousStateId: uuid('previous_state_id').references(() => negotiationStates.id, {
      onDelete: 'restrict',
    }),
    newStateId: uuid('new_state_id')
      .notNull()
      .references(() => negotiationStates.id, { onDelete: 'restrict' }),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_neg_state_history_negotiation').on(t.negotiationId),
    index('idx_neg_state_history_prev_state').on(t.previousStateId),
    index('idx_neg_state_history_new_state').on(t.newStateId),
    index('idx_neg_state_history_created').on(t.createdAt),
    index('idx_neg_state_history_changed_by').on(t.changedBy),
  ]
);

export const visits = crmSchema.table(
  'visits',
  {
    id: uuid().primaryKey().defaultRandom(),
    negotiationId: uuid('negotiation_id').references(() => negotiations.id, {
      onDelete: 'set null',
    }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => businessClients.id, { onDelete: 'cascade' }),
    advisorId: uuid('advisor_id')
      .notNull()
      .references(() => employees.userId, { onDelete: 'restrict' }),
    verifiedBy: uuid('verified_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    visitTypeId: uuid('visit_type_id')
      .notNull()
      .references(() => visitTypes.id, { onDelete: 'restrict' }),
    visitDate: timestamp('visit_date', { withTimezone: true }).notNull(),
    observations: text(),
    isVerified: boolean('is_verified').notNull().default(false),
    supervisorComment: text('supervisor_comment'),
    gpsLatitude: decimal('gps_latitude', { precision: 10, scale: 7 }),
    gpsLongitude: decimal('gps_longitude', { precision: 10, scale: 7 }),
    gpsAccuracy: decimal('gps_accuracy', { precision: 8, scale: 2 }),
    gpsTimestamp: timestamp('gps_timestamp', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_visits_negotiation').on(t.negotiationId),
    index('idx_visits_client').on(t.clientId),
    index('idx_visits_advisor').on(t.advisorId),
    index('idx_visits_verified_by').on(t.verifiedBy),
    index('idx_visits_visit_type').on(t.visitTypeId),
    index('idx_visits_date').on(t.visitDate).where(sql`deleted_at IS NULL`),
    index('idx_visits_verified').on(t.isVerified).where(sql`deleted_at IS NULL`),
  ]
);
