import type {
  CreateEmployeeRequest,
  ListEmployeesQuery,
  UpdateEmployeeRequest,
} from '@bopacorp/shared/core';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './employees.service.js';

function getClientInfo(req: Request) {
  const info: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) info.ipAddress = req.ip;
  if (req.headers['user-agent']) info.userAgent = req.headers['user-agent'];
  return info;
}

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
