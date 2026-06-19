import {
  CreateReportExportRequestSchema,
  CreateSalesObjectiveRequestSchema,
  ListAdvisorMetricsQuerySchema,
  ListReportExportsQuerySchema,
  ListSalesObjectivesQuerySchema,
  UpdateSalesObjectiveRequestSchema,
} from '@bopacorp/shared/reports';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './reports.controller.js';

export const reportsRoutes = Router();

// ── Sales Objectives ──

reportsRoutes.get(
  '/objectives',
  authenticate,
  authorize('sales_objectives.read'),
  validate({ query: ListSalesObjectivesQuerySchema }),
  controller.listObjectives
);

reportsRoutes.get(
  '/objectives/:id',
  authenticate,
  authorize('sales_objectives.read'),
  validate({ params: IdParamSchema }),
  controller.getObjectiveById
);

reportsRoutes.post(
  '/objectives',
  authenticate,
  authorize('sales_objectives.create'),
  validate({ body: CreateSalesObjectiveRequestSchema }),
  controller.createObjective
);

reportsRoutes.put(
  '/objectives/:id',
  authenticate,
  authorize('sales_objectives.update'),
  validate({ params: IdParamSchema, body: UpdateSalesObjectiveRequestSchema }),
  controller.updateObjective
);

reportsRoutes.delete(
  '/objectives/:id',
  authenticate,
  authorize('sales_objectives.delete'),
  validate({ params: IdParamSchema }),
  controller.removeObjective
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
  authorize('reports.read'),
  validate({ query: ListAdvisorMetricsQuerySchema }),
  controller.listAdvisorMetrics
);
