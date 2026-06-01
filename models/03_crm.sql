-- =============================================
-- Phase 3: CRM — Client Management + Sales Pipeline
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schema: crm
-- =============================================
-- 6 tables:
--   negotiation_states, visit_types,
--   business_clients, negotiations,
--   negotiation_state_history, visits
-- =============================================

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
    advisor_id               UUID          REFERENCES core.employees(user_id) ON DELETE SET NULL,
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
    advisor_id           UUID        NOT NULL REFERENCES core.employees(user_id) ON DELETE RESTRICT,
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
    advisor_id         UUID           NOT NULL REFERENCES core.employees(user_id) ON DELETE RESTRICT,
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
