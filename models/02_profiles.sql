-- =============================================
-- Phase 2: Profiles + Advisor–Supervisor
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schema: core
-- =============================================
-- 2 tables:
--   profiles, advisor_supervisors
-- =============================================

CREATE SCHEMA IF NOT EXISTS core;

-- 1. PROFILES (shared personal data — 1:1 with auth.users)
--    Single source of truth for employees, candidates, any user.
CREATE TABLE core.profiles (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
    first_name       VARCHAR(100) NOT NULL,
    second_name      VARCHAR(100),
    last_name        VARCHAR(100) NOT NULL,
    second_last_name VARCHAR(100),
    national_id      VARCHAR(20)  NOT NULL UNIQUE,
    phone            VARCHAR(20),
    avatar_url       VARCHAR(500),
    employee_code    VARCHAR(20)  UNIQUE,
    address          TEXT,
    created_at       TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_profiles_user        ON core.profiles(user_id);
CREATE INDEX idx_profiles_national_id ON core.profiles(national_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_employee    ON core.profiles(employee_code) WHERE employee_code IS NOT NULL AND deleted_at IS NULL;

-- 2. ADVISOR_SUPERVISORS (N:N — many supervisors can oversee many advisors)
CREATE TABLE core.advisor_supervisors (
    advisor_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    supervisor_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    assigned_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (advisor_id, supervisor_id),
    CONSTRAINT chk_no_self_supervision CHECK (advisor_id <> supervisor_id)
);

CREATE INDEX idx_advisor_supervisors_supervisor ON core.advisor_supervisors(supervisor_id);
