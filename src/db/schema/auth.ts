import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('app_auth');

export const permissionTypeEnum = pgEnum('permission_type', [
  'crud',
  'action',
  'report',
  'view',
  'approval',
]);
export const tokenTypeEnum = pgEnum('token_type', ['refresh', 'password_reset', 'email_verify']);
export const loginStatusEnum = pgEnum('login_status', ['success', 'failed', 'locked']);
export const auditOperationEnum = pgEnum('audit_operation', ['I', 'U', 'D']);

export const modules = authSchema.table('modules', {
  id: uuid().primaryKey().defaultRandom(),
  parentId: uuid('parent_id').references((): AnyPgColumn => modules.id, { onDelete: 'set null' }),
  name: varchar({ length: 100 }).notNull(),
  code: varchar({ length: 50 }).notNull().unique(),
  description: varchar({ length: 255 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const permissions = authSchema.table(
  'permissions',
  {
    id: uuid().primaryKey().defaultRandom(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    code: varchar({ length: 150 }).notNull().unique(),
    name: varchar({ length: 100 }).notNull(),
    description: varchar({ length: 255 }),
    type: permissionTypeEnum().notNull().default('crud'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_permissions_module').on(t.moduleId), index('idx_permissions_type').on(t.type)]
);

export const roles = authSchema.table('roles', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 100 }).notNull().unique(),
  slug: varchar({ length: 100 }).notNull().unique(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const rolePermissions = authSchema.table(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    isGranted: boolean('is_granted').notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index('idx_role_permissions_permission').on(t.permissionId),
  ]
);

export const users = authSchema.table(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    username: varchar({ length: 50 }).notNull().unique(),
    email: varchar({ length: 150 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('idx_users_email').on(t.email).where(sql`deleted_at IS NULL`),
    uniqueIndex('idx_users_username').on(t.username).where(sql`deleted_at IS NULL`),
    index('idx_users_active').on(t.isActive).where(sql`deleted_at IS NULL`),
  ]
);

export const userRoles = authSchema.table(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index('idx_user_roles_role').on(t.roleId)]
);

export const authTokens = authSchema.table(
  'auth_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    token: varchar({ length: 500 }).notNull().unique(),
    type: tokenTypeEnum().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_auth_tokens_user_type').on(t.userId, t.type),
    index('idx_auth_tokens_expires').on(t.expiresAt),
  ]
);

export const loginLogs = authSchema.table(
  'login_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    status: loginStatusEnum().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_login_logs_user').on(t.userId),
    index('idx_login_logs_created').on(t.createdAt),
  ]
);

export const auditLogs = authSchema.table(
  'audit_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    tableName: varchar('table_name', { length: 100 }).notNull(),
    recordId: uuid('record_id').notNull(),
    operation: auditOperationEnum().notNull(),
    oldData: jsonb('old_data').$type<Record<string, unknown>>(),
    newData: jsonb('new_data').$type<Record<string, unknown>>(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_audit_logs_table').on(t.tableName),
    index('idx_audit_logs_record').on(t.recordId),
    index('idx_audit_logs_user').on(t.userId),
    index('idx_audit_logs_created').on(t.createdAt),
  ]
);
