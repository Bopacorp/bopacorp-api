import {
  CreateBenefitTypeRequestSchema,
  CreateCategoryRequestSchema,
  CreateContentBlockRequestSchema,
  CreateContentTypeRequestSchema,
  CreateContractTypeRequestSchema,
  CreateGeoZoneRequestSchema,
  CreateItemTypeRequestSchema,
  CreateSegmentRequestSchema,
  CreateTierRequestSchema,
  ListBenefitTypesQuerySchema,
  ListCategoriesQuerySchema,
  ListContentBlocksQuerySchema,
  ListContractTypesQuerySchema,
  ListGeoZonesQuerySchema,
  ListItemTypesQuerySchema,
  ListSegmentsQuerySchema,
  ListTiersQuerySchema,
  UpdateBenefitTypeRequestSchema,
  UpdateCategoryRequestSchema,
  UpdateContentBlockRequestSchema,
  UpdateContentTypeRequestSchema,
  UpdateContractTypeRequestSchema,
  UpdateGeoZoneRequestSchema,
  UpdateItemTypeRequestSchema,
  UpdateSegmentRequestSchema,
  UpdateTierRequestSchema,
} from '@bopacorp/shared/catalog';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { IdParamSchema } from '@shared/schemas/params.js';
import { Router } from 'express';
import * as controller from './catalog.controller.js';

export const catalogRoutes = Router();

catalogRoutes.get('/content-types', authorize('content_types.read'), controller.list);

catalogRoutes.get(
  '/content-types/:id',
  authorize('content_types.read'),
  validate({ params: IdParamSchema }),
  controller.getById
);

catalogRoutes.post(
  '/content-types',
  authorize('content_types.create'),
  validate({ body: CreateContentTypeRequestSchema }),
  controller.create
);

catalogRoutes.patch(
  '/content-types/:id',
  authorize('content_types.update'),
  validate({ params: IdParamSchema, body: UpdateContentTypeRequestSchema }),
  controller.update
);

