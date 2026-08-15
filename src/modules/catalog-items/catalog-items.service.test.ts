import { BadRequestError, ConflictError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockFindFirst = vi.fn();
const mockUploadFile = vi.fn();
const mockDeleteFile = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    transaction: mockTransaction,
    query: { catalogItems: { findFirst: mockFindFirst } },
  },
}));
vi.mock('@lib/storage.js', () => ({
  uploadFile: mockUploadFile,
  deleteFile: mockDeleteFile,
}));

const service = await import('./catalog-items.service.js');

const ITEM_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ITEM_ID = '22222222-2222-2222-2222-222222222222';
const CATEGORY_ID = '33333333-3333-3333-3333-333333333333';
const TYPE_ID = '44444444-4444-4444-4444-444444444444';
const CONTRACT_ID = '55555555-5555-5555-5555-555555555555';
const SEGMENT_ID = '66666666-6666-6666-6666-666666666666';
const TIER_ID = '77777777-7777-7777-7777-777777777777';
const GEO_ZONE_ID = '88888888-8888-8888-8888-888888888888';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function detailRows(includeDetails = true) {
  return {
    id: ITEM_ID,
    name: 'Premium plan',
    description: 'A complete plan',
    price: '19.99',
    activationCode: 'PREMIUM',
    imagePath: 'catalog/old.png',
    isActive: true,
    isPublished: true,
    permanenceMonths: 12,
    category: { id: CATEGORY_ID, name: 'Mobile', slug: 'mobile' },
    itemType: { id: TYPE_ID, code: 'VOICE', name: 'Voice' },
    contractType: { id: CONTRACT_ID, code: 'POST', name: 'Postpaid' },
    segment: { id: SEGMENT_ID, code: 'B2C', name: 'Consumer' },
    tier: { id: TIER_ID, code: 'PREMIUM', name: 'Premium' },
    voiceDetails: includeDetails
      ? {
          id: '90000000-0000-0000-0000-000000000001',
          gigasStructural: 10,
          gigasLoyalty: 5,
          minutesNational: 100,
          minutesLdi: 20,
          sms: 50,
          hasUnlimitedMinutes: true,
          hasUnlimitedWhatsapp: true,
          hasSocialNetworks: false,
          includedRoamingGb: '1.5',
        }
      : null,
    connectivityDetails: includeDetails
      ? {
          id: '90000000-0000-0000-0000-000000000002',
          bandwidthMbps: '200',
        }
      : null,
    digitalDetails: includeDetails
      ? { id: '90000000-0000-0000-0000-000000000003', provider: 'Streaming' }
      : null,
    roamingDetails: includeDetails
      ? {
          id: '90000000-0000-0000-0000-000000000004',
          geoZoneId: GEO_ZONE_ID,
          dataMb: 500,
          durationDays: 15,
          hasThrottle: true,
        }
      : null,
    deviceDetails: includeDetails
      ? {
          id: '90000000-0000-0000-0000-000000000005',
          brand: 'Bopa',
          model: 'Phone X',
          storageGb: 128,
          financingMonths: 12,
          financingMonthly: '29.50',
        }
      : null,
    benefits: includeDetails
      ? [
          {
            id: '90000000-0000-0000-0000-000000000006',
            benefitTypeId: TYPE_ID,
            name: 'Music',
            description: 'Music access',
            durationDays: 30,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          },
        ]
      : [],
    ageConditions: includeDetails ? { id: 'a', minAge: 18, maxAge: 65 } : null,
    legalConditions: includeDetails
      ? { id: 'b', legalRequirement: 'ID', description: 'Valid ID' }
      : null,
    temporalConditions: includeDetails
      ? {
          id: 'c',
          effectiveDate: '2026-01-01',
          expirationDate: '2026-12-31',
        }
      : null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
}

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    name: 'Premium plan',
    price: '19.99',
    imagePath: null,
    isActive: true,
    isPublished: true,
    category: { id: CATEGORY_ID, name: 'Mobile', slug: 'mobile' },
    itemType: { id: TYPE_ID, name: 'Voice' },
    contractType: { id: CONTRACT_ID, name: 'Postpaid' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function listBuilder(result: unknown) {
  const builder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

function terminalSelect(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  return builder;
}

function updateResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return set;
}

function transaction(txItem = detailRows(), insertedId: string | undefined = ITEM_ID) {
  const tx = {
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: ITEM_ID }]) }),
    })),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    update: vi
      .fn()
      .mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  };
  tx.insert.mockImplementationOnce(() => ({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(insertedId ? [{ id: txItem.id }] : []),
    }),
  }));
  mockTransaction.mockImplementationOnce(async (callback: (value: typeof tx) => Promise<unknown>) =>
    callback(tx)
  );
  return tx;
}

