import {
  CreateReportExportRequestSchema,
  ListAdvisorMetricsQuerySchema,
  ListAdvisorPerformanceQuerySchema,
  ListRecentActivityQuerySchema,
  ListReportExportsQuerySchema,
  UpdateSalesTargetRequestSchema,
} from '@bopacorp/shared/reports';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './reports.controller.js';

export const reportsRoutes = Router();

// ── Sales Targets ──

reportsRoutes.get(
  '/targets',
  authenticate,
  authorize('sales_targets.read'),
  controller.listTargets
);

reportsRoutes.put(
  '/targets/:id',
  authenticate,
  authorize('sales_targets.update'),
  validate({ params: IdParamSchema, body: UpdateSalesTargetRequestSchema }),
  controller.updateTarget
);

// ── Advisor Performance ──

reportsRoutes.get(
  '/advisor-performance',
  authenticate,
  authorize('report_exports.read'),
  validate({ query: ListAdvisorPerformanceQuerySchema }),
  controller.getAdvisorPerformance
);

// ── Report Exports ──

reportsRoutes.get(
  '/exports',
  authenticate,
  authorize('report_exports.read'),
  validate({ query: ListReportExportsQuerySchema }),
  controller.listExports
);

reportsRoutes.get(
  '/exports/:id',
  authenticate,
  authorize('report_exports.read'),
  validate({ params: IdParamSchema }),
  controller.getExportById
);

reportsRoutes.post(
  '/exports',
  authenticate,
  authorize('report_exports.create'),
  validate({ body: CreateReportExportRequestSchema }),
  controller.createExport
);

// ── Advisor Metrics ──

reportsRoutes.get(
  '/advisor-metrics',
  authenticate,
  authorize('report_exports.read'),
  validate({ query: ListAdvisorMetricsQuerySchema }),
  controller.listAdvisorMetrics
);

// ── Recent Activity ──

reportsRoutes.get(
  '/recent-activity',
  authenticate,
  authorize('report_exports.read'),
  validate({ query: ListRecentActivityQuerySchema }),
  controller.listRecentActivity
);
