-- =============================================
-- Phase 8: Reports & Notifications
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schemas: reports, notifications
-- =============================================
-- 3 tables:
--   reports.sales_objectives, reports.report_exports,
--   notifications.notifications
-- =============================================

-- #############################################
-- SCHEMA A: REPORTS
-- #############################################

CREATE SCHEMA IF NOT EXISTS reports;

-- =============================================
-- ENTITY TABLES (2)
-- =============================================

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
-- SCHEMA B: NOTIFICATIONS
-- #############################################

CREATE SCHEMA IF NOT EXISTS notifications;

-- =============================================
-- ENTITY TABLES (1)
-- =============================================

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
