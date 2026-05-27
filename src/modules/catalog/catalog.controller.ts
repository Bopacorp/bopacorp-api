import type {
  CreateBenefitTypeRequest,
  CreateCategoryRequest,
  CreateContentBlockRequest,
  CreateContractTypeRequest,
  CreateGeoZoneRequest,
  CreateItemTypeRequest,
  CreateSegmentRequest,
  CreateTierRequest,
  ListBenefitTypesQuery,
  ListCategoriesQuery,
  ListContentBlocksQuery,
  ListContractTypesQuery,
  ListGeoZonesQuery,
  ListItemTypesQuery,
  ListSegmentsQuery,
  ListTiersQuery,
  UpdateBenefitTypeRequest,
  UpdateCategoryRequest,
  UpdateContentBlockRequest,
  UpdateContractTypeRequest,
  UpdateGeoZoneRequest,
  UpdateItemTypeRequest,
  UpdateSegmentRequest,
  UpdateTierRequest,
} from '@bopacorp/shared/catalog';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import * as service from './catalog.service.js';

export async function list(_req: Request, res: Response) {
  const data = await service.listContentTypes();
  res.json({ success: true, data });
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getContentTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const data = await service.createContentType(req.body);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateContentType(req.params.id, req.body);
  res.json({ success: true, data });
}

export async function disable(req: Request<{ id: string }>, res: Response) {
  await service.disableContentType(req.params.id);
  res.json({ success: true, data: null });
}

export async function listContentBlocks(req: Request, res: Response) {
  const query = req.query as unknown as ListContentBlocksQuery;
  const result = await service.listContentBlocks(query);
  res.json({ success: true, data: result.data, meta: result.meta });
}

export async function getContentBlockById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getContentBlockById(req.params.id);
  res.json({ success: true, data });
}

export async function createContentBlock(req: Request, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.createContentBlock(req.body as CreateContentBlockRequest, req.user.id);
  res.status(201).json({ success: true, data });
}

export async function updateContentBlock(req: Request<{ id: string }>, res: Response) {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const data = await service.updateContentBlock(
    req.params.id,
    req.body as UpdateContentBlockRequest,
    req.user.id
  );
  res.json({ success: true, data });
}

export async function deleteContentBlock(req: Request<{ id: string }>, res: Response) {
  await service.deleteContentBlock(req.params.id);
  res.json({ success: true, data: null });
}

// ── Item types ──

export async function listItemTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListItemTypesQuery;
  const data = await service.listItemTypes(query);
  res.json({ success: true, data });
}

export async function getItemTypeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getItemTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function createItemType(req: Request, res: Response) {
  const data = await service.createItemType(req.body as CreateItemTypeRequest);
  res.status(201).json({ success: true, data });
}

export async function updateItemType(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateItemType(req.params.id, req.body as UpdateItemTypeRequest);
  res.json({ success: true, data });
}

export async function disableItemType(req: Request<{ id: string }>, res: Response) {
  await service.disableItemType(req.params.id);
  res.json({ success: true, data: null });
}

// ── Contract types ──

export async function listContractTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListContractTypesQuery;
  const data = await service.listContractTypes(query);
  res.json({ success: true, data });
}

export async function getContractTypeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getContractTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function createContractType(req: Request, res: Response) {
  const data = await service.createContractType(req.body as CreateContractTypeRequest);
  res.status(201).json({ success: true, data });
}

export async function updateContractType(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateContractType(
    req.params.id,
    req.body as UpdateContractTypeRequest
  );
  res.json({ success: true, data });
}

export async function disableContractType(req: Request<{ id: string }>, res: Response) {
  await service.disableContractType(req.params.id);
  res.json({ success: true, data: null });
}

// ── Segments ──

export async function listSegments(req: Request, res: Response) {
  const query = req.query as unknown as ListSegmentsQuery;
  const data = await service.listSegments(query);
  res.json({ success: true, data });
}

export async function getSegmentById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getSegmentById(req.params.id);
  res.json({ success: true, data });
}

