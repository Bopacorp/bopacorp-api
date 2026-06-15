import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const catalogSchema = pgSchema('catalog');

// ── Lookup tables (7) ──

export const itemTypes = catalogSchema.table('item_types', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const contractTypes = catalogSchema.table('contract_types', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const segments = catalogSchema.table('segments', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const tiers = catalogSchema.table('tiers', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const geoZones = catalogSchema.table('geo_zones', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const benefitTypes = catalogSchema.table('benefit_types', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const contentTypes = catalogSchema.table('content_types', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 30 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Entity tables (13) ──

export const categories = catalogSchema.table(
  'categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'set null',
    }),
    name: varchar({ length: 100 }).notNull(),
    description: varchar({ length: 255 }),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_categories_parent').on(t.parentId)]
);

export const catalogItems = catalogSchema.table(
  'catalog_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    itemTypeId: uuid('item_type_id')
      .notNull()
      .references(() => itemTypes.id, { onDelete: 'restrict' }),
    contractTypeId: uuid('contract_type_id')
      .notNull()
      .references(() => contractTypes.id, { onDelete: 'restrict' }),
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => segments.id, { onDelete: 'restrict' }),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => tiers.id, { onDelete: 'restrict' }),
    name: varchar({ length: 200 }).notNull(),
    description: text(),
    price: decimal({ precision: 15, scale: 2 }).notNull(),
    activationCode: varchar('activation_code', { length: 50 }),
    isActive: boolean('is_active').notNull().default(true),
    isPublished: boolean('is_published').notNull().default(false),
    permanenceMonths: integer('permanence_months').notNull().default(0),
    imagePath: varchar('image_path', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_catalog_items_category').on(t.categoryId),
    index('idx_catalog_items_item_type').on(t.itemTypeId).where(sql`deleted_at IS NULL`),
    index('idx_catalog_items_contract_type').on(t.contractTypeId).where(sql`deleted_at IS NULL`),
    index('idx_catalog_items_segment').on(t.segmentId).where(sql`deleted_at IS NULL`),
    index('idx_catalog_items_tier').on(t.tierId).where(sql`deleted_at IS NULL`),
    index('idx_catalog_items_published').on(t.isPublished).where(sql`deleted_at IS NULL`),
    check('chk_price', sql`price >= 0`),
    check('chk_permanence', sql`permanence_months >= 0`),
  ]
);

export const voiceDetails = catalogSchema.table(
  'voice_details',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .unique()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    gigasStructural: integer('gigas_structural').notNull(),
    gigasLoyalty: integer('gigas_loyalty').notNull().default(0),
    minutesNational: integer('minutes_national'),
    minutesLdi: integer('minutes_ldi').notNull().default(0),
    sms: integer().notNull().default(0),
    hasUnlimitedMinutes: boolean('has_unlimited_minutes').notNull().default(false),
    hasUnlimitedWhatsapp: boolean('has_unlimited_whatsapp').notNull().default(true),
    hasSocialNetworks: boolean('has_social_networks').notNull().default(false),
    includedRoamingGb: decimal('included_roaming_gb', { precision: 5, scale: 1 })
      .notNull()
      .default('0'),
  },
  (t) => [index('idx_voice_details_item').on(t.itemId)]
);

export const connectivityDetails = catalogSchema.table(
  'connectivity_details',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .unique()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    bandwidthMbps: decimal('bandwidth_mbps', { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [index('idx_connectivity_details_item').on(t.itemId)]
);

export const digitalDetails = catalogSchema.table(
  'digital_details',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .unique()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    provider: varchar({ length: 100 }).notNull(),
  },
  (t) => [index('idx_digital_details_item').on(t.itemId)]
);

export const roamingDetails = catalogSchema.table(
  'roaming_details',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .unique()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    geoZoneId: uuid('geo_zone_id')
      .notNull()
      .references(() => geoZones.id, { onDelete: 'restrict' }),
    dataMb: integer('data_mb').notNull(),
    durationDays: integer('duration_days').notNull(),
    hasThrottle: boolean('has_throttle').notNull().default(false),
  },
  (t) => [
    index('idx_roaming_details_item').on(t.itemId),
    index('idx_roaming_details_geo_zone').on(t.geoZoneId),
    check('chk_data_mb', sql`data_mb > 0`),
    check('chk_roaming_duration', sql`duration_days > 0`),
  ]
);

export const deviceDetails = catalogSchema.table(
  'device_details',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .unique()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    brand: varchar({ length: 100 }).notNull(),
    model: varchar({ length: 100 }).notNull(),
    storageGb: integer('storage_gb'),
    financingMonths: integer('financing_months'),
    financingMonthly: decimal('financing_monthly', { precision: 15, scale: 2 }),
  },
  (t) => [
    index('idx_device_details_item').on(t.itemId),
    check('chk_financing_months', sql`financing_months > 0`),
    check('chk_financing_monthly', sql`financing_monthly >= 0`),
  ]
);

export const itemBenefits = catalogSchema.table(
  'item_benefits',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    benefitTypeId: uuid('benefit_type_id')
      .notNull()
      .references(() => benefitTypes.id, { onDelete: 'restrict' }),
    name: varchar({ length: 100 }).notNull(),
    description: varchar({ length: 255 }),
    durationDays: integer('duration_days'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_item_benefits_item').on(t.itemId),
    index('idx_item_benefits_type').on(t.benefitTypeId),
    check('chk_benefit_duration', sql`duration_days > 0`),
  ]
);

export const ageConditions = catalogSchema.table(
  'age_conditions',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .unique()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    minAge: integer('min_age').notNull(),
    maxAge: integer('max_age'),
  },
  (t) => [
    index('idx_age_conditions_item').on(t.itemId),
    check('chk_min_age', sql`min_age >= 0`),
    check('chk_max_age', sql`max_age >= 0`),
    check('chk_age_range', sql`max_age IS NULL OR max_age >= min_age`),
  ]
);

