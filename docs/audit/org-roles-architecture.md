# Audit Report — Organizational Role Architecture

**Scope:** `src/db/schema/core.ts`, `src/db/schema/auth.ts`, `src/modules/users/`, `models/02_profiles.sql`, `models/03_crm.sql`
**Date:** 2026-05-31
**Auditor:** AI Architecture Review
**Status:** Open — requires schema decision before CRM module implementation

---

## Summary

The current architecture has no dedicated catalog for organizational roles (advisor, supervisor, manager). The `app_auth.roles` table is implicitly serving double duty as both an **authorization layer** (permissions) and an **organizational identity layer** (job titles). This creates coupling that will block the CRM module and future reporting features.

The `core.advisor_supervisors` table proves the system already recognizes "advisor" and "supervisor" as real business identities — but they are stored as relational pairs with no canonical catalog. If BOPACORP adds a new position (e.g., `territory_coordinator`), there is no place to register it without touching the authorization system.

---

## Critical

### 1. RBAC roles are overloaded as organizational identity

**Current state:**
- `app_auth.roles` stores role definitions (`slug`, `name`, `description`)
- `app_auth.user_roles` links users to roles
- `app_auth.role_permissions` links roles to permissions

**Finding:**
The `roles` table is designed for **authorization bundles** — groups of permissions that can be assigned to users. But the codebase already treats role slugs like `advisor` and `supervisor` as organizational identities:

- `models/03_crm.sql` has `advisor_id` on `business_clients`, `negotiations`, `visits`
- `models/08_reports_notifications.sql` has `advisor_id` on `sales_objectives`
- `core.advisor_supervisors` captures a directed graph between advisors and supervisors

These tables need to answer: **"Who are all the advisors?"** That query currently requires joining `users → user_roles → roles WHERE slug = 'advisor'`. This is indirect, slow, and conflates "has advisor permissions" with "is an advisor in the org chart."

**Risk:** A user with the `advisor` role for permissions but who is actually a back-office employee will appear in CRM advisor lists. A supervisor on leave whose role is revoked will disappear from the org chart even if they still have active advisor assignments.

**Fix:** Separate organizational identity from authorization. Create a `core.org_roles` catalog and a `core.employees` junction table.

---

### 2. No catalog table for dynamic organizational roles

**Current state:**
Organizational roles are either:
1. Implied by `app_auth.roles.slug` values, or
2. Hardcoded in the `advisor_supervisors` table name

**Finding:**
If BOPACORP creates a new position (e.g., `territory_coordinator` or `junior_advisor`), there is no place to register it. Adding it to `app_auth.roles` forces a decision about permissions at the same time. Adding it as a value somewhere else requires schema changes or application-level string lists.

The schema uses `pgEnum` for permission types (`crud`, `action`, `report`, `view`, `approval`) and token types — which is correct for closed sets. But organizational roles are **open sets** that HR should manage without touching the database schema.

**Risk:** Role proliferation in `app_auth.roles` as HR creates variations (`advisor`, `senior_advisor`, `advisor_temp`, `advisor_readonly`) just to model job titles with different permissions.

**Fix:** A `core.org_roles` table with `code`, `name`, `department`, `level`, and `isActive` — no enums, no hardcoded lists.

---

### 3. `core.advisor_supervisors` lacks role validation

**Current state:**
```sql
CREATE TABLE core.advisor_supervisors (
    advisor_id    UUID NOT NULL REFERENCES app_auth.users(id),
    supervisor_id UUID NOT NULL REFERENCES app_auth.users(id),
    ...
);
```

**Finding:**
Both sides reference `users.id` directly. There is no validation that `advisor_id` is actually an advisor or that `supervisor_id` is actually a supervisor. The application must enforce this, but without a canonical org role catalog, it has nothing to validate against.

**Risk:** Data integrity issues. A back-office user could be assigned as an advisor's supervisor. A manager could be inserted into the advisor side.

**Fix:** Add `core.employees(user_id, org_role_id)` and validate assignments against it:
```sql
-- advisor_id user must have org_role.code = 'advisor'
-- supervisor_id user must have org_role.code = 'supervisor'
```

---

## High

### 4. CRM modules will duplicate "who is an advisor?" logic

**Current state:**
`models/03_crm.sql` has `advisor_id` on multiple tables.