export async function createSegment(req: Request, res: Response) {
  const data = await service.createSegment(req.body as CreateSegmentRequest);
  res.status(201).json({ success: true, data });
}

export async function updateSegment(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateSegment(req.params.id, req.body as UpdateSegmentRequest);
  res.json({ success: true, data });
}

export async function disableSegment(req: Request<{ id: string }>, res: Response) {
  await service.disableSegment(req.params.id);
  res.json({ success: true, data: null });
}

// ── Tiers ──

export async function listTiers(req: Request, res: Response) {
  const query = req.query as unknown as ListTiersQuery;
  const data = await service.listTiers(query);
  res.json({ success: true, data });
}

export async function getTierById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getTierById(req.params.id);
  res.json({ success: true, data });
}

export async function createTier(req: Request, res: Response) {
  const data = await service.createTier(req.body as CreateTierRequest);
  res.status(201).json({ success: true, data });
}

export async function updateTier(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateTier(req.params.id, req.body as UpdateTierRequest);
  res.json({ success: true, data });
}

export async function disableTier(req: Request<{ id: string }>, res: Response) {
  await service.disableTier(req.params.id);
  res.json({ success: true, data: null });
}

// ── Geo zones ──

export async function listGeoZones(req: Request, res: Response) {
  const query = req.query as unknown as ListGeoZonesQuery;
  const data = await service.listGeoZones(query);
  res.json({ success: true, data });
}

export async function getGeoZoneById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getGeoZoneById(req.params.id);
  res.json({ success: true, data });
}

export async function createGeoZone(req: Request, res: Response) {
  const data = await service.createGeoZone(req.body as CreateGeoZoneRequest);
  res.status(201).json({ success: true, data });
}

export async function updateGeoZone(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateGeoZone(req.params.id, req.body as UpdateGeoZoneRequest);
  res.json({ success: true, data });
}

export async function disableGeoZone(req: Request<{ id: string }>, res: Response) {
  await service.disableGeoZone(req.params.id);
  res.json({ success: true, data: null });
}

// ── Benefit types ──

export async function listBenefitTypes(req: Request, res: Response) {
  const query = req.query as unknown as ListBenefitTypesQuery;
  const data = await service.listBenefitTypes(query);
  res.json({ success: true, data });
}

export async function getBenefitTypeById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getBenefitTypeById(req.params.id);
  res.json({ success: true, data });
}

export async function createBenefitType(req: Request, res: Response) {
  const data = await service.createBenefitType(req.body as CreateBenefitTypeRequest);
  res.status(201).json({ success: true, data });
}

export async function updateBenefitType(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateBenefitType(req.params.id, req.body as UpdateBenefitTypeRequest);
  res.json({ success: true, data });
}

export async function disableBenefitType(req: Request<{ id: string }>, res: Response) {
  await service.disableBenefitType(req.params.id);
  res.json({ success: true, data: null });
}

// ── Categories ──

export async function listCategories(req: Request, res: Response) {
  const query = req.query as unknown as ListCategoriesQuery;
  const data = await service.listCategories(query);
  res.json({ success: true, data });
}

export async function getCategoryTree(_req: Request, res: Response) {
  const data = await service.getCategoryTree();
  res.json({ success: true, data });
}

export async function getCategoryById(req: Request<{ id: string }>, res: Response) {
  const data = await service.getCategoryById(req.params.id);
  res.json({ success: true, data });
}

export async function createCategory(req: Request, res: Response) {
  const data = await service.createCategory(req.body as CreateCategoryRequest);
  res.status(201).json({ success: true, data });
}

export async function updateCategory(req: Request<{ id: string }>, res: Response) {
  const data = await service.updateCategory(req.params.id, req.body as UpdateCategoryRequest);
  res.json({ success: true, data });
}

export async function disableCategory(req: Request<{ id: string }>, res: Response) {
  await service.disableCategory(req.params.id);
  res.json({ success: true, data: null });
}
