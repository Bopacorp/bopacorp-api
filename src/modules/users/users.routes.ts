import {
  AssignUserRolesRequestSchema,
  CreateUserRequestSchema,
  ListUsersQuerySchema,
  UpdateUserRequestSchema,
} from '@bopacorp/shared/auth';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './users.controller.js';

export const usersRoutes = Router();

usersRoutes.get(
  '/',
  authorize('users.read'),
  validate({ query: ListUsersQuerySchema }),
  controller.list
);

usersRoutes.get(
  '/:id',
  authorize('users.read'),
  validate({ params: IdParamSchema }),
  controller.getById
);

usersRoutes.post(
  '/',
  authorize('users.create'),
  validate({ body: CreateUserRequestSchema }),
  controller.create
);

usersRoutes.patch(
  '/:id',
  authorize('users.update'),
  validate({ params: IdParamSchema, body: UpdateUserRequestSchema }),
  controller.update
);

usersRoutes.delete(
  '/:id',
  authorize('users.delete'),
  validate({ params: IdParamSchema }),
  controller.remove
);

usersRoutes.put(
  '/:id/roles',
  authorize('users.roles.update'),
  validate({ params: IdParamSchema, body: AssignUserRolesRequestSchema }),
  controller.assignRoles
);
