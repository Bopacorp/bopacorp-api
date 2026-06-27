import type {
  CreateReportExportRequest,
  ListAdvisorMetricsQuery,
  ListAdvisorPerformanceQuery,
  ListRecentActivityQuery,
  ListReportExportsQuery,
  UpdateSalesTargetRequest,
} from '@bopacorp/shared/reports';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './reports.service.js';

// ── Sales Targets ──

export async function listTargets(_req: Request, res: Response) {
  const result = await service.listTargets();
  res.json({ success: true, data: result.data });
}

export async function updateTarget(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateTarget(req.params.id, req.body as UpdateSalesTargetRequest);
  res.json({ success: true, data });
}

// ── Advisor Performance ──

const MANAGEMENT_ROLES = ['admin', 'manager', 'supervisor', 'coordinator'];

export async function getAdvisorPerformance(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const query = req.query as unknown as ListAdvisorPerformanceQuery;
  const isManagement = req.user.roles.some((role) => MANAGEMENT_ROLES.includes(role));

  if (!isManagement) {
    res.json({ success: true, data: [] });
    return;
  }

  const result = await service.getAdvisorPerformance(query);
  res.json({ success: true, data: result.data });
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

// ── Advisor Metrics ──

export async function listAdvisorMetrics(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const query = req.query as unknown as ListAdvisorMetricsQuery;
  const isManagement = req.user.roles.some((role) => MANAGEMENT_ROLES.includes(role));

  if (!isManagement) {
    query.advisorId = req.user.id;
  }

  const result = await service.listAdvisorMetrics(query);
  res.json({ success: true, data: result.data });
}

// ── Recent Activity ──

export async function listRecentActivity(req: Request, res: Response) {
  const query = req.query as unknown as ListRecentActivityQuery;
  const result = await service.listRecentActivity(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}
