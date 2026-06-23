import {
  CreateGeoZoneRequestSchema,
  ListGeoZonesQuerySchema,
  UpdateGeoZoneRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './geo-zones.controller.js';

export const geoZonesRoutes = Router();

geoZonesRoutes.get(
  '/',
  authorize('geo_zones.read'),
  validate({ query: ListGeoZonesQuerySchema }),
  controller.listGeoZones
);

geoZonesRoutes.get(
  '/:id',
  authorize('geo_zones.read'),
  validate({ params: IdParamSchema }),
  controller.getGeoZoneById
);

geoZonesRoutes.post(
  '/',
  authorize('geo_zones.create'),
  validate({ body: CreateGeoZoneRequestSchema }),
  controller.createGeoZone
);

geoZonesRoutes.patch(
  '/:id',
  authorize('geo_zones.update'),
  validate({ params: IdParamSchema, body: UpdateGeoZoneRequestSchema }),
  controller.updateGeoZone
);

geoZonesRoutes.patch(
  '/:id/disable',
  authorize('geo_zones.delete'),
  validate({ params: IdParamSchema }),
  controller.disableGeoZone
);