export const legalConditions = catalogSchema.table(
  'legal_conditions',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .unique()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    legalRequirement: text('legal_requirement').notNull(),
    description: varchar({ length: 255 }),
  },
  (t) => [index('idx_legal_conditions_item').on(t.itemId)]
);

export const temporalConditions = catalogSchema.table(
  'temporal_conditions',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .unique()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    effectiveDate: date('effective_date').notNull(),
    expirationDate: date('expiration_date'),
  },
  (t) => [
    index('idx_temporal_conditions_item').on(t.itemId),
    check('chk_temporal_range', sql`expiration_date IS NULL OR expiration_date >= effective_date`),
  ]
);

export const contentBlocks = catalogSchema.table(
  'content_blocks',
  {
    id: uuid().primaryKey().defaultRandom(),
    contentKey: varchar('content_key', { length: 100 }).notNull(),
    contentTypeId: uuid('content_type_id')
      .notNull()
      .references(() => contentTypes.id, { onDelete: 'restrict' }),
    title: varchar({ length: 200 }),
    body: text(),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('idx_content_blocks_key').on(t.contentKey).where(sql`deleted_at IS NULL`),
    index('idx_content_blocks_type').on(t.contentTypeId),
    index('idx_content_blocks_updated_by').on(t.updatedBy),
  ]
);

export const contactRequests = catalogSchema.table(
  'contact_requests',
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid('item_id').references(() => catalogItems.id, { onDelete: 'set null' }),
    clientName: varchar('client_name', { length: 200 }).notNull(),
    clientEmail: varchar('client_email', { length: 150 }).notNull(),
    clientPhone: varchar('client_phone', { length: 20 }),
    message: text(),
    isAttended: boolean('is_attended').notNull().default(false),
    attendedAt: timestamp('attended_at', { withTimezone: true }),
    attendedBy: uuid('attended_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_contact_requests_item').on(t.itemId),
    index('idx_contact_requests_attended').on(t.isAttended),
  ]
);
