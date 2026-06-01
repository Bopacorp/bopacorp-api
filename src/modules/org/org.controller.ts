import type {
  AssignAdvisorSupervisorsRequest,
  CreateDepartmentRequest,
  CreateEmployeeRequest,
  CreateOrgRoleRequest,
  ListAdvisorSupervisorsQuery,
  ListDepartmentsQuery,
  ListEmployeesQuery,
  ListOrgRolesQuery,
  UpdateDepartmentRequest,
  UpdateEmployeeRequest,
  UpdateOrgRoleRequest,
} from '@bopacorp/shared/core';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './org.service.js';

function getClientInfo(req: Request) {
  const info: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) info.ipAddress = req.ip;
  if (req.headers['user-agent']) info.userAgent = req.headers['user-agent'];
  return info;
}

// ── Departments ──

export async function listDepartments(req: Request, res: Response) {
  const query = req.query as unknown as ListDepartmentsQuery;
  const data = await service.listDepartments(query);
  res.json({ success: true, data });
}

export async function getDepartmentById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getDepartmentById(req.params.id);
  res.json({ success: true, data });
}

export async function createDepartment(req: Request, res: Response) {
  const data = await service.createDepartment(req.body as CreateDepartmentRequest);
  res.status(201).json({ success: true, data });
}

export async function updateDepartment(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateDepartment(req.params.id, req.body as UpdateDepartmentRequest);
  res.json({ success: true, data });
}

export async function disableDepartment(req: Request<{ id: string }>, res: Response) {
  await service.disableDepartment(req.params.id);
  res.json({ success: true, data: null });
}

// ── Org Roles ──

export async function listOrgRoles(req: Request, res: Response) {
  const query = req.query as unknown as ListOrgRolesQuery;
  const data = await service.listOrgRoles(query);
  res.json({ success: true, data });
}

export async function getOrgRoleById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getOrgRoleById(req.params.id);
  res.json({ success: true, data });
}

export async function createOrgRole(req: Request, res: Response) {
  const data = await service.createOrgRole(req.body as CreateOrgRoleRequest);
  res.status(201).json({ success: true, data });
}

export async function updateOrgRole(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateOrgRole(req.params.id, req.body as UpdateOrgRoleRequest);
  res.json({ success: true, data });
}

export async function disableOrgRole(req: Request<{ id: string }>, res: Response) {
  await service.disableOrgRole(req.params.id);
  res.json({ success: true, data: null });
}

// ── Employees ──

export async function listEmployees(req: Request, res: Response) {
  const query = req.query as unknown as ListEmployeesQuery;
  const result = await service.listEmployees(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getEmployeeByUserId(req: Request<{ userId: string }>, res: Response) {
  const data = await service.getEmployeeByUserId(req.params.userId);
  res.json({ success: true, data });
}

export async function createEmployee(req: Request, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const data = await service.createEmployee(
    req.user.id,
    req.body as CreateEmployeeRequest,
    getClientInfo(req)
  );
  res.status(201).json({ success: true, data });
}

export async function updateEmployee(req: Request<{ userId: string }>, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const data = await service.updateEmployee(
    req.user.id,
    req.params.userId,
    req.body as UpdateEmployeeRequest,
    getClientInfo(req)
  );
  res.json({ success: true, data });
}

export async function removeEmployee(req: Request<{ userId: string }>, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  await service.deleteEmployee(req.user.id, req.params.userId, getClientInfo(req));
  res.json({ success: true, data: { message: 'Employee deleted successfully' } });
}

// ── Advisor-Supervisors ──

export async function listSupervisors(req: Request<{ userId: string }>, res: Response) {
  const query = req.query as unknown as ListAdvisorSupervisorsQuery;
  const result = await service.listSupervisors(req.params.userId, query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function listAdvisors(req: Request<{ userId: string }>, res: Response) {
  const query = req.query as unknown as ListAdvisorSupervisorsQuery;
  const result = await service.listAdvisors(req.params.userId, query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function assignSupervisors(req: Request<{ userId: string }>, res: Response) {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const data = await service.assignSupervisors(
    req.user.id,
    req.params.userId,
    req.body as AssignAdvisorSupervisorsRequest,
    getClientInfo(req)
  );
  res.json({ success: true, data: data.data, meta: data.meta });
}
