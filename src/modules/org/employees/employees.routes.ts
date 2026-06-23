import {
  CreateEmployeeRequestSchema,
  ListEmployeesQuerySchema,
  UpdateEmployeeRequestSchema,
  UserIdParamSchema,
} from '@bopacorp/shared/core';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { Router } from 'express';
import * as controller from './employees.controller.js';

export const employeesRoutes = Router();

employeesRoutes.get(
  '/',
  authorize('employees.read'),
  validate({ query: ListEmployeesQuerySchema }),
  controller.listEmployees
);

employeesRoutes.get(
  '/:userId',
  authorize('employees.read'),
  validate({ params: UserIdParamSchema }),
  controller.getEmployeeByUserId
);

employeesRoutes.post(
  '/',
  authorize('employees.create'),
  validate({ body: CreateEmployeeRequestSchema }),
  controller.createEmployee
);

employeesRoutes.patch(
  '/:userId',
  authorize('employees.update'),
  validate({ params: UserIdParamSchema, body: UpdateEmployeeRequestSchema }),
  controller.updateEmployee
);

employeesRoutes.delete(
  '/:userId',
  authorize('employees.delete'),
  validate({ params: UserIdParamSchema }),
  controller.removeEmployee
);
