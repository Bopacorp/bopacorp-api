import { Router } from 'express';
import { benefitTypesRoutes } from './benefit-types/benefit-types.routes.js';
import { categoriesRoutes } from './categories/categories.routes.js';
import { contentBlocksRoutes } from './content-blocks/content-blocks.routes.js';
import { contentTypesRoutes } from './content-types/content-types.routes.js';
import { contractTypesRoutes } from './contract-types/contract-types.routes.js';
import { geoZonesRoutes } from './geo-zones/geo-zones.routes.js';
import { itemTypesRoutes } from './item-types/item-types.routes.js';
import { segmentsRoutes } from './segments/segments.routes.js';
import { tiersRoutes } from './tiers/tiers.routes.js';

export const catalogRoutes = Router();

catalogRoutes.use('/content-types', contentTypesRoutes);
catalogRoutes.use('/content-blocks', contentBlocksRoutes);
catalogRoutes.use('/item-types', itemTypesRoutes);
catalogRoutes.use('/contract-types', contractTypesRoutes);
catalogRoutes.use('/segments', segmentsRoutes);
catalogRoutes.use('/tiers', tiersRoutes);
catalogRoutes.use('/geo-zones', geoZonesRoutes);
catalogRoutes.use('/benefit-types', benefitTypesRoutes);
catalogRoutes.use('/categories', categoriesRoutes);
