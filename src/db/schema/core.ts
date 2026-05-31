import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const coreSchema = pgSchema('core');

export const profiles = coreSchema.table(
  'profiles',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'restrict' }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    secondName: varchar('second_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    secondLastName: varchar('second_last_name', { length: 100 }),
    nationalId: varchar('national_id', { length: 20 }).notNull().unique(),
    phone: varchar({ length: 20 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    employeeCode: varchar('employee_code', { length: 20 }).unique(),
    address: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_profiles_user').on(t.userId),
    uniqueIndex('idx_profiles_national_id').on(t.nationalId).where(sql`deleted_at IS NULL`),
    index('idx_profiles_employee')
      .on(t.employeeCode)
      .where(sql`employee_code IS NOT NULL AND deleted_at IS NULL`),
  ]
);

export const advisorSupervisors = coreSchema.table(
  'advisor_supervisors',
  {
    advisorId: uuid('advisor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.advisorId, t.supervisorId] }),
    index('idx_advisor_supervisors_supervisor').on(t.supervisorId),
    check('chk_no_self_supervision', sql`advisor_id <> supervisor_id`),
  ]
);

export const orgRoles = coreSchema.table('org_roles', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 50 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  department: varchar({ length: 100 }),
  level: integer(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const employees = coreSchema.table(
  'employees',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgRoleId: uuid('org_role_id')
      .notNull()
      .references(() => orgRoles.id),
    territory: varchar({ length: 100 }),
    hiredAt: date('hired_at'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_employees_org_role').on(t.orgRoleId),
    index('idx_employees_active').on(t.isActive).where(sql`deleted_at IS NULL`),
  ]
);
