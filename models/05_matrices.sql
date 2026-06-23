-- =============================================
-- Phase 5: Offer Matrices — Document Containers
-- PostgreSQL · UUID PKs · 3NF
-- Schema: matrices
-- =============================================
-- 2 tables:
--   offer_matrices, matrix_attachments
-- =============================================

CREATE SCHEMA IF NOT EXISTS matrices;

-- =============================================
-- ENTITY TABLES (2)
-- =============================================

-- 1. OFFER_MATRICES (document container linked to negotiation)
CREATE TABLE matrices.offer_matrices (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id     UUID          NOT NULL REFERENCES crm.negotiations(id) ON DELETE CASCADE,
    creator_id         UUID          NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    observations       TEXT,
    created_at         TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    deleted_at         TIMESTAMPTZ
);

CREATE INDEX idx_offer_matrices_negotiation ON matrices.offer_matrices(negotiation_id);
CREATE INDEX idx_offer_matrices_creator     ON matrices.offer_matrices(creator_id);
CREATE INDEX idx_offer_matrices_created     ON matrices.offer_matrices(created_at) WHERE deleted_at IS NULL;

-- 2. MATRIX_ATTACHMENTS (1:N — Excel offer + email HTML)
CREATE TABLE matrices.matrix_attachments (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    matrix_id       UUID         NOT NULL REFERENCES matrices.offer_matrices(id) ON DELETE CASCADE,
    uploaded_by     UUID         NOT NULL REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    attachment_type VARCHAR(20)  NOT NULL,
    description     VARCHAR(255),
    filename        VARCHAR(255) NOT NULL,
    file_extension  VARCHAR(10)  NOT NULL,
    file_size_mb    DECIMAL(8,2) NOT NULL CHECK (file_size_mb > 0 AND file_size_mb <= 50),
    storage_path    VARCHAR(500) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matrix_attachments_matrix      ON matrices.matrix_attachments(matrix_id);
CREATE INDEX idx_matrix_attachments_uploaded_by ON matrices.matrix_attachments(uploaded_by);
