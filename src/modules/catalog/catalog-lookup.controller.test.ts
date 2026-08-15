import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const benefitList = vi.fn();
const benefitGet = vi.fn();
const benefitCreate = vi.fn();
const benefitUpdate = vi.fn();
const benefitDisable = vi.fn();
vi.mock('./benefit-types/benefit-types.service.js', () => ({
  listBenefitTypes: benefitList,
  getBenefitTypeById: benefitGet,
  createBenefitType: benefitCreate,
  updateBenefitType: benefitUpdate,
  disableBenefitType: benefitDisable,
}));

const contentList = vi.fn();
const contentGet = vi.fn();
const contentCreate = vi.fn();
const contentUpdate = vi.fn();
const contentDisable = vi.fn();
vi.mock('./content-types/content-types.service.js', () => ({
  list: contentList,
  getContentTypeById: contentGet,
  createContentType: contentCreate,
  updateContentType: contentUpdate,
  disable: contentDisable,
  listContentTypes: contentList,
  disableContentType: contentDisable,
}));

const contractList = vi.fn();
const contractGet = vi.fn();
const contractCreate = vi.fn();
const contractUpdate = vi.fn();
const contractDisable = vi.fn();
vi.mock('./contract-types/contract-types.service.js', () => ({
  listContractTypes: contractList,
  getContractTypeById: contractGet,
  createContractType: contractCreate,
  updateContractType: contractUpdate,
  disableContractType: contractDisable,
}));

const geoList = vi.fn();
const geoGet = vi.fn();
const geoCreate = vi.fn();
const geoUpdate = vi.fn();
const geoDisable = vi.fn();
vi.mock('./geo-zones/geo-zones.service.js', () => ({
  listGeoZones: geoList,
  getGeoZoneById: geoGet,
  createGeoZone: geoCreate,
  updateGeoZone: geoUpdate,
  disableGeoZone: geoDisable,
}));

const itemList = vi.fn();
const itemGet = vi.fn();
const itemCreate = vi.fn();
const itemUpdate = vi.fn();
const itemDisable = vi.fn();
vi.mock('./item-types/item-types.service.js', () => ({
  listItemTypes: itemList,
  getItemTypeById: itemGet,
  createItemType: itemCreate,
  updateItemType: itemUpdate,
  disableItemType: itemDisable,
}));

const segmentList = vi.fn();
const segmentGet = vi.fn();
const segmentCreate = vi.fn();
const segmentUpdate = vi.fn();
const segmentDisable = vi.fn();
vi.mock('./segments/segments.service.js', () => ({
  listSegments: segmentList,
  getSegmentById: segmentGet,
  createSegment: segmentCreate,
  updateSegment: segmentUpdate,
  disableSegment: segmentDisable,
}));

const tierList = vi.fn();
const tierGet = vi.fn();
const tierCreate = vi.fn();
const tierUpdate = vi.fn();
const tierDisable = vi.fn();
vi.mock('./tiers/tiers.service.js', () => ({
  listTiers: tierList,
  getTierById: tierGet,
  createTier: tierCreate,
  updateTier: tierUpdate,
  disableTier: tierDisable,
}));

const benefitController = await import('./benefit-types/benefit-types.controller.js');
const contentController = await import('./content-types/content-types.controller.js');
const contractController = await import('./contract-types/contract-types.controller.js');
const geoController = await import('./geo-zones/geo-zones.controller.js');
const itemController = await import('./item-types/item-types.controller.js');
const segmentController = await import('./segments/segments.controller.js');
const tierController = await import('./tiers/tiers.controller.js');

type Action = (req: Request, res: Response) => Promise<unknown>;

type LookupController = {
  name: string;
  list: Action;
  get: Action;
  create: Action;
  update: Action;
  disable: Action;
  services: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
  };
};

