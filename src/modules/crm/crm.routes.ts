import { Router } from 'express';
import { businessClientsRoutes } from './business-clients/business-clients.routes.js';
import { negotiationStatesRoutes } from './negotiation-states/negotiation-states.routes.js';
import { negotiationsRoutes } from './negotiations/negotiations.routes.js';
import { visitTypesRoutes } from './visit-types/visit-types.routes.js';
import { visitsRoutes } from './visits/visits.routes.js';

export const crmRoutes = Router();

crmRoutes.use('/negotiation-states', negotiationStatesRoutes);
crmRoutes.use('/visit-types', visitTypesRoutes);
crmRoutes.use('/business-clients', businessClientsRoutes);
crmRoutes.use('/negotiations', negotiationsRoutes);
crmRoutes.use('/visits', visitsRoutes);
