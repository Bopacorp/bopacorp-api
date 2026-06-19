import {
  catalogItems,
  categories,
  connectivityDetails,
  contractTypes,
  deviceDetails,
  digitalDetails,
  itemBenefits,
  itemTypes,
  roamingDetails,
  segments,
  tiers,
  voiceDetails,
} from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

const NATURAL_SEGMENT_CODE = 'natural';

async function queryPublicCatalogItems() {
  return db
    .select({
      id: catalogItems.id,
      name: catalogItems.name,
      description: catalogItems.description,
      price: catalogItems.price,
      imagePath: catalogItems.imagePath,
      permanenceMonths: catalogItems.permanenceMonths,
      category: { id: categories.id, name: categories.name },
      itemType: { id: itemTypes.id, code: itemTypes.code, name: itemTypes.name },
      contractType: { id: contractTypes.id, code: contractTypes.code, name: contractTypes.name },
      segment: { id: segments.id, code: segments.code, name: segments.name },
      tier: { id: tiers.id, code: tiers.code, name: tiers.name },
      voiceDetails: {
        id: voiceDetails.id,
        gigasStructural: voiceDetails.gigasStructural,
        gigasLoyalty: voiceDetails.gigasLoyalty,
        minutesNational: voiceDetails.minutesNational,
        minutesLdi: voiceDetails.minutesLdi,
        sms: voiceDetails.sms,
        hasUnlimitedMinutes: voiceDetails.hasUnlimitedMinutes,
        hasUnlimitedWhatsapp: voiceDetails.hasUnlimitedWhatsapp,
        hasSocialNetworks: voiceDetails.hasSocialNetworks,
        includedRoamingGb: voiceDetails.includedRoamingGb,
      },
      connectivityDetails: {
        id: connectivityDetails.id,
        bandwidthMbps: connectivityDetails.bandwidthMbps,
      },
      digitalDetails: {
        id: digitalDetails.id,
        provider: digitalDetails.provider,
      },
      roamingDetails: {
        id: roamingDetails.id,
        geoZoneId: roamingDetails.geoZoneId,
        dataMb: roamingDetails.dataMb,
        durationDays: roamingDetails.durationDays,
        hasThrottle: roamingDetails.hasThrottle,
      },
      deviceDetails: {
        id: deviceDetails.id,
        brand: deviceDetails.brand,
        model: deviceDetails.model,
        storageGb: deviceDetails.storageGb,
        financingMonths: deviceDetails.financingMonths,
        financingMonthly: deviceDetails.financingMonthly,
      },
    })
    .from(catalogItems)
    .innerJoin(categories, eq(catalogItems.categoryId, categories.id))
    .innerJoin(itemTypes, eq(catalogItems.itemTypeId, itemTypes.id))
    .innerJoin(contractTypes, eq(catalogItems.contractTypeId, contractTypes.id))
    .innerJoin(segments, eq(catalogItems.segmentId, segments.id))
    .innerJoin(tiers, eq(catalogItems.tierId, tiers.id))
    .leftJoin(voiceDetails, eq(catalogItems.id, voiceDetails.itemId))
    .leftJoin(connectivityDetails, eq(catalogItems.id, connectivityDetails.itemId))
    .leftJoin(digitalDetails, eq(catalogItems.id, digitalDetails.itemId))
    .leftJoin(roamingDetails, eq(catalogItems.id, roamingDetails.itemId))
    .leftJoin(deviceDetails, eq(catalogItems.id, deviceDetails.itemId))
    .where(
      and(
        eq(segments.code, NATURAL_SEGMENT_CODE),
        eq(catalogItems.isActive, true),
        eq(catalogItems.isPublished, true),
        isNull(catalogItems.deletedAt)
      )
    )
    .orderBy(asc(catalogItems.price));
}

type CatalogItemRow = Awaited<ReturnType<typeof queryPublicCatalogItems>>[number];

export async function listPublicCatalogItems() {
  const rows = await queryPublicCatalogItems();

  const itemIds = rows.map((row) => row.id);
  const benefits =
    itemIds.length > 0
      ? await db.select().from(itemBenefits).where(inArray(itemBenefits.itemId, itemIds))
      : [];

  const benefitsByItemId = new Map<string, typeof benefits>();
  for (const benefit of benefits) {
    const list = benefitsByItemId.get(benefit.itemId) ?? [];
    list.push(benefit);
    benefitsByItemId.set(benefit.itemId, list);
  }

  return rows.map((row) => toPublicCatalogItem(row, benefitsByItemId.get(row.id) ?? []));
}

function toPublicCatalogItem(
  row: CatalogItemRow,
  benefits: (typeof itemBenefits)['$inferSelect'][]
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number.parseFloat(row.price),
    imagePath: row.imagePath,
    permanenceMonths: row.permanenceMonths,
    category: row.category,
    itemType: row.itemType,
    contractType: row.contractType,
    segment: row.segment,
    tier: row.tier,
    voiceDetails: row.voiceDetails?.id ? toVoiceDetails(row.voiceDetails) : null,
    connectivityDetails: row.connectivityDetails?.id
      ? {
          id: row.connectivityDetails.id,
          bandwidthMbps: Number.parseFloat(row.connectivityDetails.bandwidthMbps),
        }
      : null,
    digitalDetails: row.digitalDetails?.id
      ? { id: row.digitalDetails.id, provider: row.digitalDetails.provider }
      : null,
    roamingDetails: row.roamingDetails?.id
      ? {
          id: row.roamingDetails.id,
          geoZoneId: row.roamingDetails.geoZoneId,
          dataMb: row.roamingDetails.dataMb,
          durationDays: row.roamingDetails.durationDays,
          hasThrottle: row.roamingDetails.hasThrottle,
        }
      : null,
    deviceDetails: row.deviceDetails?.id
      ? {
          id: row.deviceDetails.id,
          brand: row.deviceDetails.brand,
          model: row.deviceDetails.model,
          storageGb: row.deviceDetails.storageGb,
          financingMonths: row.deviceDetails.financingMonths,
          financingMonthly: row.deviceDetails.financingMonthly
            ? Number.parseFloat(row.deviceDetails.financingMonthly)
            : null,
        }
      : null,
    benefits: benefits.map((b) => ({
      id: b.id,
      benefitTypeId: b.benefitTypeId,
      name: b.name,
      description: b.description,
      durationDays: b.durationDays,
    })),
  };
}

function toVoiceDetails(detail: NonNullable<CatalogItemRow['voiceDetails']>) {
  return {
    id: detail.id,
    gigasStructural: detail.gigasStructural,
    gigasLoyalty: detail.gigasLoyalty,
    minutesNational: detail.minutesNational,
    minutesLdi: detail.minutesLdi,
    sms: detail.sms,
    hasUnlimitedMinutes: detail.hasUnlimitedMinutes,
    hasUnlimitedWhatsapp: detail.hasUnlimitedWhatsapp,
    hasSocialNetworks: detail.hasSocialNetworks,
    includedRoamingGb: Number.parseFloat(detail.includedRoamingGb),
  };
}

export type { CatalogItemRow as PublicCatalogItem };
