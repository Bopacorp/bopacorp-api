import crypto from 'node:crypto';
import type {
  CreateCatalogItemRequest,
  ListCatalogItemsQuery,
  UpdateCatalogItemRequest,
} from '@bopacorp/shared/catalog';
import {
  ageConditions,
  catalogItems,
  categories,
  connectivityDetails,
  contractTypes,
  deviceDetails,
  digitalDetails,
  itemBenefits,
  itemTypes,
  legalConditions,
  roamingDetails,
  temporalConditions,
  voiceDetails,
} from '@db/schema/catalog.js';
import { db } from '@lib/db.js';
import { deleteFile, uploadFile } from '@lib/storage.js';
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from '@shared/errors/http-error.js';
import { and, eq, ilike, isNull } from 'drizzle-orm';

export async function listCatalogItems(query: ListCatalogItemsQuery) {
  const conditions = [isNull(catalogItems.deletedAt)];

  if (query.categoryId) {
    conditions.push(eq(catalogItems.categoryId, query.categoryId));
  }

  if (query.itemTypeId) {
    conditions.push(eq(catalogItems.itemTypeId, query.itemTypeId));
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(catalogItems.isActive, query.isActive));
  }

  if (query.isPublished !== undefined) {
    conditions.push(eq(catalogItems.isPublished, query.isPublished));
  }

  if (query.search) {
    conditions.push(ilike(catalogItems.name, `%${query.search}%`));
  }

  const where = and(...conditions);

  const totalItems = await db.$count(catalogItems, where);
  const totalPages = Math.ceil(totalItems / query.limit);

  const rows = await db
    .select({
      id: catalogItems.id,
      name: catalogItems.name,
      price: catalogItems.price,
      imagePath: catalogItems.imagePath,
      isActive: catalogItems.isActive,
      isPublished: catalogItems.isPublished,
      category: { id: categories.id, name: categories.name },
      itemType: { id: itemTypes.id, name: itemTypes.name },
      contractType: { id: contractTypes.id, name: contractTypes.name },
      createdAt: catalogItems.createdAt,
      updatedAt: catalogItems.updatedAt,
    })
    .from(catalogItems)
    .innerJoin(categories, eq(catalogItems.categoryId, categories.id))
    .innerJoin(itemTypes, eq(catalogItems.itemTypeId, itemTypes.id))
    .innerJoin(contractTypes, eq(catalogItems.contractTypeId, contractTypes.id))
    .where(where)
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .orderBy(catalogItems.name);

  return {
    data: rows.map((row) => ({
      ...row,
      price: Number.parseFloat(row.price),
    })),
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getCatalogItemById(id: string) {
  const item = await db.query.catalogItems.findFirst({
    where: and(eq(catalogItems.id, id), isNull(catalogItems.deletedAt)),
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
  });

  if (!item) {
    throw new NotFoundError('Catalog item', id);
  }

  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number.parseFloat(item.price),
    activationCode: item.activationCode,
    imagePath: item.imagePath,
    isActive: item.isActive,
    isPublished: item.isPublished,
    permanenceMonths: item.permanenceMonths,
    category: item.category
      ? {
          id: item.category.id,
          name: item.category.name,
        }
      : { id: '', name: '' },
    itemType: item.itemType
      ? {
          id: item.itemType.id,
          code: item.itemType.code,
          name: item.itemType.name,
        }
      : { id: '', code: '', name: '' },
    contractType: item.contractType
      ? {
          id: item.contractType.id,
          code: item.contractType.code,
          name: item.contractType.name,
        }
      : { id: '', code: '', name: '' },
    segment: item.segment
      ? {
          id: item.segment.id,
          code: item.segment.code,
          name: item.segment.name,
        }
      : { id: '', code: '', name: '' },
    tier: item.tier
      ? {
          id: item.tier.id,
          code: item.tier.code,
          name: item.tier.name,
        }
      : { id: '', code: '', name: '' },
    voiceDetails: item.voiceDetails
      ? {
          id: item.voiceDetails.id,
          gigasStructural: item.voiceDetails.gigasStructural,
          gigasLoyalty: item.voiceDetails.gigasLoyalty,
          minutesNational: item.voiceDetails.minutesNational,
          minutesLdi: item.voiceDetails.minutesLdi,
          sms: item.voiceDetails.sms,
          hasUnlimitedMinutes: item.voiceDetails.hasUnlimitedMinutes,
          hasUnlimitedWhatsapp: item.voiceDetails.hasUnlimitedWhatsapp,
          hasSocialNetworks: item.voiceDetails.hasSocialNetworks,
          includedRoamingGb: Number.parseFloat(item.voiceDetails.includedRoamingGb),
        }
      : null,
    connectivityDetails: item.connectivityDetails
      ? {
          id: item.connectivityDetails.id,
          bandwidthMbps: Number.parseFloat(item.connectivityDetails.bandwidthMbps),
        }
      : null,
    digitalDetails: item.digitalDetails
      ? {
          id: item.digitalDetails.id,
          provider: item.digitalDetails.provider,
        }
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
    benefits: (item.benefits ?? []).map((b) => ({
      id: b.id,
      benefitTypeId: b.benefitTypeId,
      name: b.name,
      description: b.description,
      durationDays: b.durationDays,
      createdAt: b.createdAt ? b.createdAt.toISOString() : '',
      updatedAt: b.updatedAt ? b.updatedAt.toISOString() : '',
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
    createdAt: item.createdAt ? item.createdAt.toISOString() : '',
    updatedAt: item.updatedAt ? item.updatedAt.toISOString() : '',
  };
}

export async function createCatalogItem(input: CreateCatalogItemRequest) {
  const existing = await db
    .select()
    .from(catalogItems)
    .where(and(eq(catalogItems.name, input.name), isNull(catalogItems.deletedAt)));

  if (existing.length > 0) {
    throw new ConflictError(`Catalog item with name '${input.name}' already exists`);
  }

  return db.transaction(async (tx) => {
    const [item] = await tx
      .insert(catalogItems)
      .values({
        categoryId: input.categoryId,
        itemTypeId: input.itemTypeId,
        contractTypeId: input.contractTypeId,
        segmentId: input.segmentId,
        tierId: input.tierId,
        name: input.name,
        description: input.description,
        price: input.price.toString(),
        activationCode: input.activationCode,
        isActive: input.isActive,
        isPublished: input.isPublished,
        permanenceMonths: input.permanenceMonths,
      })
      .returning();

    if (!item) {
      throw new InternalServerError();
    }

    if (input.voiceDetails) {
      await tx.insert(voiceDetails).values({
        itemId: item.id,
        gigasStructural: input.voiceDetails.gigasStructural,
        gigasLoyalty: input.voiceDetails.gigasLoyalty,
        minutesNational: input.voiceDetails.minutesNational,
        minutesLdi: input.voiceDetails.minutesLdi,
        sms: input.voiceDetails.sms,
        hasUnlimitedMinutes: input.voiceDetails.hasUnlimitedMinutes,
        hasUnlimitedWhatsapp: input.voiceDetails.hasUnlimitedWhatsapp,
        hasSocialNetworks: input.voiceDetails.hasSocialNetworks,
        includedRoamingGb: input.voiceDetails.includedRoamingGb.toString(),
      });
    }

    if (input.connectivityDetails) {
      await tx.insert(connectivityDetails).values({
        itemId: item.id,
        bandwidthMbps: input.connectivityDetails.bandwidthMbps.toString(),
      });
    }

    if (input.digitalDetails) {
      await tx.insert(digitalDetails).values({
        itemId: item.id,
        provider: input.digitalDetails.provider,
      });
    }

    if (input.roamingDetails) {
      await tx.insert(roamingDetails).values({
        itemId: item.id,
        geoZoneId: input.roamingDetails.geoZoneId,
        dataMb: input.roamingDetails.dataMb,
        durationDays: input.roamingDetails.durationDays,
        hasThrottle: input.roamingDetails.hasThrottle,
      });
    }

    if (input.deviceDetails) {
      await tx.insert(deviceDetails).values({
        itemId: item.id,
        brand: input.deviceDetails.brand,
        model: input.deviceDetails.model,
        storageGb: input.deviceDetails.storageGb,
        financingMonths: input.deviceDetails.financingMonths,
        financingMonthly: input.deviceDetails.financingMonthly
          ? input.deviceDetails.financingMonthly.toString()
          : undefined,
      });
    }

    if (input.benefits && input.benefits.length > 0) {
      await tx.insert(itemBenefits).values(
        input.benefits.map((b) => ({
          itemId: item.id,
          benefitTypeId: b.benefitTypeId,
          name: b.name,
          description: b.description,
          durationDays: b.durationDays,
        }))
      );
    }

    if (input.ageConditions) {
      await tx.insert(ageConditions).values({
        itemId: item.id,
        minAge: input.ageConditions.minAge,
        maxAge: input.ageConditions.maxAge,
      });
    }

    if (input.legalConditions) {
      await tx.insert(legalConditions).values({
        itemId: item.id,
        legalRequirement: input.legalConditions.legalRequirement,
        description: input.legalConditions.description,
      });
    }

    if (input.temporalConditions) {
      await tx.insert(temporalConditions).values({
        itemId: item.id,
        effectiveDate: input.temporalConditions.effectiveDate,
        expirationDate: input.temporalConditions.expirationDate,
      });
    }

    return getCatalogItemById(item.id);
  });
}

export async function updateCatalogItem(id: string, input: UpdateCatalogItemRequest) {
  await getCatalogItemById(id);

  return db.transaction(async (tx) => {
    const updateData: Partial<typeof catalogItems.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.itemTypeId !== undefined) updateData.itemTypeId = input.itemTypeId;
    if (input.contractTypeId !== undefined) updateData.contractTypeId = input.contractTypeId;
    if (input.segmentId !== undefined) updateData.segmentId = input.segmentId;
    if (input.tierId !== undefined) updateData.tierId = input.tierId;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.activationCode !== undefined) updateData.activationCode = input.activationCode;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.isPublished !== undefined) updateData.isPublished = input.isPublished;
    if (input.permanenceMonths !== undefined) updateData.permanenceMonths = input.permanenceMonths;

    if (Object.keys(updateData).length > 1) {
      await tx.update(catalogItems).set(updateData).where(eq(catalogItems.id, id));
    }

    if (input.voiceDetails) {
      await tx.delete(voiceDetails).where(eq(voiceDetails.itemId, id));
      await tx.insert(voiceDetails).values({
        itemId: id,
        gigasStructural: input.voiceDetails.gigasStructural,
        gigasLoyalty: input.voiceDetails.gigasLoyalty,
        minutesNational: input.voiceDetails.minutesNational,
        minutesLdi: input.voiceDetails.minutesLdi,
        sms: input.voiceDetails.sms,
        hasUnlimitedMinutes: input.voiceDetails.hasUnlimitedMinutes,
        hasUnlimitedWhatsapp: input.voiceDetails.hasUnlimitedWhatsapp,
        hasSocialNetworks: input.voiceDetails.hasSocialNetworks,
        includedRoamingGb: input.voiceDetails.includedRoamingGb.toString(),
      });
    }

    if (input.connectivityDetails) {
      await tx.delete(connectivityDetails).where(eq(connectivityDetails.itemId, id));
      await tx.insert(connectivityDetails).values({
        itemId: id,
        bandwidthMbps: input.connectivityDetails.bandwidthMbps.toString(),
      });
    }

    if (input.digitalDetails) {
      await tx.delete(digitalDetails).where(eq(digitalDetails.itemId, id));
      await tx.insert(digitalDetails).values({
        itemId: id,
        provider: input.digitalDetails.provider,
      });
    }

    if (input.roamingDetails) {
      await tx.delete(roamingDetails).where(eq(roamingDetails.itemId, id));
      await tx.insert(roamingDetails).values({
        itemId: id,
        geoZoneId: input.roamingDetails.geoZoneId,
        dataMb: input.roamingDetails.dataMb,
        durationDays: input.roamingDetails.durationDays,
        hasThrottle: input.roamingDetails.hasThrottle,
      });
    }

    if (input.deviceDetails) {
      await tx.delete(deviceDetails).where(eq(deviceDetails.itemId, id));
      await tx.insert(deviceDetails).values({
        itemId: id,
        brand: input.deviceDetails.brand,
        model: input.deviceDetails.model,
        storageGb: input.deviceDetails.storageGb,
        financingMonths: input.deviceDetails.financingMonths,
        financingMonthly: input.deviceDetails.financingMonthly
          ? input.deviceDetails.financingMonthly.toString()
          : undefined,
      });
    }

    if (input.benefits !== undefined) {
      await tx.delete(itemBenefits).where(eq(itemBenefits.itemId, id));
      if (input.benefits.length > 0) {
        await tx.insert(itemBenefits).values(
          input.benefits.map((b) => ({
            itemId: id,
            benefitTypeId: b.benefitTypeId,
            name: b.name,
            description: b.description,
            durationDays: b.durationDays,
          }))
        );
      }
    }

    if (input.ageConditions) {
      await tx.delete(ageConditions).where(eq(ageConditions.itemId, id));
      await tx.insert(ageConditions).values({
        itemId: id,
        minAge: input.ageConditions.minAge,
        maxAge: input.ageConditions.maxAge,
      });
    }

    if (input.legalConditions) {
      await tx.delete(legalConditions).where(eq(legalConditions.itemId, id));
      await tx.insert(legalConditions).values({
        itemId: id,
        legalRequirement: input.legalConditions.legalRequirement,
        description: input.legalConditions.description,
      });
    }

    if (input.temporalConditions) {
      await tx.delete(temporalConditions).where(eq(temporalConditions.itemId, id));
      await tx.insert(temporalConditions).values({
        itemId: id,
        effectiveDate: input.temporalConditions.effectiveDate,
        expirationDate: input.temporalConditions.expirationDate,
      });
    }

    return getCatalogItemById(id);
  });
}

