import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockSelectDistinct = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: { select: mockSelect, selectDistinct: mockSelectDistinct },
}));

const service = await import('./public-catalog.service.js');

const ITEM_ID = '11111111-1111-1111-1111-111111111111';
const CATEGORY_ID = '22222222-2222-2222-2222-222222222222';
const TYPE_ID = '33333333-3333-3333-3333-333333333333';
const CONTRACT_ID = '44444444-4444-4444-4444-444444444444';
const SEGMENT_ID = '55555555-5555-5555-5555-555555555555';
const TIER_ID = '66666666-6666-6666-6666-666666666666';

function catalogRow(includeDetails = true) {
  return {
    id: ITEM_ID,
    name: 'Public plan',
    description: 'Visible plan',
    price: '10.50',
    imagePath: 'catalog/public.png',
    permanenceMonths: 6,
    category: { id: CATEGORY_ID, name: 'Mobile', slug: 'mobile' },
    itemType: { id: TYPE_ID, code: 'VOICE', name: 'Voice' },
    contractType: { id: CONTRACT_ID, code: 'POST', name: 'Postpaid' },
    segment: { id: SEGMENT_ID, code: 'B2C', name: 'Consumer' },
    tier: { id: TIER_ID, code: 'STANDARD', name: 'Standard' },
    voiceDetails: includeDetails
      ? {
          id: '70000000-0000-0000-0000-000000000001',
          gigasStructural: 2,
          gigasLoyalty: 1,
          minutesNational: 50,
          minutesLdi: 5,
          sms: 10,
          hasUnlimitedMinutes: false,
          hasUnlimitedWhatsapp: true,
          hasSocialNetworks: true,
          includedRoamingGb: '0.5',
        }
      : null,
    connectivityDetails: includeDetails
      ? { id: '70000000-0000-0000-0000-000000000002', bandwidthMbps: '100' }
      : null,
    digitalDetails: includeDetails
      ? { id: '70000000-0000-0000-0000-000000000003', provider: 'Video' }
      : null,
    roamingDetails: includeDetails
      ? {
          id: '70000000-0000-0000-0000-000000000004',
          geoZoneId: '80000000-0000-0000-0000-000000000001',
          dataMb: 100,
          durationDays: 7,
          hasThrottle: false,
        }
      : null,
    deviceDetails: includeDetails
      ? {
          id: '70000000-0000-0000-0000-000000000005',
          brand: 'Bopa',
          model: 'Mini',
          storageGb: 64,
          financingMonths: 6,
          financingMonthly: '12.25',
        }
      : null,
  };
}

function catalogQuery(result: unknown) {
  const builder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

function terminalSelect(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  return builder;
}

function distinctQuery(result: unknown) {
  const builder = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

describe('public catalog service', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lists public items with all filters, details, benefits, and decimal conversion', async () => {
    const row = catalogRow(true);
    mockSelect.mockReturnValueOnce(catalogQuery([row]));
    mockSelect.mockReturnValueOnce(
      terminalSelect([
        {
          id: '90000000-0000-0000-0000-000000000001',
          itemId: ITEM_ID,
          benefitTypeId: TYPE_ID,
          name: 'Music',
          description: 'Music access',
          durationDays: 30,
        },
      ])
    );

    await expect(
      service.listPublicCatalogItems({
        categoryId: CATEGORY_ID,
        categorySlug: 'mobile',
        segmentId: SEGMENT_ID,
        minPrice: 5,
        maxPrice: 20,
      } as never)
    ).resolves.toEqual([
      expect.objectContaining({
        id: ITEM_ID,
        price: 10.5,
        voiceDetails: expect.objectContaining({ includedRoamingGb: 0.5 }),
        connectivityDetails: expect.objectContaining({ bandwidthMbps: 100 }),
        deviceDetails: expect.objectContaining({ financingMonthly: 12.25 }),
        benefits: [expect.objectContaining({ name: 'Music' })],
      }),
    ]);
  });

  it('returns null optional details and skips benefits query for an empty result', async () => {
    mockSelect.mockReturnValueOnce(catalogQuery([catalogRow(false)]));
    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(service.listPublicCatalogItems()).resolves.toEqual([
      expect.objectContaining({
        voiceDetails: null,
        connectivityDetails: null,
        digitalDetails: null,
        roamingDetails: null,
        deviceDetails: null,
        benefits: [],
      }),
    ]);

    mockSelect.mockReturnValueOnce(catalogQuery([]));
    await expect(service.listPublicCatalogItems()).resolves.toEqual([]);
    expect(mockSelect).toHaveBeenCalledTimes(3);
  });

  it('lists only categories and segments attached to public items', async () => {
    const categoryRows = [{ id: CATEGORY_ID, name: 'Mobile', slug: 'mobile' }];
    mockSelectDistinct.mockReturnValueOnce(distinctQuery(categoryRows));
    await expect(service.listPublicCategories()).resolves.toEqual(categoryRows);

    const segmentRows = [{ id: SEGMENT_ID, code: 'B2C', name: 'Consumer' }];
    mockSelectDistinct.mockReturnValueOnce(distinctQuery(segmentRows));
    await expect(service.listPublicSegments()).resolves.toEqual(segmentRows);
  });
});
