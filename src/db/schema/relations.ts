import { relations } from 'drizzle-orm';
import {
  auditLogs,
  authTokens,
  loginLogs,
  modules,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from './auth.js';

export const modulesRelations = relations(modules, ({ one, many }) => ({
  parent: one(modules, {
    fields: [modules.parentId],
    references: [modules.id],
    relationName: 'moduleParent',
  }),
  children: many(modules, { relationName: 'moduleParent' }),
  permissions: many(permissions),
}));

export const permissionsRelations = relations(permissions, ({ one, many }) => ({
  module: one(modules, {
    fields: [permissions.moduleId],
    references: [modules.id],
  }),
  rolePermissions: many(rolePermissions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  authTokens: many(authTokens),
  loginLogs: many(loginLogs),
  auditLogs: many(auditLogs),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const authTokensRelations = relations(authTokens, ({ one }) => ({
  user: one(users, {
    fields: [authTokens.userId],
    references: [users.id],
  }),
}));

export const loginLogsRelations = relations(loginLogs, ({ one }) => ({
  user: one(users, {
    fields: [loginLogs.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
