-- =============================================
-- Phase 1: Auth + RBAC
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schema: auth
-- =============================================
-- 9 tables:
--   modules, permissions, roles, role_permissions,
--   users, user_roles, auth_tokens, login_logs, audit_logs
-- =============================================

CREATE SCHEMA IF NOT EXISTS auth;

-- 1. MODULES (hierarchical — self-referencing parent)
CREATE TABLE auth.modules (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID         REFERENCES auth.modules(id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(255),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 2. PERMISSIONS (typed, per module)
CREATE TABLE auth.permissions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id   UUID         NOT NULL REFERENCES auth.modules(id) ON DELETE CASCADE,
    code        VARCHAR(150) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    type        VARCHAR(20)  NOT NULL DEFAULT 'crud'
                             CHECK (type IN ('crud', 'action', 'report', 'view', 'approval')),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_module ON auth.permissions(module_id);
CREATE INDEX idx_permissions_type   ON auth.permissions(type);

-- 3. ROLES
CREATE TABLE auth.roles (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- 4. ROLE_PERMISSIONS (N:N with grant/deny flag)
CREATE TABLE auth.role_permissions (
    role_id       UUID    NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
    permission_id UUID    NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
    is_granted    BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_permission ON auth.role_permissions(permission_id);

-- 5. USERS (auth only — no profile data, that goes in core.profiles)
CREATE TABLE auth.users (
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

CREATE INDEX idx_users_email    ON auth.users(email)    WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON auth.users(username)  WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active   ON auth.users(is_active) WHERE deleted_at IS NULL;

-- 6. USER_ROLES (N:N — users can hold multiple roles)
CREATE TABLE auth.user_roles (
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    role_id     UUID        NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_role ON auth.user_roles(role_id);

-- 7. AUTH_TOKENS (refresh, password_reset, email_verify)
CREATE TABLE auth.auth_tokens (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    token      VARCHAR(500) NOT NULL UNIQUE,
    type       VARCHAR(50)  NOT NULL CHECK (type IN ('refresh', 'password_reset', 'email_verify')),
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auth_tokens_user_type ON auth.auth_tokens(user_id, type);
CREATE INDEX idx_auth_tokens_expires ON auth.auth_tokens(expires_at);

-- 8. LOGIN_LOGS
CREATE TABLE auth.login_logs (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status     VARCHAR(20)  NOT NULL CHECK (status IN ('success', 'failed', 'locked')),
    created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_logs_user    ON auth.login_logs(user_id);
CREATE INDEX idx_login_logs_created ON auth.login_logs(created_at);

-- 9. AUDIT_LOGS (generic JSONB trail for any table)
CREATE TABLE auth.audit_logs (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id  UUID         NOT NULL,
    operation  CHAR(1)      NOT NULL CHECK (operation IN ('I', 'U', 'D')),
    old_data   JSONB,
    new_data   JSONB,
    user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes      TEXT,
    created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_table   ON auth.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record  ON auth.audit_logs(record_id);
CREATE INDEX idx_audit_logs_user    ON auth.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON auth.audit_logs(created_at);
