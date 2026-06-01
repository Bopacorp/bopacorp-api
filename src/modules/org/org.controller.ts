import type {
  CreateDepartmentRequest,
  CreateOrgRoleRequest,
  ListDepartmentsQuery,
  ListOrgRolesQuery,
  UpdateDepartmentRequest,
  UpdateOrgRoleRequest,
} from '@bopacorp/shared/core';
import type { Request, Response } from 'express';
import * as service from './org.service.js';

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
