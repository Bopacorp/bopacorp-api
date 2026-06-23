import {
  AssignAdvisorSupervisorsRequestSchema,
  ListAdvisorSupervisorsQuerySchema,
  UserIdParamSchema,
} from '@bopacorp/shared/core';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { Router } from 'express';
import * as controller from './advisor-supervisors.controller.js';

export const advisorSupervisorsRoutes = Router();

advisorSupervisorsRoutes.get(
  '/:userId/supervisors',
  authorize('employees.read'),
  validate({ params: UserIdParamSchema, query: ListAdvisorSupervisorsQuerySchema }),
  controller.listSupervisors
);

advisorSupervisorsRoutes.get(
  '/:userId/advisors',
  authorize('employees.read'),
  validate({ params: UserIdParamSchema, query: ListAdvisorSupervisorsQuerySchema }),
  controller.listAdvisors
);

advisorSupervisorsRoutes.put(
  '/:userId/supervisors',
  authorize('employees.supervisors.update'),
  validate({ params: UserIdParamSchema, body: AssignAdvisorSupervisorsRequestSchema }),
  controller.assignSupervisors
);
