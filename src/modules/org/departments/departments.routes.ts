import {
  CreateDepartmentRequestSchema,
  ListDepartmentsQuerySchema,
  UpdateDepartmentRequestSchema,
} from '@bopacorp/shared/core';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './departments.controller.js';

export const departmentsRoutes = Router();

departmentsRoutes.get(
  '/',
  authorize('departments.read'),
  validate({ query: ListDepartmentsQuerySchema }),
  controller.listDepartments
);

departmentsRoutes.get(
  '/:id',
  authorize('departments.read'),
  validate({ params: IdParamSchema }),
  controller.getDepartmentById
);

departmentsRoutes.post(
  '/',
  authorize('departments.create'),
  validate({ body: CreateDepartmentRequestSchema }),
  controller.createDepartment
);

departmentsRoutes.patch(
  '/:id',
  authorize('departments.update'),
  validate({ params: IdParamSchema, body: UpdateDepartmentRequestSchema }),
  controller.updateDepartment
);

departmentsRoutes.patch(
  '/:id/disable',
  authorize('departments.delete'),
  validate({ params: IdParamSchema }),
  controller.disableDepartment
);
