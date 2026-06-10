import type {
  CreateReportExportRequest,
  CreateSalesObjectiveRequest,
  ListReportExportsQuery,
  ListSalesObjectivesQuery,
  UpdateSalesObjectiveRequest,
} from '@bopacorp/shared/reports';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './reports.service.js';

// ── Sales Objectives ──

export async function listObjectives(req: Request, res: Response) {
  const query = req.query as unknown as ListSalesObjectivesQuery;
  const result = await service.listObjectives(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getObjectiveById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getObjectiveById(req.params.id);
  res.json({ success: true, data });
}

export async function createObjective(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createObjective(req.user.id, req.body as CreateSalesObjectiveRequest);
  res.status(201).json({ success: true, data });
}

export async function updateObjective(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateObjective(
    req.params.id,
    req.body as UpdateSalesObjectiveRequest
  );
  res.json({ success: true, data });
}

export async function removeObjective(req: Request<{ id: string }>, res: Response) {
  await service.removeObjective(req.params.id);
  res.json({ success: true, data: null });
}

// ── Report Exports ──

export async function listExports(req: Request, res: Response) {
  const query = req.query as unknown as ListReportExportsQuery;
  const result = await service.listExports(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getExportById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getExportById(req.params.id);
  res.json({ success: true, data });
}

export async function createExport(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createExport(req.user.id, req.body as CreateReportExportRequest);
  res.status(201).json({ success: true, data });
}
