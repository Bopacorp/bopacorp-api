import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

const benefitTypes = await import('./benefit-types/benefit-types.service.js');
const contentTypes = await import('./content-types/content-types.service.js');
const contractTypes = await import('./contract-types/contract-types.service.js');
const geoZones = await import('./geo-zones/geo-zones.service.js');
const itemTypes = await import('./item-types/item-types.service.js');
const segments = await import('./segments/segments.service.js');
const tiers = await import('./tiers/tiers.service.js');

type LookupQuery = {
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: string;
};

type LookupInput = {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
};

type LookupModule = {
  name: string;
  list(query: LookupQuery): Promise<unknown>;
  get(id: string): Promise<unknown>;
  create(input: LookupInput): Promise<unknown>;
  update(id: string, input: LookupInput): Promise<unknown>;
  disable(id: string): Promise<void>;
};

const lookupModules: LookupModule[] = [
  {
    name: 'benefit types',
    list: (query) => benefitTypes.listBenefitTypes(query as never),
    get: benefitTypes.getBenefitTypeById,
    create: (input) => benefitTypes.createBenefitType(input as never),
    update: (id, input) => benefitTypes.updateBenefitType(id, input as never),
    disable: benefitTypes.disableBenefitType,
  },
  {
    name: 'content types',
    list: (query) => contentTypes.listContentTypes(query as never),
    get: contentTypes.getContentTypeById,
    create: (input) => contentTypes.createContentType(input as never),
    update: (id, input) => contentTypes.updateContentType(id, input as never),
    disable: contentTypes.disableContentType,
  },
  {
    name: 'contract types',
    list: (query) => contractTypes.listContractTypes(query as never),
    get: contractTypes.getContractTypeById,
    create: (input) => contractTypes.createContractType(input as never),
    update: (id, input) => contractTypes.updateContractType(id, input as never),
    disable: contractTypes.disableContractType,
  },
  {
    name: 'geo-zones',
    list: (query) => geoZones.listGeoZones(query as never),
    get: geoZones.getGeoZoneById,
    create: (input) => geoZones.createGeoZone(input as never),
    update: (id, input) => geoZones.updateGeoZone(id, input as never),
    disable: geoZones.disableGeoZone,
  },
  {
    name: 'item types',
    list: (query) => itemTypes.listItemTypes(query as never),
    get: itemTypes.getItemTypeById,
    create: (input) => itemTypes.createItemType(input as never),
    update: (id, input) => itemTypes.updateItemType(id, input as never),
    disable: itemTypes.disableItemType,
  },
  {
    name: 'segments',
    list: (query) => segments.listSegments(query as never),
    get: segments.getSegmentById,
    create: (input) => segments.createSegment(input as never),
    update: (id, input) => segments.updateSegment(id, input as never),
    disable: segments.disableSegment,
  },
  {
    name: 'tiers',
    list: (query) => tiers.listTiers(query as never),
    get: tiers.getTierById,
    create: (input) => tiers.createTier(input as never),
    update: (id, input) => tiers.updateTier(id, input as never),
    disable: tiers.disableTier,
  },
];

const ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    code: 'VOICE',
    name: 'Voice',
    description: 'Voice products',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function orderedSelect(result: unknown) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

function terminalSelect(result: unknown) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  return builder;
}

function insertResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return values;
}

function updateResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return set;
}

describe('catalog lookup services', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each(lookupModules)('$name supports the complete lookup lifecycle', async (module) => {
    const query = { search: 'voice', isActive: true, sortBy: 'name', sortOrder: 'desc' };
    const current = row();
    const created = row({ id: OTHER_ID });
    const updated = row({ name: 'Updated voice' });

    mockSelect.mockReturnValueOnce(orderedSelect([current]));
    await expect(module.list(query)).resolves.toEqual([current]);

    mockSelect.mockReturnValueOnce(terminalSelect([current]));
    await expect(module.get(ID)).resolves.toEqual(current);

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(module.get(OTHER_ID)).rejects.toThrow(NotFoundError);

    mockSelect.mockReturnValueOnce(terminalSelect([current]));
    await expect(module.create({ code: 'VOICE', name: 'Voice' })).rejects.toThrow(ConflictError);

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    insertResult([created]);
    await expect(module.create({ code: 'DATA', name: 'Data' })).resolves.toEqual(created);

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    insertResult([]);
    await expect(module.create({ code: 'EMPTY', name: 'Empty' })).rejects.toThrow(
      InternalServerError
    );

    mockSelect.mockReturnValueOnce(terminalSelect([current]));
    mockSelect.mockReturnValueOnce(terminalSelect([current]));
    updateResult([updated]);
    await expect(module.update(ID, { code: 'VOICE', name: 'Updated voice' })).resolves.toEqual(
      updated
    );

    mockSelect.mockReturnValueOnce(terminalSelect([current]));
    updateResult([]);
    await expect(module.update(ID, { name: 'Missing update' })).rejects.toThrow(NotFoundError);

    mockSelect.mockReturnValueOnce(terminalSelect([current]));
    updateResult([]);
    await expect(module.disable(ID)).resolves.toBeUndefined();

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(module.disable(OTHER_ID)).rejects.toThrow(NotFoundError);
  });

  it.each(lookupModules)('$name rejects an update with another record code', async (module) => {
    mockSelect.mockReturnValueOnce(terminalSelect([row()]));
    mockSelect.mockReturnValueOnce(terminalSelect([row({ id: OTHER_ID, code: 'DATA' })]));

    await expect(module.update(ID, { code: 'DATA' })).rejects.toThrow(ConflictError);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