catalogRoutes.patch(
  '/content-types/:id/disable',
  authorize('content_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disable
);

catalogRoutes.get(
  '/content-blocks',
  // authorize('content_blocks.read'),
  validate({ query: ListContentBlocksQuerySchema }),
  controller.listContentBlocks
);

catalogRoutes.get(
  '/content-blocks/:id',
  authorize('content_blocks.read'),
  validate({ params: IdParamSchema }),
  controller.getContentBlockById
);

catalogRoutes.post(
  '/content-blocks',
  authorize('content_blocks.create'),
  validate({ body: CreateContentBlockRequestSchema }),
  controller.createContentBlock
);

catalogRoutes.patch(
  '/content-blocks/:id',
  authorize('content_blocks.update'),
  validate({ params: IdParamSchema, body: UpdateContentBlockRequestSchema }),
  controller.updateContentBlock
);

catalogRoutes.delete(
  '/content-blocks/:id',
  authorize('content_blocks.delete'),
  validate({ params: IdParamSchema }),
  controller.deleteContentBlock
);

// ── Item types ──

catalogRoutes.get(
  '/item-types',
  authorize('item_types.read'),
  validate({ query: ListItemTypesQuerySchema }),
  controller.listItemTypes
);

catalogRoutes.get(
  '/item-types/:id',
  authorize('item_types.read'),
  validate({ params: IdParamSchema }),
  controller.getItemTypeById
);

catalogRoutes.post(
  '/item-types',
  authorize('item_types.create'),
  validate({ body: CreateItemTypeRequestSchema }),
  controller.createItemType
);

catalogRoutes.patch(
  '/item-types/:id',
  authorize('item_types.update'),
  validate({ params: IdParamSchema, body: UpdateItemTypeRequestSchema }),
  controller.updateItemType
);

catalogRoutes.patch(
  '/item-types/:id/disable',
  authorize('item_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disableItemType
);

// ── Contract types ──

catalogRoutes.get(
  '/contract-types',
  authorize('contract_types.read'),
  validate({ query: ListContractTypesQuerySchema }),
  controller.listContractTypes
);

catalogRoutes.get(
  '/contract-types/:id',
  authorize('contract_types.read'),
  validate({ params: IdParamSchema }),
  controller.getContractTypeById
);

catalogRoutes.post(
  '/contract-types',
  authorize('contract_types.create'),
  validate({ body: CreateContractTypeRequestSchema }),
  controller.createContractType
);

catalogRoutes.patch(
  '/contract-types/:id',
  authorize('contract_types.update'),
  validate({ params: IdParamSchema, body: UpdateContractTypeRequestSchema }),
  controller.updateContractType
);

catalogRoutes.patch(
  '/contract-types/:id/disable',
  authorize('contract_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disableContractType
);

// ── Segments ──

catalogRoutes.get(
  '/segments',
  authorize('segments.read'),
  validate({ query: ListSegmentsQuerySchema }),
  controller.listSegments
);

catalogRoutes.get(
  '/segments/:id',
  authorize('segments.read'),
  validate({ params: IdParamSchema }),
  controller.getSegmentById
);

catalogRoutes.post(
  '/segments',
  authorize('segments.create'),
  validate({ body: CreateSegmentRequestSchema }),
  controller.createSegment
);

catalogRoutes.patch(
  '/segments/:id',
  authorize('segments.update'),
  validate({ params: IdParamSchema, body: UpdateSegmentRequestSchema }),
  controller.updateSegment
);

catalogRoutes.patch(
  '/segments/:id/disable',
  authorize('segments.delete'),
  validate({ params: IdParamSchema }),
  controller.disableSegment
);

// ── Tiers ──

catalogRoutes.get(
  '/tiers',
  authorize('tiers.read'),
  validate({ query: ListTiersQuerySchema }),
  controller.listTiers
);

catalogRoutes.get(
  '/tiers/:id',
  authorize('tiers.read'),
  validate({ params: IdParamSchema }),
  controller.getTierById
);

catalogRoutes.post(
  '/tiers',
  authorize('tiers.create'),
  validate({ body: CreateTierRequestSchema }),
  controller.createTier
);

catalogRoutes.patch(
  '/tiers/:id',
  authorize('tiers.update'),
  validate({ params: IdParamSchema, body: UpdateTierRequestSchema }),
  controller.updateTier
);

catalogRoutes.patch(
  '/tiers/:id/disable',
  authorize('tiers.delete'),
  validate({ params: IdParamSchema }),
  controller.disableTier
);

// ── Geo zones ──

catalogRoutes.get(
  '/geo-zones',
  authorize('geo_zones.read'),
  validate({ query: ListGeoZonesQuerySchema }),
  controller.listGeoZones
);

catalogRoutes.get(
  '/geo-zones/:id',
  authorize('geo_zones.read'),
  validate({ params: IdParamSchema }),
  controller.getGeoZoneById
);

catalogRoutes.post(
  '/geo-zones',
  authorize('geo_zones.create'),
  validate({ body: CreateGeoZoneRequestSchema }),
  controller.createGeoZone
);

catalogRoutes.patch(
  '/geo-zones/:id',
  authorize('geo_zones.update'),
  validate({ params: IdParamSchema, body: UpdateGeoZoneRequestSchema }),
  controller.updateGeoZone
);

catalogRoutes.patch(
  '/geo-zones/:id/disable',
  authorize('geo_zones.delete'),
  validate({ params: IdParamSchema }),
  controller.disableGeoZone
);

// ── Benefit types ──

catalogRoutes.get(
  '/benefit-types',
  authorize('benefit_types.read'),
  validate({ query: ListBenefitTypesQuerySchema }),
  controller.listBenefitTypes
);

catalogRoutes.get(
  '/benefit-types/:id',
  authorize('benefit_types.read'),
  validate({ params: IdParamSchema }),
  controller.getBenefitTypeById
);

catalogRoutes.post(
  '/benefit-types',
  authorize('benefit_types.create'),
  validate({ body: CreateBenefitTypeRequestSchema }),
  controller.createBenefitType
);

catalogRoutes.patch(
  '/benefit-types/:id',
  authorize('benefit_types.update'),
  validate({ params: IdParamSchema, body: UpdateBenefitTypeRequestSchema }),
  controller.updateBenefitType
);

catalogRoutes.patch(
  '/benefit-types/:id/disable',
  authorize('benefit_types.delete'),
  validate({ params: IdParamSchema }),
  controller.disableBenefitType
);

// ── Categories ──

catalogRoutes.get(
  '/categories',
  authorize('categories.read'),
  validate({ query: ListCategoriesQuerySchema }),
  controller.listCategories
);

catalogRoutes.get('/categories/tree', authorize('categories.read'), controller.getCategoryTree);

catalogRoutes.get(
  '/categories/:id',
  authorize('categories.read'),
  validate({ params: IdParamSchema }),
  controller.getCategoryById
);

catalogRoutes.post(
  '/categories',
  authorize('categories.create'),
  validate({ body: CreateCategoryRequestSchema }),
  controller.createCategory
);

catalogRoutes.patch(
  '/categories/:id',
  authorize('categories.update'),
  validate({ params: IdParamSchema, body: UpdateCategoryRequestSchema }),
  controller.updateCategory
);

catalogRoutes.patch(
  '/categories/:id/disable',
  authorize('categories.delete'),
  validate({ params: IdParamSchema }),
  controller.disableCategory
);
