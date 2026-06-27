# Requirements Audit — BOPADIGITAL API

Audit of functional requirements from the BOPACORP S.A. Requirements Specification Document against the current API implementation (bopacorp-api). Last updated: 2026-06-26.

## Legend

- **DONE** — Endpoint and business logic implemented
- **PARTIAL** — Some parts done, gaps noted
- **NOT DONE** — No implementation found
- **DESCOPED** — Intentionally removed per client decision

---

## 5.1 Public Website

### CAT — Service Catalog & Website

| ID | Status | Notes |
|---|---|---|
| RF-CAT-001 | DONE | `public-catalog` module, GET /public/catalog/items with categories |
| RF-CAT-002 | DONE | Catalog items include costs, benefits, conditions via content blocks |
| RF-CAT-003 | PARTIAL | Public catalog lists items but filtering by coverage/price not confirmed |
| RF-CAT-004 | DONE | `contact-requests` module — POST to initiate contact |
| RF-CAT-005 | DONE | CMS landing blocks serve About Us content |

### CMS — Content Management

| ID | Status | Notes |
|---|---|---|
| RF-CMS-001 | DONE | Auth with JWT, role-based access |
| RF-CMS-002 | DONE | `cms` module + `catalog-items` with CRUD, image upload |
| RF-CMS-003 | DONE | POST catalog-items creates new products |
| RF-CMS-004 | DONE | PATCH catalog-items updates existing |
| RF-CMS-005 | DONE | DELETE catalog-items removes from catalog |

### EMP — Employability & Application

| ID | Status | Notes |
|---|---|---|
| RF-EMP-001 | DONE | `vacancies` sub-module, public published listings |
| RF-EMP-002 | DONE | `public-apply` + `candidates` modules handle form |
| RF-EMP-003 | DONE | `candidate-resumes` with S3 upload (Supabase Storage) |
| RF-EMP-004 | DONE | Zod validation on all request bodies |
| RF-EMP-005 | PARTIAL | Visual confirmation is frontend. **No email sending** configured in API |
| RF-EMP-006 | PARTIAL | `job-applications` has PATCH (status update) but **no email notification** on result |

---

## 5.2 Internal Application

### CRM — Client Relationship Management

| ID | Status | Notes |
|---|---|---|
| RF-CRM-001 | DONE | POST business-clients with RUC, name, services, billing |
| RF-CRM-002 | DONE | PATCH business-clients |
| RF-CRM-003 | DONE | Filtering by search, advisorId, sortBy on list endpoint |
| RF-CRM-004 | DONE | `visits` module with POST — schedule visits |
| RF-CRM-005 | DONE | Visit creation with GPS lat/lng/accuracy/timestamp |
| RF-CRM-006 | DONE | Supervisor can view visits with GPS data |
| RF-CRM-007 | DONE | GET visits with filters (advisor visit history) |
| RF-CRM-008 | DONE | PATCH negotiations — state updates + history endpoint |
| RF-CRM-009 | DONE | Supervisor creates clients (same POST, role-gated) |
| RF-CRM-010 | DONE | PATCH business-clients (supervisor permissions) |
| RF-CRM-011 | DONE | Soft delete via deletedAt |
| RF-CRM-012 | DONE | Client has advisorId — assignment via PATCH |
| RF-CRM-013 | DONE | List clients filtered by advisorId |
| RF-CRM-014 | DONE | PATCH advisorId to null or different advisor |
| RF-CRM-015 | PARTIAL | Visits endpoint shows activity. **No dedicated aggregated activity feed** |
| RF-CRM-016 | DONE | Reports `listAdvisorMetrics` — contacted, visited, closed per advisor |
| RF-CRM-017 | DONE | Reports include totalBilledAmount, averageBillingPerService |
| RF-CRM-018 | NOT DONE | No terminals/equipment tracking. No DB table or endpoint |
| RF-CRM-019 | DONE | Advisor metrics include counts per funnel stage |
| RF-CRM-020 | DONE | Business clients list filters by stage, date, advisor |
| RF-CRM-021 | DONE | Advisor role scoping — sees only assigned clients |
| RF-CRM-022 | DONE | GET negotiations/:id/history |

