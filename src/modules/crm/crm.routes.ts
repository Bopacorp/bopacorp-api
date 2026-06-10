import {
  ChangeNegotiationStateRequestSchema,
  CreateBusinessClientRequestSchema,
  CreateNegotiationRequestSchema,
  CreateNegotiationStateRequestSchema,
  CreateVisitRequestSchema,
  CreateVisitTypeRequestSchema,
  ListBusinessClientsQuerySchema,
  ListNegotiationStatesQuerySchema,
  ListNegotiationsQuerySchema,
  ListVisitsQuerySchema,
  ListVisitTypesQuerySchema,
  UpdateBusinessClientRequestSchema,
  UpdateNegotiationRequestSchema,
  UpdateNegotiationStateRequestSchema,
  UpdateVisitRequestSchema,
  UpdateVisitTypeRequestSchema,
  VerifyVisitRequestSchema,
} from '@bopacorp/shared/crm';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './crm.controller.js';

export const crmRoutes = Router();

// ── Negotiation States ──

crmRoutes.get(
  '/negotiation-states',
  authenticate,
  authorize('negotiation_states.read'),
  validate({ query: ListNegotiationStatesQuerySchema }),
  controller.listNegotiationStates
);

crmRoutes.get(
  '/negotiation-states/:id',
  authenticate,
  authorize('negotiation_states.read'),
  validate({ params: IdParamSchema }),
  controller.getNegotiationStateById
);

crmRoutes.post(
  '/negotiation-states',
  authenticate,
  authorize('negotiation_states.create'),
  validate({ body: CreateNegotiationStateRequestSchema }),
  controller.createNegotiationState
);

crmRoutes.patch(
  '/negotiation-states/:id',
  authenticate,
  authorize('negotiation_states.update'),
  validate({ params: IdParamSchema, body: UpdateNegotiationStateRequestSchema }),
  controller.updateNegotiationState
);

crmRoutes.delete(
  '/negotiation-states/:id',
  authenticate,
  authorize('negotiation_states.delete'),
  validate({ params: IdParamSchema }),
  controller.removeNegotiationState
);

// ── Visit Types ──

crmRoutes.get(
  '/visit-types',
  authenticate,
  authorize('visit_types.read'),
  validate({ query: ListVisitTypesQuerySchema }),
  controller.listVisitTypes
);

crmRoutes.get(
  '/visit-types/:id',
  authenticate,
  authorize('visit_types.read'),
  validate({ params: IdParamSchema }),
  controller.getVisitTypeById
);

crmRoutes.post(
  '/visit-types',
  authenticate,
  authorize('visit_types.create'),
  validate({ body: CreateVisitTypeRequestSchema }),
  controller.createVisitType
);

crmRoutes.patch(
  '/visit-types/:id',
  authenticate,
  authorize('visit_types.update'),
  validate({ params: IdParamSchema, body: UpdateVisitTypeRequestSchema }),
  controller.updateVisitType
);

crmRoutes.delete(
  '/visit-types/:id',
  authenticate,
  authorize('visit_types.delete'),
  validate({ params: IdParamSchema }),
  controller.removeVisitType
);

// ── Business Clients ──

crmRoutes.get(
  '/business-clients',
  authenticate,
  authorize('business_clients.read'),
  validate({ query: ListBusinessClientsQuerySchema }),
  controller.listBusinessClients
);

crmRoutes.get(
  '/business-clients/:id',
  authenticate,
  authorize('business_clients.read'),
  validate({ params: IdParamSchema }),
  controller.getBusinessClientById
);

crmRoutes.post(
  '/business-clients',
  authenticate,
  authorize('business_clients.create'),
  validate({ body: CreateBusinessClientRequestSchema }),
  controller.createBusinessClient
);

crmRoutes.patch(
  '/business-clients/:id',
  authenticate,
  authorize('business_clients.update'),
  validate({ params: IdParamSchema, body: UpdateBusinessClientRequestSchema }),
  controller.updateBusinessClient
);

crmRoutes.delete(
  '/business-clients/:id',
  authenticate,
  authorize('business_clients.delete'),
  validate({ params: IdParamSchema }),
  controller.removeBusinessClient
);

// ── Negotiations ──

crmRoutes.get(
  '/negotiations',
  authenticate,
  authorize('negotiations.read'),
  validate({ query: ListNegotiationsQuerySchema }),
  controller.listNegotiations
);

crmRoutes.get(
  '/negotiations/:id',
  authenticate,
  authorize('negotiations.read'),
  validate({ params: IdParamSchema }),
  controller.getNegotiationById
);

crmRoutes.post(
  '/negotiations',
  authenticate,
  authorize('negotiations.create'),
  validate({ body: CreateNegotiationRequestSchema }),
  controller.createNegotiation
);

crmRoutes.patch(
  '/negotiations/:id',
  authenticate,
  authorize('negotiations.update'),
  validate({ params: IdParamSchema, body: UpdateNegotiationRequestSchema }),
  controller.updateNegotiation
);

crmRoutes.delete(
  '/negotiations/:id',
  authenticate,
  authorize('negotiations.delete'),
  validate({ params: IdParamSchema }),
  controller.removeNegotiation
);

crmRoutes.patch(
  '/negotiations/:id/state',
  authenticate,
  authorize('negotiations.change_state'),
  validate({ params: IdParamSchema, body: ChangeNegotiationStateRequestSchema }),
  controller.changeNegotiationState
);

crmRoutes.get(
  '/negotiations/:id/history',
  authenticate,
  authorize('negotiations.read'),
  validate({ params: IdParamSchema }),
  controller.getNegotiationHistory
);

// ── Visits ──

crmRoutes.get(
  '/visits',
  authenticate,
  authorize('visits.read'),
  validate({ query: ListVisitsQuerySchema }),
  controller.listVisits
);

crmRoutes.get(
  '/visits/:id',
  authenticate,
  authorize('visits.read'),
  validate({ params: IdParamSchema }),
  controller.getVisitById
);

crmRoutes.post(
  '/visits',
  authenticate,
  authorize('visits.create'),
  validate({ body: CreateVisitRequestSchema }),
  controller.createVisit
);

crmRoutes.patch(
  '/visits/:id',
  authenticate,
  authorize('visits.update'),
  validate({ params: IdParamSchema, body: UpdateVisitRequestSchema }),
  controller.updateVisit
);

crmRoutes.delete(
  '/visits/:id',
  authenticate,
  authorize('visits.delete'),
  validate({ params: IdParamSchema }),
  controller.removeVisit
);

crmRoutes.patch(
  '/visits/:id/verify',
  authenticate,
  authorize('visits.verify'),
  validate({ params: IdParamSchema, body: VerifyVisitRequestSchema }),
  controller.verifyVisit
);
