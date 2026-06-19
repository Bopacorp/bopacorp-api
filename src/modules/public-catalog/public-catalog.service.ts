import { catalogItems, segments } from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { and, asc, eq, isNull } from 'drizzle-orm';

const NATURAL_SEGMENT_CODE = 'natural';

async function queryPublicItems(segmentId: string) {
  return db.query.catalogItems.findMany({
    where: and(
      eq(catalogItems.segmentId, segmentId),
      eq(catalogItems.isActive, true),
      eq(catalogItems.isPublished, true),
      isNull(catalogItems.deletedAt)
    ),
    with: {
      category: true,
      itemType: true,
      contractType: true,
      segment: true,
      tier: true,
      voiceDetails: true,
      connectivityDetails: true,
      digitalDetails: true,
      roamingDetails: true,
      deviceDetails: true,
      benefits: true,
      ageConditions: true,
      legalConditions: true,
      temporalConditions: true,
    },
    orderBy: [asc(catalogItems.price)],
  });
}

type CatalogItemWithRelations = Awaited<ReturnType<typeof queryPublicItems>>[number];

export async function listPublicCatalogItems() {
  const naturalSegment = await db
    .select({ id: segments.id })
    .from(segments)
    .where(eq(segments.code, NATURAL_SEGMENT_CODE))
    .limit(1);

  const segmentId = naturalSegment[0]?.id;
  if (!segmentId) return [];

  const items = await queryPublicItems(segmentId);
  return items.map(toPublicCatalogItem);
}

type PublicCatalogItem = ReturnType<typeof toPublicCatalogItem>;

function toPublicCatalogItem(item: CatalogItemWithRelations) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number.parseFloat(item.price),
    imagePath: item.imagePath,
    permanenceMonths: item.permanenceMonths,
    category: item.category ? { id: item.category.id, name: item.category.name } : null,
    itemType: item.itemType
      ? { id: item.itemType.id, code: item.itemType.code, name: item.itemType.name }
      : null,
    contractType: item.contractType
      ? { id: item.contractType.id, code: item.contractType.code, name: item.contractType.name }
      : null,
    segment: item.segment
      ? { id: item.segment.id, code: item.segment.code, name: item.segment.name }
      : null,
    tier: item.tier ? { id: item.tier.id, code: item.tier.code, name: item.tier.name } : null,
    voiceDetails: item.voiceDetails ? toVoiceDetails(item.voiceDetails) : null,
    connectivityDetails: item.connectivityDetails
      ? {
          id: item.connectivityDetails.id,
          bandwidthMbps: Number.parseFloat(item.connectivityDetails.bandwidthMbps),
        }
      : null,
    digitalDetails: item.digitalDetails
      ? { id: item.digitalDetails.id, provider: item.digitalDetails.provider }
      : null,
    roamingDetails: item.roamingDetails
      ? {
          id: item.roamingDetails.id,
          geoZoneId: item.roamingDetails.geoZoneId,
          dataMb: item.roamingDetails.dataMb,
          durationDays: item.roamingDetails.durationDays,
          hasThrottle: item.roamingDetails.hasThrottle,
        }
      : null,
    deviceDetails: item.deviceDetails
      ? {
          id: item.deviceDetails.id,
          brand: item.deviceDetails.brand,
          model: item.deviceDetails.model,
          storageGb: item.deviceDetails.storageGb,
          financingMonths: item.deviceDetails.financingMonths,
          financingMonthly: item.deviceDetails.financingMonthly
            ? Number.parseFloat(item.deviceDetails.financingMonthly)
            : null,
        }
      : null,
    benefits: item.benefits.map((b) => ({
      id: b.id,
      benefitTypeId: b.benefitTypeId,
      name: b.name,
      description: b.description,
      durationDays: b.durationDays,
    })),
    ageConditions: item.ageConditions
      ? {
          id: item.ageConditions.id,
          minAge: item.ageConditions.minAge,
          maxAge: item.ageConditions.maxAge,
        }
      : null,
    legalConditions: item.legalConditions
      ? {
          id: item.legalConditions.id,
          legalRequirement: item.legalConditions.legalRequirement,
          description: item.legalConditions.description,
        }
      : null,
    temporalConditions: item.temporalConditions
      ? {
          id: item.temporalConditions.id,
          effectiveDate: item.temporalConditions.effectiveDate,
          expirationDate: item.temporalConditions.expirationDate,
        }
      : null,
  };
}

function toVoiceDetails(detail: NonNullable<CatalogItemWithRelations['voiceDetails']>) {
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

export type { PublicCatalogItem };