### MAT — Offer Matrix (Simplified per Client)

Client decision (2026-06-23): matrices simplified from approval workflow to document container. Each negotiation has 1 matrix with 2 attachments (Excel offer + Outlook email). TIGO handles approval externally.

| ID | Status | Notes |
|---|---|---|
| RF-MAT-001 | DONE | POST matrices — associated with negotiation |
| RF-MAT-002 | DESCOPED | Simplified to document container. No line items (products/quantities/prices) |
| RF-MAT-003 | DESCOPED | No subsidy calculation — matrices are document-only |
| RF-MAT-004 | DONE | Attachments with PDF/Excel/JPG/PNG, 50MB limit |
| RF-MAT-005 | DESCOPED | No draft/submitted state — approval workflow removed |
| RF-MAT-006 | DESCOPED | No "send for approval" — approval handled externally by TIGO |
| RF-MAT-007 | DONE | GET matrices list with history |

### SUP — Supervision & Approvals

Entire approval workflow descoped per client decision — TIGO handles approvals externally.

| ID | Status | Notes |
|---|---|---|
| RF-SUP-001 | DESCOPED | No pending approval queue |
| RF-SUP-002 | DESCOPED | No commercial indicators on matrices |
| RF-SUP-003 | DESCOPED | No approve/reject flow in system |
| RF-SUP-004 | DESCOPED | No approval history |
| RF-SUP-005 | DESCOPED | No approval notification |
| RF-SUP-006 | PARTIAL | Matrices listable with filters, but no status/subsidy filters |

### DOC — Document Management

| ID | Status | Notes |
|---|---|---|
| RF-DOC-001 | DONE | `documents` module — negotiation_documents CRUD |
| RF-DOC-002 | DONE | File upload via `document-uploads`, format/size validation |
| RF-DOC-003 | DONE | Documents have document_type labeling |
| RF-DOC-004 | DONE | `document_types` CRUD — coordinator defines mandatory/optional |
| RF-DOC-005 | DONE | Document review_status visible to advisor |
| RF-DOC-006 | DONE | Coordinator can list/view all documents |
| RF-DOC-007 | PARTIAL | Individual download exists. **No bulk download** (zip) |
| RF-DOC-008 | NOT DONE | **No email notifications** on document review |
| RF-DOC-009 | PARTIAL | Can filter documents by advisor/status. No dedicated "pending list" endpoint |

### REP — Reporting

| ID | Status | Notes |
|---|---|---|
| RF-REP-001 | DONE | `listAdvisorMetrics` with date range filters |
| RF-REP-002 | DONE | Same endpoint, supervisor filtered |
| RF-REP-003 | DONE | Metrics: contacts, closures, visits, billing per advisor |
| RF-REP-004 | DONE | Same metrics endpoint |
| RF-REP-005 | PARTIAL | `sales_objectives` CRUD exists. Comparison logic (actual vs objective) needs dedicated endpoint or frontend |
| RF-REP-006 | DONE | `report_exports` module — create/list exports (PDF/Excel) |
| RF-REP-007 | DONE | Same export module |
| RF-REP-008 | PARTIAL | API serves raw data. Charts/KPIs are frontend responsibility |
| RF-REP-009 | DONE | Role-based access via RBAC middleware |
| RF-REP-010 | DONE | Advisor can query own metrics (role-scoped) |

### SEG — Basic Security

| ID | Status | Notes |
|---|---|---|
| RF-SEG-001 | DONE | JWT auth — login, refresh, logout |
| RF-SEG-002 | DONE | Full RBAC — roles + permissions + modules |
| RF-SEG-003 | DONE | Manager inherits supervisor permissions (role hierarchy) |

### NOT — Notifications

| ID | Status | Notes |
|---|---|---|
| RF-NOT-001 | PARTIAL | Notifications CRUD exists (create, list, markRead). **No email sending**. No auto-trigger on events |
| RF-NOT-002 | DONE | GET /notifications with user-scoped history |

