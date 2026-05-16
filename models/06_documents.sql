-- =============================================
-- Phase 6: Document Management
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schema: documents
-- =============================================
-- 3 tables:
--   document_types, negotiation_documents,
--   document_state_history
-- =============================================

CREATE SCHEMA IF NOT EXISTS documents;

-- =============================================
-- LOOKUP TABLES (1)
-- =============================================

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

-- =============================================
-- ENTITY TABLES (2)
-- =============================================

-- 2. NEGOTIATION_DOCUMENTS (file uploads with approval workflow)
CREATE TABLE documents.negotiation_documents (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id      UUID         NOT NULL REFERENCES crm.negotiations(id) ON DELETE CASCADE,
    document_type_id    UUID         NOT NULL REFERENCES documents.document_types(id) ON DELETE RESTRICT,
    uploaded_by         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reviewed_by         UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
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
    changed_by     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doc_state_history_document ON documents.document_state_history(document_id);
CREATE INDEX idx_doc_state_history_new      ON documents.document_state_history(new_state);
CREATE INDEX idx_doc_state_history_changed  ON documents.document_state_history(changed_by);
CREATE INDEX idx_doc_state_history_created  ON documents.document_state_history(created_at);
