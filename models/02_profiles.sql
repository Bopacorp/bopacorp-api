-- =============================================
-- Phase 2: Profiles + Advisor–Supervisor
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schema: core
-- =============================================
-- 5 tables:
--   profiles, advisor_supervisors, departments, org_roles, employees
-- =============================================

CREATE SCHEMA IF NOT EXISTS core;

-- 1. PROFILES (shared personal data — 1:1 with app_auth.users)
--    Single source of truth for employees, candidates, any user.
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
    advisor_id    UUID        NOT NULL REFERENCES core.employees(user_id) ON DELETE RESTRICT,
    supervisor_id UUID        NOT NULL REFERENCES core.employees(user_id) ON DELETE RESTRICT,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    assigned_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (advisor_id, supervisor_id),
    CONSTRAINT chk_no_self_supervision CHECK (advisor_id <> supervisor_id)
);

CREATE INDEX idx_advisor_supervisors_supervisor ON core.advisor_supervisors(supervisor_id);

-- 3. DEPARTMENTS (organizational department catalog)
CREATE TABLE core.departments (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 4. ORG_ROLES (HR-managed organizational role catalog — dynamic, no enums)
CREATE TABLE core.org_roles (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(50)  NOT NULL UNIQUE,
    name           VARCHAR(100) NOT NULL,
    department_id  UUID         REFERENCES core.departments(id),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_org_roles_department ON core.org_roles(department_id);

-- 5. EMPLOYEES (links users to organizational roles — one per user)
CREATE TABLE core.employees (
    user_id      UUID        PRIMARY KEY REFERENCES app_auth.users(id) ON DELETE RESTRICT,
    org_role_id  UUID        NOT NULL REFERENCES core.org_roles(id),
    territory    VARCHAR(100),
    hired_at     DATE,
    is_active    BOOLEAN     DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMPTZ
);

CREATE INDEX idx_employees_org_role ON core.employees(org_role_id);
CREATE INDEX idx_employees_active   ON core.employees(is_active) WHERE deleted_at IS NULL;