---

## Non-Functional Requirements

| ID | Status | Notes |
|---|---|---|
| RNF-001 | NOT VERIFIED | No load testing done (JMeter) |
| RNF-002 | NOT VERIFIED | No uptime monitoring configured |
| RNF-003 | NOT VERIFIED | No load test for 25 concurrent users |
| RNF-004 | DONE | bcrypt hashing in auth module |
| RNF-005 | PARTIAL | HTTPS depends on deployment. API ready for TLS |
| RNF-006 | NOT VERIFIED | Cross-device testing not done |
| RNF-007 | N/A | Frontend responsibility |
| RNF-008 | PARTIAL | Auth events logged. Not all critical events have audit logging |
| RNF-009 | DONE | File validation by extension + size (50MB limit) |
| RNF-010 | NOT DONE | No automated backup configured |
| RNF-011 | PARTIAL | Biome enforces coding standards. No OWASP-specific static analysis |
| RNF-012 | DONE | MVC-style architecture with modules pattern |
| RNF-013 | NOT VERIFIED | No legal audit done |
| RNF-014 | DONE | AES-256 encryption for document attachments (encryptionMetadata) |
| RNF-015 | PARTIAL | Error messages in English, not Spanish |
| RNF-016 | PARTIAL | PostgreSQL transactions used in some places. Not comprehensive |
| RNF-017 | PARTIAL | Some audit logging. No comprehensive audit trail for all operations |
| RNF-018 | DONE | Zod validation on both client (shared) and server sides |
| RNF-019 | NOT VERIFIED | No endurance testing done |
| RNF-020 | PARTIAL | Code is clean but minimal inline documentation |
| RNF-021 | NOT DONE | Zero test files across all repos |
| RNF-022 | NOT VERIFIED | No deployment downtime measured |
| RNF-023 | NOT DONE | No data anonymization in dev/test environments |
| RNF-024 | DONE | JWT expiration configured (15-minute tokens + refresh) |
| RNF-025 | NOT DONE | No backup restore procedure |
| RNF-026 | DONE | JWT-only API access with expiration |

---

## Project Rubric Items (01ProjectSpec)

| Item | Weight | Status |
|---|---|---|
| Report quality + high-fidelity prototype | 10 | NOT DONE |
| Git repository structure | 05 | DONE |
| Build automation tool | 05 | DONE (npm scripts, tsc + tsc-alias) |
| SCRUM evidence (backlogs, planning, roles) | 10 | PARTIAL (ClickUp tasks, sprint reviews need evidence) |
| Coding standards + enforcement (Biome) | 10 | DONE |
| Preemptive error detection (PMD equivalent) | 15 | DONE (Biome lint strict mode) |
| Team management tool (ClickUp) | 10 | DONE |
| Test cases | 10 | NOT DONE (zero tests) |
| Deployment guide / user manual | 10 | NOT DONE |
| Presentation (client, objectives, demo) | 15 | NOT DONE |

### Penalties Risk

| Penalty | Risk | Status |
|---|---|---|
| No production deployment | -100 | NEEDS VERIFICATION |
| No communications evidence | -30 | NEEDS VERIFICATION |
| No client acceptance form | -100 | NEEDS VERIFICATION |
| Non-compliance with delivery standard | -50 | AT RISK |
| Grammar/spelling errors (max 20) | -2 each | N/A until report written |
| No co-evaluation | -50 | Individual task |
| No repo access | -50 | OK (GitHub) |

---

## Critical Gaps Summary

1. **No email service** — Multiple requirements need email (EMP-005, EMP-006, DOC-008, NOT-001)
2. **Zero tests** — 10% rubric weight + RNF-021 requires 80% coverage
3. **Production deployment** — -100 penalty if missing
4. **Equipment/terminals tracking** (RF-CRM-018) — No DB table
5. **Bulk document download** (RF-DOC-007)
6. **Project report** — 10% rubric weight
7. **Deployment guide** — 10% rubric weight
8. **Presentation video** — 15% rubric weight