const lookupControllers: LookupController[] = [
  {
    name: 'benefit types',
    list: benefitController.listBenefitTypes,
    get: benefitController.getBenefitTypeById,
    create: benefitController.createBenefitType,
    update: benefitController.updateBenefitType,
    disable: benefitController.disableBenefitType,
    services: {
      list: benefitList,
      get: benefitGet,
      create: benefitCreate,
      update: benefitUpdate,
      disable: benefitDisable,
    },
  },
  {
    name: 'content types',
    list: contentController.list,
    get: contentController.getById,
    create: contentController.create,
    update: contentController.update,
    disable: contentController.disable,
    services: {
      list: contentList,
      get: contentGet,
      create: contentCreate,
      update: contentUpdate,
      disable: contentDisable,
    },
  },
  {
    name: 'contract types',
    list: contractController.listContractTypes,
    get: contractController.getContractTypeById,
    create: contractController.createContractType,
    update: contractController.updateContractType,
    disable: contractController.disableContractType,
    services: {
      list: contractList,
      get: contractGet,
      create: contractCreate,
      update: contractUpdate,
      disable: contractDisable,
    },
  },
  {
    name: 'geo-zones',
    list: geoController.listGeoZones,
    get: geoController.getGeoZoneById,
    create: geoController.createGeoZone,
    update: geoController.updateGeoZone,
    disable: geoController.disableGeoZone,
    services: {
      list: geoList,
      get: geoGet,
      create: geoCreate,
      update: geoUpdate,
      disable: geoDisable,
    },
  },
  {
    name: 'item types',
    list: itemController.listItemTypes,
    get: itemController.getItemTypeById,
    create: itemController.createItemType,
    update: itemController.updateItemType,
    disable: itemController.disableItemType,
    services: {
      list: itemList,
      get: itemGet,
      create: itemCreate,
      update: itemUpdate,
      disable: itemDisable,
    },
  },
  {
    name: 'segments',
    list: segmentController.listSegments,
    get: segmentController.getSegmentById,
    create: segmentController.createSegment,
    update: segmentController.updateSegment,
    disable: segmentController.disableSegment,
    services: {
      list: segmentList,
      get: segmentGet,
      create: segmentCreate,
      update: segmentUpdate,
      disable: segmentDisable,
    },
  },
  {
    name: 'tiers',
    list: tierController.listTiers,
    get: tierController.getTierById,
    create: tierController.createTier,
    update: tierController.updateTier,
    disable: tierController.disableTier,
    services: {
      list: tierList,
      get: tierGet,
      create: tierCreate,
      update: tierUpdate,
      disable: tierDisable,
    },
  },
];

const ID = '11111111-1111-1111-1111-111111111111';

function request(overrides: Record<string, unknown> = {}) {
  return {
    body: { code: 'DATA' },
    params: { id: ID },
    query: { page: 1 },
    ...overrides,
  } as unknown as Request;
}

function response() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('catalog lookup controllers', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(
    lookupControllers
  )('$name forwards every operation and returns envelopes', async (item) => {
    const query = { search: 'data', isActive: true };
    const body = { code: 'DATA', name: 'Data' };
    const data = { id: ID, ...body };

    item.services.list.mockResolvedValue([data]);
    const listResponse = response();
    await item.list(request({ query }), listResponse);
    expect(item.services.list).toHaveBeenCalledWith(query);
    expect(listResponse.json).toHaveBeenCalledWith({ success: true, data: [data] });

    item.services.get.mockResolvedValue(data);
    const getResponse = response();
    await item.get(request(), getResponse);
    expect(item.services.get).toHaveBeenCalledWith(ID);
    expect(getResponse.json).toHaveBeenCalledWith({ success: true, data });

    item.services.create.mockResolvedValue(data);
    const createResponse = response();
    await item.create(request({ body }), createResponse);
    expect(item.services.create).toHaveBeenCalledWith(body);
    expect(createResponse.status).toHaveBeenCalledWith(201);
    expect(createResponse.json).toHaveBeenCalledWith({ success: true, data });

    item.services.update.mockResolvedValue(data);
    const updateResponse = response();
    await item.update(request({ body }), updateResponse);
    expect(item.services.update).toHaveBeenCalledWith(ID, body);
    expect(updateResponse.json).toHaveBeenCalledWith({ success: true, data });

    const disableResponse = response();
    await item.disable(request(), disableResponse);
    expect(item.services.disable).toHaveBeenCalledWith(ID);
    expect(disableResponse.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('propagates service failures without writing a response', async () => {
    const error = new Error('lookup failed');
    benefitList.mockRejectedValue(error);
    const res = response();

    await expect(lookupControllers[0]?.list(request(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
