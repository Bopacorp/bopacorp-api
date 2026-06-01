-- =============================================
-- BOPADIGITAL — Consolidated Database Schema
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- 9 schemas · 51 tables
-- =============================================
-- app_auth      (9)  — authentication, RBAC, audit
-- core          (2)  — profiles, org hierarchy
-- crm           (6)  — clients, negotiations, visits
-- catalog       (20) — service catalog, CMS, conditions
-- matrices      (4)  — offer matrices, approvals
-- documents     (3)  — document management, approvals
-- employability (4)  — recruitment, vacancies, candidates
-- reports       (2)  — sales objectives, report exports
-- notifications (1)  — in-app notifications
-- =============================================


-- #############################################
-- SCHEMA 1: APP_AUTH (9 tables)
-- #############################################

CREATE SCHEMA IF NOT EXISTS app_auth;

-- 1. MODULES (hierarchical — self-referencing parent)
CREATE TABLE app_auth.modules (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID         REFERENCES app_auth.modules(id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(255),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 2. PERMISSIONS (typed, per module)
CREATE TABLE app_auth.permissions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id   UUID         NOT NULL REFERENCES app_auth.modules(id) ON DELETE CASCADE,
    code        VARCHAR(150) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    type        VARCHAR(20)  NOT NULL DEFAULT 'crud'
                             CHECK (type IN ('crud', 'action', 'report', 'view', 'approval')),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_module ON app_auth.permissions(module_id);
CREATE INDEX idx_permissions_type   ON app_auth.permissions(type);

-- 3. ROLES
CREATE TABLE app_auth.roles (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 4. ROLE_PERMISSIONS (N:N with grant/deny flag)
CREATE TABLE app_auth.role_permissions (
    role_id       UUID    NOT NULL REFERENCES app_auth.roles(id) ON DELETE CASCADE,
    permission_id UUID    NOT NULL REFERENCES app_auth.permissions(id) ON DELETE CASCADE,
    is_granted    BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_permission ON app_auth.role_permissions(permission_id);

-- 5. USERS (app_auth only — no profile data, that goes in core.profiles)
CREATE TABLE app_auth.users (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username              VARCHAR(50)  NOT NULL UNIQUE,
    email                 VARCHAR(150) NOT NULL UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at         TIMESTAMPTZ,
    failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_users_email    ON app_auth.users(email)    WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON app_auth.users(username)  WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active   ON app_auth.users(is_active) WHERE deleted_at IS NULL;

-- 6. USER_ROLES (N:N — users can hold multiple roles)
CREATE TABLE app_auth.user_roles (
    user_id     UUID        NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    role_id     UUID        NOT NULL REFERENCES app_auth.roles(id) ON DELETE CASCADE,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_role ON app_auth.user_roles(role_id);

-- 7. AUTH_TOKENS (refresh, password_reset, email_verify)
CREATE TABLE app_auth.auth_tokens (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    token      VARCHAR(500) NOT NULL UNIQUE,
    type       VARCHAR(50)  NOT NULL CHECK (type IN ('refresh', 'password_reset', 'email_verify')),
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auth_tokens_user_type ON app_auth.auth_tokens(user_id, type);
CREATE INDEX idx_auth_tokens_expires ON app_auth.auth_tokens(expires_at);

-- 8. LOGIN_LOGS
CREATE TABLE app_auth.login_logs (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status     VARCHAR(20)  NOT NULL CHECK (status IN ('success', 'failed', 'locked')),
    created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_logs_user    ON app_auth.login_logs(user_id);
CREATE INDEX idx_login_logs_created ON app_auth.login_logs(created_at);

-- 9. AUDIT_LOGS (generic JSONB trail for any table)
CREATE TABLE app_auth.audit_logs (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id  UUID         NOT NULL,
    operation  CHAR(1)      NOT NULL CHECK (operation IN ('I', 'U', 'D')),
    old_data   JSONB,
    new_data   JSONB,
    user_id    UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes      TEXT,
    created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_table   ON app_auth.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record  ON app_auth.audit_logs(record_id);
CREATE INDEX idx_audit_logs_user    ON app_auth.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON app_auth.audit_logs(created_at);


-- #############################################
-- SCHEMA 2: CORE (2 tables)
-- #############################################

CREATE SCHEMA IF NOT EXISTS core;

-- 1. PROFILES (shared personal data — 1:1 with app_auth.users)
CREATE TABLE core.profiles (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL UNIQUE REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    first_name       VARCHAR(100) NOT NULL,
    second_name      VARCHAR(100),
    last_name        VARCHAR(100) NOT NULL,
    second_last_name VARCHAR(100),
    national_id      VARCHAR(20)  NOT NULL UNIQUE,
    phone            VARCHAR(20),
    avatar_url       VARCHAR(500),
    address          TEXT,
    created_at       TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_profiles_user        ON core.profiles(user_id);
CREATE INDEX idx_profiles_national_id ON core.profiles(national_id) WHERE deleted_at IS NULL;

-- 2. ADVISOR_SUPERVISORS (N:N — many supervisors can oversee many advisors)
CREATE TABLE core.advisor_supervisors (
    advisor_id    UUID        NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    supervisor_id UUID        NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    assigned_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (advisor_id, supervisor_id),
    CONSTRAINT chk_no_self_supervision CHECK (advisor_id <> supervisor_id)
);

CREATE INDEX idx_advisor_supervisors_supervisor ON core.advisor_supervisors(supervisor_id);


-- #############################################
-- SCHEMA 3: CRM (6 tables)
-- #############################################

CREATE SCHEMA IF NOT EXISTS crm;

-- 1. NEGOTIATION_STATES (lookup table)
CREATE TABLE crm.negotiation_states (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 2. VISIT_TYPES (lookup table)
CREATE TABLE crm.visit_types (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 3. BUSINESS_CLIENTS (B2B prospects + active clients)
CREATE TABLE crm.business_clients (
    id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id               UUID          REFERENCES app_auth.users(id) ON DELETE SET NULL,
    ruc                      VARCHAR(13)   NOT NULL UNIQUE
                                           CONSTRAINT chk_ruc_format CHECK (char_length(ruc) = 13 AND ruc ~ '^[0-9]+$'),
    business_name            VARCHAR(200)  NOT NULL,
    contact_name             VARCHAR(200)  NOT NULL,
    contact_phone            VARCHAR(20),
    contact_email            VARCHAR(150),
    address                  TEXT,
    active_services_count    INTEGER       NOT NULL DEFAULT 0 CHECK (active_services_count >= 0),
    current_monthly_billing  DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (current_monthly_billing >= 0),
    is_active                BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    deleted_at               TIMESTAMPTZ
);

CREATE INDEX idx_business_clients_advisor ON crm.business_clients(advisor_id);
CREATE INDEX idx_business_clients_ruc     ON crm.business_clients(ruc) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_clients_active  ON crm.business_clients(is_active) WHERE deleted_at IS NULL;

-- 4. NEGOTIATIONS (sales pipeline — state machine)
CREATE TABLE crm.negotiations (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id            UUID        NOT NULL REFERENCES crm.business_clients(id) ON DELETE CASCADE,
    advisor_id           UUID        NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    state_id             UUID        NOT NULL REFERENCES crm.negotiation_states(id) ON DELETE RESTRICT,
    start_date           DATE        NOT NULL DEFAULT CURRENT_DATE,
    estimated_close_date DATE,
    observations         TEXT,
    is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at           TIMESTAMPTZ,

    CONSTRAINT chk_negotiation_dates CHECK (estimated_close_date IS NULL OR estimated_close_date >= start_date)
);

CREATE INDEX idx_negotiations_client  ON crm.negotiations(client_id);
CREATE INDEX idx_negotiations_advisor ON crm.negotiations(advisor_id);
CREATE INDEX idx_negotiations_state   ON crm.negotiations(state_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_negotiations_active  ON crm.negotiations(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_negotiations_dates   ON crm.negotiations(start_date, estimated_close_date);

-- 5. NEGOTIATION_STATE_HISTORY (append-only audit trail)
CREATE TABLE crm.negotiation_state_history (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id    UUID        NOT NULL REFERENCES crm.negotiations(id) ON DELETE CASCADE,
    previous_state_id UUID        REFERENCES crm.negotiation_states(id) ON DELETE RESTRICT,
    new_state_id      UUID        NOT NULL REFERENCES crm.negotiation_states(id) ON DELETE RESTRICT,
    changed_by        UUID        NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_neg_state_history_negotiation ON crm.negotiation_state_history(negotiation_id);
CREATE INDEX idx_neg_state_history_prev_state  ON crm.negotiation_state_history(previous_state_id);
CREATE INDEX idx_neg_state_history_new_state   ON crm.negotiation_state_history(new_state_id);
CREATE INDEX idx_neg_state_history_created     ON crm.negotiation_state_history(created_at);
CREATE INDEX idx_neg_state_history_changed_by  ON crm.negotiation_state_history(changed_by);

-- 6. VISITS (field visits with GPS check-in)
CREATE TABLE crm.visits (
    id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id     UUID           REFERENCES crm.negotiations(id) ON DELETE SET NULL,
    client_id          UUID           NOT NULL REFERENCES crm.business_clients(id) ON DELETE CASCADE,
    advisor_id         UUID           NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    verified_by        UUID           REFERENCES app_auth.users(id) ON DELETE SET NULL,
    visit_type_id      UUID           NOT NULL REFERENCES crm.visit_types(id) ON DELETE RESTRICT,
    visit_date         TIMESTAMPTZ    NOT NULL,
    observations       TEXT,
    is_verified        BOOLEAN        NOT NULL DEFAULT FALSE,
    supervisor_comment TEXT,
    gps_latitude       DECIMAL(10,7),
    gps_longitude      DECIMAL(10,7),
    gps_accuracy       DECIMAL(8,2),
    gps_timestamp      TIMESTAMPTZ,
    created_at         TIMESTAMPTZ    DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ    DEFAULT CURRENT_TIMESTAMP,
    deleted_at         TIMESTAMPTZ
);

CREATE INDEX idx_visits_negotiation ON crm.visits(negotiation_id);
CREATE INDEX idx_visits_client      ON crm.visits(client_id);
CREATE INDEX idx_visits_advisor     ON crm.visits(advisor_id);
CREATE INDEX idx_visits_verified_by ON crm.visits(verified_by);
CREATE INDEX idx_visits_visit_type  ON crm.visits(visit_type_id);
CREATE INDEX idx_visits_date        ON crm.visits(visit_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_visits_verified    ON crm.visits(is_verified) WHERE deleted_at IS NULL;


-- #############################################
-- SCHEMA 4: CATALOG (20 tables)
-- #############################################

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


-- #############################################
-- SCHEMA 5: MATRICES (4 tables)
-- #############################################

CREATE SCHEMA IF NOT EXISTS matrices;

-- 1. OFFER_MATRICES (core proposal entity — state machine)
CREATE TABLE matrices.offer_matrices (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id     UUID          NOT NULL REFERENCES crm.negotiations(id) ON DELETE CASCADE,
    creator_id         UUID          NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    approved_by        UUID          REFERENCES app_auth.users(id) ON DELETE SET NULL,
    state              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
                                     CHECK (state IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    observations       TEXT,
    total_amount       DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    calculated_subsidy DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (calculated_subsidy >= 0),
    subsidy_strategy   VARCHAR(50)   NOT NULL DEFAULT 'STANDARD',
    approval_date      TIMESTAMPTZ,
    supervisor_message TEXT,
    created_at         TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    deleted_at         TIMESTAMPTZ
);

CREATE INDEX idx_offer_matrices_negotiation ON matrices.offer_matrices(negotiation_id);
CREATE INDEX idx_offer_matrices_creator     ON matrices.offer_matrices(creator_id);
CREATE INDEX idx_offer_matrices_approved_by ON matrices.offer_matrices(approved_by);
CREATE INDEX idx_offer_matrices_state       ON matrices.offer_matrices(state) WHERE deleted_at IS NULL;
CREATE INDEX idx_offer_matrices_created     ON matrices.offer_matrices(created_at) WHERE deleted_at IS NULL;

-- 2. MATRIX_LINE_ITEMS (1:N — catalog products with qty/price)
CREATE TABLE matrices.matrix_line_items (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    matrix_id  UUID          NOT NULL REFERENCES matrices.offer_matrices(id) ON DELETE CASCADE,
    item_id    UUID          NOT NULL REFERENCES catalog.catalog_items(id) ON DELETE RESTRICT,
    quantity   INTEGER       NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
    total      DECIMAL(15,2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_line_item_per_matrix UNIQUE (matrix_id, item_id)
);

CREATE INDEX idx_matrix_line_items_matrix ON matrices.matrix_line_items(matrix_id);
CREATE INDEX idx_matrix_line_items_item   ON matrices.matrix_line_items(item_id);

-- 3. MATRIX_ATTACHMENTS (1:N — supporting documents)
CREATE TABLE matrices.matrix_attachments (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    matrix_id      UUID         NOT NULL REFERENCES matrices.offer_matrices(id) ON DELETE CASCADE,
    uploaded_by    UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    description    VARCHAR(255),
    filename       VARCHAR(255) NOT NULL,
    file_extension VARCHAR(10)  NOT NULL,
    file_size_mb   DECIMAL(8,2) NOT NULL CHECK (file_size_mb > 0 AND file_size_mb <= 50),
    storage_path   VARCHAR(500) NOT NULL,
    mime_type      VARCHAR(100) NOT NULL,
    uploaded_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matrix_attachments_matrix      ON matrices.matrix_attachments(matrix_id);
CREATE INDEX idx_matrix_attachments_uploaded_by ON matrices.matrix_attachments(uploaded_by);

-- 4. MATRIX_STATE_HISTORY (append-only audit trail)
CREATE TABLE matrices.matrix_state_history (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    matrix_id      UUID        NOT NULL REFERENCES matrices.offer_matrices(id) ON DELETE CASCADE,
    previous_state VARCHAR(20) CHECK (previous_state IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    new_state      VARCHAR(20) NOT NULL CHECK (new_state IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    changed_by     UUID        NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matrix_state_history_matrix  ON matrices.matrix_state_history(matrix_id);
CREATE INDEX idx_matrix_state_history_new     ON matrices.matrix_state_history(new_state);
CREATE INDEX idx_matrix_state_history_changed ON matrices.matrix_state_history(changed_by);
CREATE INDEX idx_matrix_state_history_created ON matrices.matrix_state_history(created_at);


-- #############################################
-- SCHEMA 6: DOCUMENTS (3 tables)
-- #############################################

CREATE SCHEMA IF NOT EXISTS documents;

-- 1. DOCUMENT_TYPES (coordinator-configurable)
CREATE TABLE documents.document_types (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(30)  NOT NULL UNIQUE,
    name         VARCHAR(100) NOT NULL,
    description  VARCHAR(255),
    is_mandatory BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 2. NEGOTIATION_DOCUMENTS (file uploads with approval workflow)
CREATE TABLE documents.negotiation_documents (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id      UUID         NOT NULL REFERENCES crm.negotiations(id) ON DELETE CASCADE,
    document_type_id    UUID         NOT NULL REFERENCES documents.document_types(id) ON DELETE RESTRICT,
    uploaded_by         UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    reviewed_by         UUID         REFERENCES app_auth.users(id) ON DELETE SET NULL,
    state               VARCHAR(20)  NOT NULL DEFAULT 'PENDING_APPROVAL'
                                     CHECK (state IN ('PENDING_APPROVAL', 'ACCEPTED', 'REJECTED')),
    filename            VARCHAR(255) NOT NULL,
    file_extension      VARCHAR(10)  NOT NULL,
    file_size_mb        DECIMAL(8,2) NOT NULL CHECK (file_size_mb > 0 AND file_size_mb <= 50),
    storage_path        VARCHAR(500) NOT NULL,
    mime_type           VARCHAR(100) NOT NULL,
    review_date         TIMESTAMPTZ,
    coordinator_message TEXT,
    uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_negotiation_docs_negotiation ON documents.negotiation_documents(negotiation_id);
CREATE INDEX idx_negotiation_docs_type        ON documents.negotiation_documents(document_type_id);
CREATE INDEX idx_negotiation_docs_uploaded_by ON documents.negotiation_documents(uploaded_by);
CREATE INDEX idx_negotiation_docs_reviewed_by ON documents.negotiation_documents(reviewed_by);
CREATE INDEX idx_negotiation_docs_state       ON documents.negotiation_documents(state) WHERE deleted_at IS NULL;

-- 3. DOCUMENT_STATE_HISTORY (append-only audit trail)
CREATE TABLE documents.document_state_history (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID        NOT NULL REFERENCES documents.negotiation_documents(id) ON DELETE CASCADE,
    previous_state VARCHAR(20) CHECK (previous_state IN ('PENDING_APPROVAL', 'ACCEPTED', 'REJECTED')),
    new_state      VARCHAR(20) NOT NULL CHECK (new_state IN ('PENDING_APPROVAL', 'ACCEPTED', 'REJECTED')),
    changed_by     UUID        NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doc_state_history_document ON documents.document_state_history(document_id);
CREATE INDEX idx_doc_state_history_new      ON documents.document_state_history(new_state);
CREATE INDEX idx_doc_state_history_changed  ON documents.document_state_history(changed_by);
CREATE INDEX idx_doc_state_history_created  ON documents.document_state_history(created_at);


-- #############################################
-- SCHEMA 7: EMPLOYABILITY (4 tables)
-- #############################################

CREATE SCHEMA IF NOT EXISTS employability;

-- 1. CANDIDATES (external applicants — not linked to app_auth.users)
CREATE TABLE employability.candidates (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    national_id VARCHAR(20)  NOT NULL UNIQUE,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    phone       VARCHAR(20),
    address     TEXT,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidates_email      ON employability.candidates(email);
CREATE INDEX idx_candidates_national_id ON employability.candidates(national_id);

-- 2. JOB_VACANCIES (public job postings)
CREATE TABLE employability.job_vacancies (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by       UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    title            VARCHAR(255) NOT NULL,
    description      TEXT         NOT NULL,
    requirements     TEXT         NOT NULL,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    is_published     BOOLEAN      NOT NULL DEFAULT FALSE,
    publication_date TIMESTAMPTZ,
    closing_date     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    deleted_at       TIMESTAMPTZ,

    CONSTRAINT chk_vacancy_dates CHECK (closing_date IS NULL OR publication_date IS NULL OR closing_date >= publication_date)
);

CREATE INDEX idx_job_vacancies_created_by ON employability.job_vacancies(created_by);
CREATE INDEX idx_job_vacancies_published  ON employability.job_vacancies(is_published) WHERE deleted_at IS NULL;
CREATE INDEX idx_job_vacancies_active     ON employability.job_vacancies(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_job_vacancies_closing    ON employability.job_vacancies(closing_date) WHERE deleted_at IS NULL;

-- 3. JOB_APPLICATIONS (candidate ↔ vacancy with evaluation)
CREATE TABLE employability.job_applications (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vacancy_id   UUID        NOT NULL REFERENCES employability.job_vacancies(id) ON DELETE CASCADE,
    candidate_id UUID        NOT NULL REFERENCES employability.candidates(id) ON DELETE CASCADE,
    reviewed_by  UUID        REFERENCES app_auth.users(id) ON DELETE SET NULL,
    state        VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                             CHECK (state IN ('DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED')),
    cover_letter TEXT,
    review_notes TEXT,
    review_date  TIMESTAMPTZ,
    applied_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMPTZ,

    CONSTRAINT uq_application_per_vacancy UNIQUE (vacancy_id, candidate_id)
);

CREATE INDEX idx_job_applications_vacancy   ON employability.job_applications(vacancy_id);
CREATE INDEX idx_job_applications_candidate ON employability.job_applications(candidate_id);
CREATE INDEX idx_job_applications_reviewed  ON employability.job_applications(reviewed_by);
CREATE INDEX idx_job_applications_state     ON employability.job_applications(state) WHERE deleted_at IS NULL;

-- 4. CANDIDATE_RESUMES (file metadata — 1:N per candidate)
CREATE TABLE employability.candidate_resumes (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id   UUID         NOT NULL REFERENCES employability.candidates(id) ON DELETE CASCADE,
    application_id UUID         REFERENCES employability.job_applications(id) ON DELETE SET NULL,
    filename       VARCHAR(255) NOT NULL,
    file_extension VARCHAR(10)  NOT NULL,
    file_size_mb   DECIMAL(8,2) NOT NULL CHECK (file_size_mb > 0 AND file_size_mb <= 50),
    storage_path   VARCHAR(500) NOT NULL,
    mime_type      VARCHAR(100) NOT NULL,
    uploaded_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_candidate_resumes_candidate   ON employability.candidate_resumes(candidate_id);
CREATE INDEX idx_candidate_resumes_application ON employability.candidate_resumes(application_id);


-- #############################################
-- SCHEMA 8: REPORTS (2 tables)
-- #############################################

CREATE SCHEMA IF NOT EXISTS reports;

-- 1. SALES_OBJECTIVES (period-based sales targets set by managers)
CREATE TABLE reports.sales_objectives (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by          UUID          NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    advisor_id          UUID          REFERENCES app_auth.users(id) ON DELETE SET NULL,
    target_sales_amount DECIMAL(15,2) NOT NULL CHECK (target_sales_amount >= 0),
    target_closed_deals INTEGER       NOT NULL CHECK (target_closed_deals >= 0),
    period_start        DATE          NOT NULL,
    period_end          DATE          NOT NULL,
    created_at          TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_objective_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_sales_objectives_created_by ON reports.sales_objectives(created_by);
CREATE INDEX idx_sales_objectives_advisor    ON reports.sales_objectives(advisor_id);
CREATE INDEX idx_sales_objectives_period     ON reports.sales_objectives(period_start, period_end);

-- 2. REPORT_EXPORTS (file metadata for generated PDF/Excel reports)
CREATE TABLE reports.report_exports (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    generated_by   UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    report_type    VARCHAR(30)  NOT NULL
                                CHECK (report_type IN ('COMMERCIAL_PERFORMANCE', 'OPERATIONAL', 'ADVISOR_DASHBOARD')),
    title          VARCHAR(255) NOT NULL,
    filename       VARCHAR(255) NOT NULL,
    file_extension VARCHAR(10)  NOT NULL,
    file_size_mb   DECIMAL(8,2) NOT NULL CHECK (file_size_mb > 0 AND file_size_mb <= 50),
    storage_path   VARCHAR(500) NOT NULL,
    mime_type      VARCHAR(100) NOT NULL,
    generated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_report_exports_generated_by ON reports.report_exports(generated_by);
CREATE INDEX idx_report_exports_type         ON reports.report_exports(report_type);
CREATE INDEX idx_report_exports_generated_at ON reports.report_exports(generated_at);


-- #############################################
-- SCHEMA 9: NOTIFICATIONS (1 table)
-- #############################################

CREATE SCHEMA IF NOT EXISTS notifications;

-- 3. NOTIFICATIONS (in-app notification records with read tracking)
CREATE TABLE notifications.notifications (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id   UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    title          VARCHAR(200) NOT NULL,
    message        TEXT         NOT NULL,
    reference_type VARCHAR(50),
    reference_id   UUID,
    is_read        BOOLEAN      NOT NULL DEFAULT FALSE,
    read_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient ON notifications.notifications(recipient_id);
CREATE INDEX idx_notifications_unread    ON notifications.notifications(recipient_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_ref       ON notifications.notifications(reference_type, reference_id);
CREATE INDEX idx_notifications_created   ON notifications.notifications(created_at);