export async function removeCatalogItem(id: string) {
  await getCatalogItemById(id);

  await db.update(catalogItems).set({ deletedAt: new Date() }).where(eq(catalogItems.id, id));
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export async function uploadItemImage(
  id: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
) {
  const item = await db
    .select({ id: catalogItems.id, imagePath: catalogItems.imagePath })
    .from(catalogItems)
    .where(and(eq(catalogItems.id, id), isNull(catalogItems.deletedAt)));

  if (item.length === 0) {
    throw new NotFoundError('Catalog item', id);
  }

  const ext = MIME_EXTENSIONS[file.mimetype];
  if (!ext) {
    throw new BadRequestError('Unsupported image format');
  }

  const oldPath = item[0]?.imagePath;
  const storagePath = `catalog/${id}/${crypto.randomUUID()}${ext}`;

  await uploadFile(storagePath, file.buffer, file.mimetype);

  if (oldPath) {
    await deleteFile(oldPath);
  }

  await db
    .update(catalogItems)
    .set({ imagePath: storagePath, updatedAt: new Date() })
    .where(eq(catalogItems.id, id));

  return { imagePath: storagePath };
}

export async function deleteItemImage(id: string) {
  const item = await db
    .select({ id: catalogItems.id, imagePath: catalogItems.imagePath })
    .from(catalogItems)
    .where(and(eq(catalogItems.id, id), isNull(catalogItems.deletedAt)));

  if (item.length === 0) {
    throw new NotFoundError('Catalog item', id);
  }

  const imagePath = item[0]?.imagePath;
  if (imagePath) {
    await deleteFile(imagePath);
  }

  await db
    .update(catalogItems)
    .set({ imagePath: null, updatedAt: new Date() })
    .where(eq(catalogItems.id, id));
}
