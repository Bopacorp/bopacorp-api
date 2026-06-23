import type {
  CreateDepartmentRequest,
  ListDepartmentsQuery,
  UpdateDepartmentRequest,
} from '@bopacorp/shared/core';
import type { Request, Response } from 'express';
import * as service from './departments.service.js';

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
