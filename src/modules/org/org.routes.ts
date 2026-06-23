import { Router } from 'express';
import { advisorSupervisorsRoutes } from './advisor-supervisors/advisor-supervisors.routes.js';
import { departmentsRoutes } from './departments/departments.routes.js';
import { employeesRoutes } from './employees/employees.routes.js';
import { orgRolesRoutes } from './org-roles/org-roles.routes.js';

export const orgRoutes = Router();

orgRoutes.use('/departments', departmentsRoutes);
orgRoutes.use('/org-roles', orgRolesRoutes);
orgRoutes.use('/employees', employeesRoutes);
orgRoutes.use('/employees', advisorSupervisorsRoutes);
