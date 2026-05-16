-- =============================================
-- Phase 7: Employability — Recruitment
-- PostgreSQL · UUID PKs · 3NF · Prisma-ready
-- Schema: employability
-- =============================================
-- 4 tables:
--   candidates, job_vacancies,
--   job_applications, candidate_resumes
-- =============================================

CREATE SCHEMA IF NOT EXISTS employability;

-- =============================================
-- ENTITY TABLES (4)
-- =============================================

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
