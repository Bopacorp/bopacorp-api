-- =============================================
-- Phase 5: Offer Matrices — Commercial Proposals
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schema: matrices
-- =============================================
-- 4 tables:
--   offer_matrices, matrix_line_items,
--   matrix_attachments, matrix_state_history
-- =============================================

CREATE SCHEMA IF NOT EXISTS matrices;

-- =============================================
-- ENTITY TABLES (4)
-- =============================================

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
