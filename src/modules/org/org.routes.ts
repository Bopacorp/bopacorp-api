import {
  CreateDepartmentRequestSchema,
  CreateOrgRoleRequestSchema,
  ListDepartmentsQuerySchema,
  ListOrgRolesQuerySchema,
  UpdateDepartmentRequestSchema,
  UpdateOrgRoleRequestSchema,
} from '@bopacorp/shared/core';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './org.controller.js';

export const orgRoutes = Router();

// ── Departments ──

orgRoutes.get(
  '/departments',
  authorize('departments.read'),
  validate({ query: ListDepartmentsQuerySchema }),
  controller.listDepartments
);

orgRoutes.get(
  '/departments/:id',
  authorize('departments.read'),
  validate({ params: IdParamSchema }),
  controller.getDepartmentById
);

orgRoutes.post(
  '/departments',
  authorize('departments.create'),
  validate({ body: CreateDepartmentRequestSchema }),
  controller.createDepartment
);

orgRoutes.patch(
  '/departments/:id',
  authorize('departments.update'),
  validate({ params: IdParamSchema, body: UpdateDepartmentRequestSchema }),
  controller.updateDepartment
);

orgRoutes.patch(
  '/departments/:id/disable',
  authorize('departments.delete'),
  validate({ params: IdParamSchema }),
  controller.disableDepartment
);

// ── Org Roles ──

orgRoutes.get(
  '/org-roles',
  authorize('org_roles.read'),
  validate({ query: ListOrgRolesQuerySchema }),
  controller.listOrgRoles
);

orgRoutes.get(
  '/org-roles/:id',
  authorize('org_roles.read'),
  validate({ params: IdParamSchema }),
  controller.getOrgRoleById
);

orgRoutes.post(
  '/org-roles',
  authorize('org_roles.create'),
  validate({ body: CreateOrgRoleRequestSchema }),
  controller.createOrgRole
);

orgRoutes.patch(
  '/org-roles/:id',
  authorize('org_roles.update'),
  validate({ params: IdParamSchema, body: UpdateOrgRoleRequestSchema }),
  controller.updateOrgRole
);

orgRoutes.patch(
  '/org-roles/:id/disable',
  authorize('org_roles.delete'),
  validate({ params: IdParamSchema }),
  controller.disableOrgRole
);