const fullInput = {
  categoryId: CATEGORY_ID,
  itemTypeId: TYPE_ID,
  contractTypeId: CONTRACT_ID,
  segmentId: SEGMENT_ID,
  tierId: TIER_ID,
  name: 'Premium plan',
  description: 'A complete plan',
  price: 19.99,
  activationCode: 'PREMIUM',
  isActive: true,
  isPublished: true,
  permanenceMonths: 12,
  voiceDetails: {
    gigasStructural: 10,
    gigasLoyalty: 5,
    minutesNational: 100,
    minutesLdi: 20,
    sms: 50,
    hasUnlimitedMinutes: true,
    hasUnlimitedWhatsapp: true,
    hasSocialNetworks: false,
    includedRoamingGb: 1.5,
  },
  connectivityDetails: { bandwidthMbps: 200 },
  digitalDetails: { provider: 'Streaming' },
  roamingDetails: { geoZoneId: GEO_ZONE_ID, dataMb: 500, durationDays: 15, hasThrottle: true },
  deviceDetails: {
    brand: 'Bopa',
    model: 'Phone X',
    storageGb: 128,
    financingMonths: 12,
    financingMonthly: 29.5,
  },
  benefits: [
    { benefitTypeId: TYPE_ID, name: 'Music', description: 'Music access', durationDays: 30 },
  ],
  ageConditions: { minAge: 18, maxAge: 65 },
  legalConditions: { legalRequirement: 'ID', description: 'Valid ID' },
  temporalConditions: { effectiveDate: '2026-01-01', expirationDate: '2026-12-31' },
};

const minimalInput = {
  categoryId: CATEGORY_ID,
  itemTypeId: TYPE_ID,
  contractTypeId: CONTRACT_ID,
  segmentId: SEGMENT_ID,
  tierId: TIER_ID,
  name: 'Basic plan',
  description: 'Basic plan',
  price: 5,
  activationCode: 'BASIC',
  isActive: true,
  isPublished: false,
  permanenceMonths: 0,
};

