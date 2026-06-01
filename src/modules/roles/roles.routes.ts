import {
  AssignRolePermissionsRequestSchema,
  CreateModuleRequestSchema,
  CreatePermissionRequestSchema,
  CreateRoleRequestSchema,
  ListModulesQuerySchema,
  ListPermissionsQuerySchema,
  ListRolesQuerySchema,
  UpdateModuleRequestSchema,
  UpdatePermissionRequestSchema,
  UpdateRoleRequestSchema,
} from '@bopacorp/shared/auth';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './roles.controller.js';

export const rolesRoutes = Router();

// ── Roles ──

rolesRoutes.get(
  '/',
  authorize('roles.read'),
  validate({ query: ListRolesQuerySchema }),
  controller.listRoles
);

rolesRoutes.get(
  '/:id',
  authorize('roles.read'),
  validate({ params: IdParamSchema }),
  controller.getRoleById
);

rolesRoutes.post(
  '/',
  authorize('roles.create'),
  validate({ body: CreateRoleRequestSchema }),
  controller.createRole
);

rolesRoutes.patch(
  '/:id',
  authorize('roles.update'),
  validate({ params: IdParamSchema, body: UpdateRoleRequestSchema }),
  controller.updateRole
);

rolesRoutes.patch(
  '/:id/disable',
  authorize('roles.delete'),
  validate({ params: IdParamSchema }),
  controller.disableRole
);

rolesRoutes.put(
  '/:id/permissions',
  authorize('roles.permissions.update'),
  validate({ params: IdParamSchema, body: AssignRolePermissionsRequestSchema }),
  controller.assignPermissions
);

// ── Modules ──

rolesRoutes.get(
  '/modules',
  authorize('modules.read'),
  validate({ query: ListModulesQuerySchema }),
  controller.listModules
);

rolesRoutes.get('/modules/tree', authorize('modules.read'), controller.getModuleTree);

rolesRoutes.get(
  '/modules/:id',
  authorize('modules.read'),
  validate({ params: IdParamSchema }),
  controller.getModuleById
);

rolesRoutes.post(
  '/modules',
  authorize('modules.create'),
  validate({ body: CreateModuleRequestSchema }),
  controller.createModule
);

rolesRoutes.patch(
  '/modules/:id',
  authorize('modules.update'),
  validate({ params: IdParamSchema, body: UpdateModuleRequestSchema }),
  controller.updateModule
);

rolesRoutes.patch(
  '/modules/:id/disable',
  authorize('modules.delete'),
  validate({ params: IdParamSchema }),
  controller.disableModule
);

// ── Permissions ──

rolesRoutes.get(
  '/permissions',
  authorize('permissions.read'),
  validate({ query: ListPermissionsQuerySchema }),
  controller.listPermissions
);

rolesRoutes.get(
  '/permissions/:id',
  authorize('permissions.read'),
  validate({ params: IdParamSchema }),
  controller.getPermissionById
);

rolesRoutes.post(
  '/permissions',
  authorize('permissions.create'),
  validate({ body: CreatePermissionRequestSchema }),
  controller.createPermission
);

rolesRoutes.patch(
  '/permissions/:id',
  authorize('permissions.update'),
  validate({ params: IdParamSchema, body: UpdatePermissionRequestSchema }),
  controller.updatePermission
);

rolesRoutes.patch(
  '/permissions/:id/disable',
  authorize('permissions.delete'),
  validate({ params: IdParamSchema }),
  controller.disablePermission
);
