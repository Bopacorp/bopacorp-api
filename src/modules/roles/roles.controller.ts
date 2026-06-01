import type {
  AssignRolePermissionsRequest,
  CreateModuleRequest,
  CreatePermissionRequest,
  CreateRoleRequest,
  ListModulesQuery,
  ListPermissionsQuery,
  ListRolesQuery,
  UpdateModuleRequest,
  UpdatePermissionRequest,
  UpdateRoleRequest,
} from '@bopacorp/shared/auth';
import type { Request, Response } from 'express';
import * as service from './roles.service.js';

// ── Roles ──

export async function listRoles(req: Request, res: Response) {
  const query = req.query as unknown as ListRolesQuery;
  const result = await service.listRoles(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getRoleById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getRoleDetail(req.params.id);
  res.json({ success: true, data });
}

export async function createRole(req: Request, res: Response) {
  const data = await service.createRole(req.body as CreateRoleRequest);
  res.status(201).json({ success: true, data });
}

export async function updateRole(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateRole(req.params.id, req.body as UpdateRoleRequest);
  res.json({ success: true, data });
}

export async function disableRole(req: Request<{ id: string }>, res: Response) {
  await service.disableRole(req.params.id);
  res.json({ success: true, data: null });
}

export async function assignPermissions(req: Request<{ id: string }>, res: Response) {
  const data = await service.assignRolePermissions(
    req.params.id,
    req.body as AssignRolePermissionsRequest
  );
  res.json({ success: true, data });
}

// ── Modules ──

export async function listModules(req: Request, res: Response) {
  const query = req.query as unknown as ListModulesQuery;
  const result = await service.listModules(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getModuleTree(_req: Request, res: Response) {
  const data = await service.getModuleTree();
  res.json({ success: true, data });
}

export async function getModuleById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getModuleById(req.params.id);
  res.json({ success: true, data });
}

export async function createModule(req: Request, res: Response) {
  const data = await service.createModule(req.body as CreateModuleRequest);
  res.status(201).json({ success: true, data });
}

export async function updateModule(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateModule(req.params.id, req.body as UpdateModuleRequest);
  res.json({ success: true, data });
}

export async function disableModule(req: Request<{ id: string }>, res: Response) {
  await service.disableModule(req.params.id);
  res.json({ success: true, data: null });
}

// ── Permissions ──

export async function listPermissions(req: Request, res: Response) {
  const query = req.query as unknown as ListPermissionsQuery;
  const result = await service.listPermissions(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getPermissionById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getPermissionById(req.params.id);
  res.json({ success: true, data });
}

export async function createPermission(req: Request, res: Response) {
  const data = await service.createPermission(req.body as CreatePermissionRequest);
  res.status(201).json({ success: true, data });
}

export async function updatePermission(req: Request<{ id: string }>, res: Response) {
  const data = await service.updatePermission(req.params.id, req.body as UpdatePermissionRequest);
  res.json({ success: true, data });
}

export async function disablePermission(req: Request<{ id: string }>, res: Response) {
  await service.disablePermission(req.params.id);
  res.json({ success: true, data: null });
}
