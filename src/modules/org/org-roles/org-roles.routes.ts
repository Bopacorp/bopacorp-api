import {
  CreateOrgRoleRequestSchema,
  ListOrgRolesQuerySchema,
  UpdateOrgRoleRequestSchema,
} from '@bopacorp/shared/core';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './org-roles.controller.js';

export const orgRolesRoutes = Router();

orgRolesRoutes.get(
  '/',
  authorize('org_roles.read'),
  validate({ query: ListOrgRolesQuerySchema }),
  controller.listOrgRoles
);

orgRolesRoutes.get(
  '/:id',
  authorize('org_roles.read'),
  validate({ params: IdParamSchema }),
  controller.getOrgRoleById
);

orgRolesRoutes.post(
  '/',
  authorize('org_roles.create'),
  validate({ body: CreateOrgRoleRequestSchema }),
  controller.createOrgRole
);

orgRolesRoutes.patch(
  '/:id',
  authorize('org_roles.update'),
  validate({ params: IdParamSchema, body: UpdateOrgRoleRequestSchema }),
  controller.updateOrgRole
);

orgRolesRoutes.patch(
  '/:id/disable',
  authorize('org_roles.delete'),
  validate({ params: IdParamSchema }),
  controller.disableOrgRole
);