**Finding:**
When the CRM module is built, every query that needs "all active advisors" will need to either:
1. JOIN through `user_roles → roles WHERE slug = 'advisor'`, or
2. Maintain its own implicit list

Neither is maintainable. The CRM should be able to query `core.employees WHERE org_role.code = 'advisor'` directly.

**Fix:** Build `core.org_roles` + `core.employees` before CRM module APIs are implemented.

---

### 5. One user cannot have multiple organizational hats

**Current state:**
A user has one set of `user_roles` (RBAC) and zero or one entries in `advisor_supervisors`.

**Finding:**
With RBAC-only identity, if Alice is a `supervisor` but also needs temporary `advisor` permissions for a project, she must have both roles in `user_roles`. But then she appears in both "list all advisors" and "list all supervisors" queries — even if her actual job is only supervisor.

**Risk:** Org chart and commission calculations become unreliable. Permission flexibility comes at the cost of identity clarity.

**Fix:** Decouple:
- **Org identity:** Alice is `org_role = 'supervisor'` (one truth, managed by HR)
- **Permissions:** Alice has RBAC roles `['crm_read', 'crm_write', 'reports_view']` (many, managed by admin)

---

## Medium

### 6. `core.profiles` has `employee_code` but no role context

**Current state:**
`core.profiles.employee_code` is a unique identifier for employees.

**Finding:**
The profile stores personal data (name, cedula, phone) and an employee code, but has no link to organizational role. This means "employee-ness" is partially modeled (by the presence of `employee_code`) but not formally.

**Fix:** `core.employees` should link to `core.profiles.user_id` (or `app_auth.users.id`) and carry the `org_role_id`. `employee_code` could move to `employees` if it is truly an employment attribute rather than a personal one.

---

## Recommendations Summary

| Priority | Action | Effort |
|----------|--------|--------|
| **Before CRM** | Create `core.org_roles` catalog table (`code`, `name`, `department`, `level`, `isActive`) | Low |
| **Before CRM** | Create `core.employees` junction table (`user_id`, `org_role_id`, `territory`, `hired_at`, `is_active`) | Low |
| **Before CRM** | Update `core.advisor_supervisors` validation to check `employees.org_role_id` | Low |
| **Next** | Update `profiles` module APIs (when built) to return `org_role` alongside profile data | Low |
| **Later** | Add `org_roles` admin endpoints (CRUD for HR-managed job titles) | Medium |
| **Later** | Refactor CRM schema to reference `core.employees(user_id)` instead of raw `users(id)` where appropriate | Medium |

---

## Proposed Schema

```sql
-- Organizational role catalog (HR-managed, dynamic, no enums)
CREATE TABLE core.org_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50)  NOT NULL UNIQUE,  -- 'advisor', 'supervisor', 'manager'
    name        VARCHAR(100) NOT NULL,          -- 'Asesor Comercial'
    department  VARCHAR(100),
    level       INTEGER,                       -- 1=director, 2=manager, 3=supervisor, 4=advisor
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Employee identity (one per user, links org role to user)
CREATE TABLE core.employees (
    user_id      UUID PRIMARY KEY REFERENCES app_auth.users(id) ON DELETE CASCADE,
    org_role_id  UUID NOT NULL REFERENCES core.org_roles(id),
    territory    VARCHAR(100),
    hired_at     DATE,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Advisor-supervisor relationships (validated against employees.org_role_id)
-- existing table: core.advisor_supervisors
-- application validation:
--   advisor_id user must have employees.org_role_id → org_roles.code = 'advisor'
--   supervisor_id user must have employees.org_role_id → org_roles.code = 'supervisor'
```

---

## Conclusion

The `app_auth.roles` table is correct for **permissions**. It should not be the source of truth for **organizational identity**. The existence of `core.advisor_supervisors` and the upcoming CRM module make this separation urgent.

Building `core.org_roles` and `core.employees` now prevents a larger refactor later when CRM, commissions, and reporting modules need reliable org chart data.

---

## References

- `models/02_profiles.sql` — profiles + advisor_supervisors schema
- `models/03_crm.sql` — CRM tables with `advisor_id` references
- `models/08_reports_notifications.sql` — reports with `advisor_id` and `sales_objectives`
- `src/db/schema/auth.ts` — RBAC tables (roles, user_roles, role_permissions)
- `src/db/schema/core.ts` — current core schema (profiles, advisor_supervisors)
- `docs/project-structure.md` — Rule 5: "Module != DB schema"
