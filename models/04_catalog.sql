-- =============================================
-- Phase 4: Service Catalog + CMS
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schema: catalog
-- =============================================
-- 20 tables:
--   item_types, contract_types, segments, tiers,
--   geo_zones, benefit_types, content_types,
--   categories, catalog_items,
--   voice_details, connectivity_details, digital_details,
--   roaming_details, device_details,
--   item_benefits,
--   age_conditions, legal_conditions, temporal_conditions,
--   content_blocks, contact_requests
-- =============================================

CREATE SCHEMA IF NOT EXISTS catalog;

-- =============================================
-- LOOKUP TABLES (7)
-- =============================================

-- 1. ITEM_TYPES
CREATE TABLE catalog.item_types (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 2. CONTRACT_TYPES
CREATE TABLE catalog.contract_types (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 3. SEGMENTS
CREATE TABLE catalog.segments (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 4. TIERS
CREATE TABLE catalog.tiers (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 5. GEO_ZONES
CREATE TABLE catalog.geo_zones (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 6. BENEFIT_TYPES
CREATE TABLE catalog.benefit_types (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 7. CONTENT_TYPES
CREATE TABLE catalog.content_types (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ENTITY TABLES (13)
-- =============================================

-- 8. CATEGORIES (hierarchical product categories)
CREATE TABLE catalog.categories (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID         REFERENCES catalog.categories(id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_parent ON catalog.categories(parent_id);

-- 9. CATALOG_ITEMS (core product/service entity)
CREATE TABLE catalog.catalog_items (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id       UUID          NOT NULL REFERENCES catalog.categories(id) ON DELETE RESTRICT,
    item_type_id      UUID          NOT NULL REFERENCES catalog.item_types(id) ON DELETE RESTRICT,
    contract_type_id  UUID          NOT NULL REFERENCES catalog.contract_types(id) ON DELETE RESTRICT,
    segment_id        UUID          NOT NULL REFERENCES catalog.segments(id) ON DELETE RESTRICT,
    tier_id           UUID          NOT NULL REFERENCES catalog.tiers(id) ON DELETE RESTRICT,
    name              VARCHAR(200)  NOT NULL,
    description       TEXT,
    price             DECIMAL(15,2) NOT NULL CHECK (price >= 0),
    activation_code   VARCHAR(50),
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    is_published      BOOLEAN       NOT NULL DEFAULT FALSE,
    permanence_months INTEGER       NOT NULL DEFAULT 0 CHECK (permanence_months >= 0),
    created_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_catalog_items_category      ON catalog.catalog_items(category_id);
CREATE INDEX idx_catalog_items_item_type     ON catalog.catalog_items(item_type_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_contract_type ON catalog.catalog_items(contract_type_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_segment       ON catalog.catalog_items(segment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_tier          ON catalog.catalog_items(tier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_published     ON catalog.catalog_items(is_published) WHERE deleted_at IS NULL;

-- 10. VOICE_DETAILS (1:1 — mobile/voice plans per commercial guide)
CREATE TABLE catalog.voice_details (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id                UUID         NOT NULL UNIQUE REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    gigas_structural       INTEGER      NOT NULL,
    gigas_loyalty          INTEGER      NOT NULL DEFAULT 0,
    minutes_national       INTEGER,
    minutes_ldi            INTEGER      NOT NULL DEFAULT 0,
    sms                    INTEGER      NOT NULL DEFAULT 0,
    has_unlimited_minutes  BOOLEAN      NOT NULL DEFAULT FALSE,
    has_unlimited_whatsapp BOOLEAN      NOT NULL DEFAULT TRUE,
    has_social_networks    BOOLEAN      NOT NULL DEFAULT FALSE,
    included_roaming_gb    DECIMAL(5,1) NOT NULL DEFAULT 0
);

CREATE INDEX idx_voice_details_item ON catalog.voice_details(item_id);

-- 11. CONNECTIVITY_DETAILS (1:1 — internet/data services)
CREATE TABLE catalog.connectivity_details (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id        UUID          NOT NULL UNIQUE REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    bandwidth_mbps DECIMAL(10,2) NOT NULL
);

CREATE INDEX idx_connectivity_details_item ON catalog.connectivity_details(item_id);

-- 12. DIGITAL_DETAILS (1:1 — digital/cloud services)
CREATE TABLE catalog.digital_details (
    id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id  UUID         NOT NULL UNIQUE REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL
);

CREATE INDEX idx_digital_details_item ON catalog.digital_details(item_id);

-- 13. ROAMING_DETAILS (1:1 — roaming packages)
CREATE TABLE catalog.roaming_details (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id       UUID    NOT NULL UNIQUE REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    geo_zone_id   UUID    NOT NULL REFERENCES catalog.geo_zones(id) ON DELETE RESTRICT,
    data_mb       INTEGER NOT NULL CHECK (data_mb > 0),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    has_throttle  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_roaming_details_item     ON catalog.roaming_details(item_id);
CREATE INDEX idx_roaming_details_geo_zone ON catalog.roaming_details(geo_zone_id);

-- 14. DEVICE_DETAILS (1:1 — device/equipment)
CREATE TABLE catalog.device_details (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id           UUID          NOT NULL UNIQUE REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    brand             VARCHAR(100)  NOT NULL,
    model             VARCHAR(100)  NOT NULL,
    storage_gb        INTEGER,
    financing_months  INTEGER       CHECK (financing_months > 0),
    financing_monthly DECIMAL(15,2) CHECK (financing_monthly >= 0)
);

CREATE INDEX idx_device_details_item ON catalog.device_details(item_id);

-- 15. ITEM_BENEFITS (M:1 — multiple benefits per catalog item)
CREATE TABLE catalog.item_benefits (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID         NOT NULL REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    benefit_type_id UUID         NOT NULL REFERENCES catalog.benefit_types(id) ON DELETE RESTRICT,
    name            VARCHAR(100) NOT NULL,
    description     VARCHAR(255),
    duration_days   INTEGER      CHECK (duration_days > 0),
    created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_item_benefits_item ON catalog.item_benefits(item_id);
CREATE INDEX idx_item_benefits_type ON catalog.item_benefits(benefit_type_id);

-- 16. AGE_CONDITIONS (1:1 per item — 3NF)
CREATE TABLE catalog.age_conditions (
    id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID    NOT NULL UNIQUE REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    min_age INTEGER NOT NULL CHECK (min_age >= 0),
    max_age INTEGER CHECK (max_age >= 0),

    CONSTRAINT chk_age_range CHECK (max_age IS NULL OR max_age >= min_age)
);

CREATE INDEX idx_age_conditions_item ON catalog.age_conditions(item_id);

-- 17. LEGAL_CONDITIONS (1:1 per item — 3NF)
CREATE TABLE catalog.legal_conditions (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id           UUID         NOT NULL UNIQUE REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    legal_requirement TEXT         NOT NULL,
    description       VARCHAR(255)
);

CREATE INDEX idx_legal_conditions_item ON catalog.legal_conditions(item_id);

-- 18. TEMPORAL_CONDITIONS (1:1 per item — 3NF)
CREATE TABLE catalog.temporal_conditions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL UNIQUE REFERENCES catalog.catalog_items(id) ON DELETE CASCADE,
    effective_date  DATE NOT NULL,
    expiration_date DATE,

    CONSTRAINT chk_temporal_range CHECK (expiration_date IS NULL OR expiration_date >= effective_date)
);

CREATE INDEX idx_temporal_conditions_item ON catalog.temporal_conditions(item_id);

-- 19. CONTENT_BLOCKS (CMS website content)
CREATE TABLE catalog.content_blocks (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    content_key     VARCHAR(100) NOT NULL,
    content_type_id UUID         NOT NULL REFERENCES catalog.content_types(id) ON DELETE RESTRICT,
    title           VARCHAR(200),
    body            TEXT,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    updated_by      UUID         REFERENCES app_auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_content_blocks_key ON catalog.content_blocks(content_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_blocks_type        ON catalog.content_blocks(content_type_id);
CREATE INDEX idx_content_blocks_updated_by  ON catalog.content_blocks(updated_by);

-- 20. CONTACT_REQUESTS (public site inquiries)
CREATE TABLE catalog.contact_requests (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id      UUID         REFERENCES catalog.catalog_items(id) ON DELETE SET NULL,
    client_name  VARCHAR(200) NOT NULL,
    client_email VARCHAR(150) NOT NULL,
    client_phone VARCHAR(20),
    message      TEXT,
    is_attended  BOOLEAN      NOT NULL DEFAULT FALSE,
    attended_at  TIMESTAMPTZ,
    attended_by  UUID         REFERENCES app_auth.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contact_requests_item     ON catalog.contact_requests(item_id);
CREATE INDEX idx_contact_requests_attended ON catalog.contact_requests(is_attended);