describe('catalog items service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockUpdate.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }));
  });

  it('lists filtered items with pagination and decimal conversion', async () => {
    mockCount.mockResolvedValue(3);
    const builder = listBuilder([listRow()]);
    mockSelect.mockReturnValueOnce(builder);

    await expect(
      service.listCatalogItems({
        page: 2,
        limit: 2,
        categoryId: CATEGORY_ID,
        itemTypeId: TYPE_ID,
        isActive: true,
        isPublished: true,
        search: 'premium',
        sortBy: 'price',
        sortOrder: 'desc',
      } as never)
    ).resolves.toEqual({
      data: [expect.objectContaining({ id: ITEM_ID, price: 19.99 })],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(builder.limit).toHaveBeenCalledWith(2);
    expect(builder.offset).toHaveBeenCalledWith(2);
  });

  it('lists unfiltered items with default pagination and sort behavior', async () => {
    mockCount.mockResolvedValue(0);
    const builder = listBuilder([]);
    mockSelect.mockReturnValueOnce(builder);

    await expect(service.listCatalogItems({ page: 1, limit: 10 } as never)).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(builder.offset).toHaveBeenCalledWith(0);
  });

  it('maps complete and empty item details and rejects missing items', async () => {
    mockFindFirst.mockResolvedValueOnce(detailRows(true));
    const result = await service.getCatalogItemById(ITEM_ID);
    expect(result).toEqual(
      expect.objectContaining({
        price: 19.99,
        voiceDetails: expect.objectContaining({ includedRoamingGb: 1.5 }),
        connectivityDetails: { id: expect.any(String), bandwidthMbps: 200 },
        deviceDetails: expect.objectContaining({ financingMonthly: 29.5 }),
        benefits: [expect.objectContaining({ createdAt: expect.any(String) })],
      })
    );

    mockFindFirst.mockResolvedValueOnce(detailRows(false));
    await expect(service.getCatalogItemById(ITEM_ID)).resolves.toEqual(
      expect.objectContaining({
        voiceDetails: null,
        connectivityDetails: null,
        digitalDetails: null,
        roamingDetails: null,
        deviceDetails: null,
        benefits: [],
        ageConditions: null,
        legalConditions: null,
        temporalConditions: null,
      })
    );

    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(service.getCatalogItemById(OTHER_ITEM_ID)).rejects.toThrow(NotFoundError);
  });

  it('creates all nested catalog data transactionally and rejects duplicates', async () => {
    mockSelect.mockReturnValueOnce(terminalSelect([detailRows(false)]));
    await expect(service.createCatalogItem(fullInput as never)).rejects.toThrow(ConflictError);

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    const tx = transaction();
    mockFindFirst.mockResolvedValueOnce(detailRows(true));
    await expect(service.createCatalogItem(fullInput as never)).resolves.toEqual(
      expect.objectContaining({ id: ITEM_ID, price: 19.99 })
    );
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(tx.insert).toHaveBeenCalled();

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    transaction();
    mockFindFirst.mockResolvedValueOnce(detailRows(false));
    await expect(service.createCatalogItem(minimalInput as never)).resolves.toEqual(
      expect.objectContaining({ id: ITEM_ID })
    );

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    mockTransaction.mockImplementationOnce(async () => {
      throw new Error('transaction failed');
    });
    await expect(service.createCatalogItem(fullInput as never)).rejects.toThrow(
      'transaction failed'
    );
  });

  it('updates scalar and nested data, including replacing and clearing benefits', async () => {
    mockFindFirst.mockResolvedValueOnce(detailRows(true));
    const tx = transaction();
    mockFindFirst.mockResolvedValueOnce(detailRows(false));
    await expect(
      service.updateCatalogItem(ITEM_ID, { ...fullInput, benefits: [] } as never)
    ).resolves.toEqual(expect.objectContaining({ benefits: [] }));
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(tx.delete).toHaveBeenCalled();

    mockFindFirst.mockResolvedValueOnce(detailRows(false));
    transaction();
    mockFindFirst.mockResolvedValueOnce(detailRows(false));
    await expect(
      service.updateCatalogItem(ITEM_ID, { description: 'Only description' } as never)
    ).resolves.toEqual(expect.objectContaining({ id: ITEM_ID }));

    mockFindFirst.mockResolvedValueOnce(detailRows(true));
    transaction();
    mockFindFirst.mockResolvedValueOnce(detailRows(false));
    await expect(
      service.updateCatalogItem(ITEM_ID, {
        ...fullInput,
        benefits: [{ benefitTypeId: TYPE_ID, name: 'Extra', durationDays: 7 }],
        deviceDetails: { ...fullInput.deviceDetails, financingMonthly: null },
      } as never)
    ).resolves.toEqual(expect.objectContaining({ benefits: [] }));

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    const emptyTransaction = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    };
    mockTransaction.mockImplementationOnce(
      async (callback: (value: typeof emptyTransaction) => Promise<unknown>) =>
        callback(emptyTransaction)
    );
    await expect(service.createCatalogItem(fullInput as never)).rejects.toThrow();

    mockFindFirst.mockResolvedValueOnce(undefined);
    await expect(
      service.updateCatalogItem(OTHER_ITEM_ID, { name: 'Missing' } as never)
    ).rejects.toThrow(NotFoundError);
  });

  it('soft deletes items and handles image upload and deletion paths', async () => {
    mockFindFirst.mockResolvedValueOnce(detailRows(false));
    const removeSet = updateResult([]);
    await expect(service.removeCatalogItem(ITEM_ID)).resolves.toBeUndefined();
    expect(removeSet).toHaveBeenCalledWith({ deletedAt: NOW });

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(
      service.uploadItemImage(OTHER_ITEM_ID, {
        buffer: Buffer.from('x'),
        mimetype: 'image/png',
        originalname: 'image.png',
      })
    ).rejects.toThrow(NotFoundError);

    mockSelect.mockReturnValueOnce(terminalSelect([{ id: ITEM_ID, imagePath: 'catalog/old.png' }]));
    await expect(
      service.uploadItemImage(ITEM_ID, {
        buffer: Buffer.from('x'),
        mimetype: 'image/jpeg',
        originalname: 'image.jpg',
      })
    ).resolves.toEqual({
      imagePath: expect.stringMatching(new RegExp(`^catalog/${ITEM_ID}/.*\\.jpg$`)),
    });
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^catalog/${ITEM_ID}/.*\\.jpg$`)),
      Buffer.from('x'),
      'image/jpeg'
    );
    expect(mockDeleteFile).toHaveBeenCalledWith('catalog/old.png');
    expect(mockUpdate).toHaveBeenCalled();

    mockSelect.mockReturnValueOnce(terminalSelect([{ id: ITEM_ID, imagePath: null }]));
    await expect(
      service.uploadItemImage(ITEM_ID, {
        buffer: Buffer.from('x'),
        mimetype: 'image/gif',
        originalname: 'x.gif',
      })
    ).rejects.toThrow(BadRequestError);

    mockSelect.mockReturnValueOnce(
      terminalSelect([{ id: ITEM_ID, imagePath: 'catalog/current.png' }])
    );
    await expect(service.deleteItemImage(ITEM_ID)).resolves.toBeUndefined();
    expect(mockDeleteFile).toHaveBeenCalledWith('catalog/current.png');

    mockSelect.mockReturnValueOnce(terminalSelect([{ id: ITEM_ID, imagePath: null }]));
    await expect(service.deleteItemImage(ITEM_ID)).resolves.toBeUndefined();

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(service.deleteItemImage(OTHER_ITEM_ID)).rejects.toThrow(NotFoundError);
  });
});
