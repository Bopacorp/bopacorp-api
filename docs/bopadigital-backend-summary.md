# BOPADIGITAL — Backend Technical Summary

## Project Overview

BOPADIGITAL is a comprehensive digital platform built for BOPACORP S.A., a telecommunications company and strategic commercial partner of Movistar Ecuador. The backend serves as the single API powering two client applications: a web CRM/CMS and a mobile field application for sales advisors. Its core purpose is to digitize and centralize the complete B2B sales lifecycle, replacing a manual, decentralized process based on Excel, WhatsApp, and Google Drive.

---

## Repository

| Property | Value |
|---|---|
| **Organization** | github.com/Bopacorp |
| **Repository** | `bopadigital-api` |
| **Architecture** | Single monolithic REST API |
| **Serves** | `bopadigital-web` + `bopadigital-mobile` |

---

## Tech Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| **Runtime** | Node.js | >= 20 | LTS, modern ESM support |
| **Framework** | Express | 5.x (stable) | Default on npm since March 2025; native async/await error handling |
| **Language** | TypeScript | 5.x | `strict: true`; full type safety across the project |
| **ORM** | Prisma | 7.x | Schema-first, auto-generated types, automatic migrations |
| **Database** | PostgreSQL | 16 | Via Supabase (shared dev environment for the team) |
| **Validation** | Zod | 3.x | Runtime validation + inferred TypeScript types from schemas |
| **Authentication** | JWT + bcrypt | — | 15-minute access tokens; bcrypt with 12-round salt |
| **Security** | Helmet + CORS + Rate Limit | — | OWASP Top 10 compliance |
| **Dev Server** | tsx watch | — | TypeScript execution without compilation step |
| **Testing** | Vitest + Supertest | — | Unit and integration tests; >= 80% coverage target |
| **Package Manager** | npm | >= 10 | Standard, enforced via `engine-strict` |

---

## Project Structure

```
bopadigital-api/
├── src/
│   ├── modules/              ← Feature-based organization
│   │   ├── auth/             ← Authentication (SEG module)
│   │   ├── users/            ← User management
│   │   ├── crm/              ← Client & negotiation management (CRM)
│   │   ├── matrix/           ← Offer matrix creation & approval (MAT)
│   │   ├── supervision/      ← Supervisor approvals & visibility (SUP)
│   │   ├── documents/        ← Document upload & review (DOC)
│   │   ├── reporting/        ← KPIs, dashboards, exports (REP)
│   │   ├── catalog/          ← Public service catalog (CAT)
│   │   ├── cms/              ← Content management for website (CMS)
│   │   └── jobs/             ← Employment applications (EMP)
│   ├── shared/
│   │   ├── middleware/        ← auth, roles, validation
│   │   ├── errors/            ← AppError class, global error handler
│   │   └── types/             ← Express.Request extension (user context)
│   ├── config/
│   │   └── env.ts             ← Environment variables validated with Zod
│   ├── lib/
│   │   └── prisma.ts          ← PrismaClient singleton
│   ├── app.ts                 ← Express setup, middlewares, routes
│   └── server.ts              ← Entry point, DB connection, server start
├── prisma/
│   └── schema.prisma          ← Database schema, enums, relations
├── .env                       ← Local secrets (not committed)
├── .env.example               ← Template committed to repo
├── tsconfig.json
└── package.json
```

Each module follows a consistent 4-file pattern:

```
module/
├── module.routes.ts      ← Route definitions, middleware chain
├── module.controller.ts  ← HTTP layer: parse request, call service, return response
├── module.service.ts     ← Business logic, Prisma queries
└── module.schema.ts      ← Zod schemas for request validation + inferred DTOs
```

---

## API Modules

| Module | Code | Key Responsibilities |
|---|---|---|
| **Auth** | SEG | Login, JWT issuance, token refresh, role-based access control |
| **Users** | — | User creation, role assignment, activation/deactivation |
| **CRM** | CRM | Client registration, negotiation stages, visit scheduling, GPS logging |
| **Offer Matrix** | MAT | Matrix creation, subsidy calculation, draft/submit to supervisor |
| **Supervision** | SUP | Approve/reject matrices, team activity feed, negotiation visibility |
| **Documents** | DOC | File uploads (PDF/JPG/PNG up to 50 MB), review and approval workflow |
| **Reporting** | REP | Sales metrics, advisor performance KPIs, PDF/Excel exports |
| **Catalog** | CAT | Public service catalog with categories, pricing, and filters |
| **CMS** | CMS | Admin panel for editing website content (text, images, services) |
| **Jobs** | EMP | Vacancy listings, application forms, CV upload, email confirmation |

---

## User Roles & Access

The system enforces five distinct roles with hierarchical permissions (RF-SEG-001, RF-SEG-002, RF-SEG-003):

| Role | Description | Key Access |
|---|---|---|
| `ADVISOR` | Field sales executive | Own clients, visits, matrices, document uploads |
| `SUPERVISOR` | Sales manager | Full team visibility, matrix approvals, performance reports |
| `MANAGER` | Executive / director | Consolidated reports, KPI dashboards, all advisors |
| `COORDINATOR` | Operations | Document review & approval, service activation |
| `WEB_ADMIN` | Website administrator | CMS panel, catalog management |

Managers inherit all supervisor privileges (RF-SEG-003). Role enforcement is applied at the route level via a `rolesMiddleware` factory that receives an array of permitted roles.

---

## Database — Prisma Schema (Core Models)

```prisma
enum Role {
  ADVISOR | SUPERVISOR | MANAGER | COORDINATOR | WEB_ADMIN
}

enum NegotiationStatus {
  PROSPECT | INITIAL_VISIT | NEGOTIATION | CLOSING | CLOSED
}

enum DocumentType {
  PROVISIONAL_RUC | INITIAL_PROPOSAL | VISIT_REPORT | FINAL_CONTRACT
}

enum MatrixStatus {
  DRAFT | PENDING_APPROVAL | APPROVED | REJECTED
}

User         → owns clients (as advisor), manages team (as supervisor)
Client       → has negotiations, documents, visits
Negotiation  → has matrices, documents, visit history
Matrix       → has approval history, attached files
Document     → belongs to negotiation, reviewed by coordinator
Visit        → records GPS location, date, observations
```

---

## Authentication Flow

```
POST /api/auth/login
  → validate credentials (email + password)
  → verify bcrypt hash
  → issue JWT (15 min) + refresh token (7 days)
  → return { accessToken, refreshToken, user }

Protected routes:
  Authorization: Bearer <accessToken>
  → authMiddleware verifies JWT, attaches req.user
  → rolesMiddleware checks req.user.role against allowed roles
```

---

## Environment Variables

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=           # Supabase pooled connection (pgBouncer)
DIRECT_URL=             # Supabase direct connection (for migrations)
JWT_SECRET=             # Minimum 32 characters
JWT_EXPIRATION=15m
```

All variables are validated at startup using a Zod schema in `src/config/env.ts`. The server exits immediately with a clear error message if any required variable is missing or malformed.

---

## Shared Types Package

A fourth repository, `bopadigital-shared`, publishes `@bopacorp/shared` to GitHub Packages (private). This package contains all TypeScript enums and interfaces shared across the API, web, and mobile applications — eliminating type duplication and ensuring a single source of truth for role names, negotiation statuses, and document types.

| Consuming project | How it uses `@bopacorp/shared` |
|---|---|
| `bopadigital-api` | Role enum in JWT payload, Zod schemas |
| `bopadigital-web` | Role-based UI rendering, form schemas |
| `bopadigital-mobile` | Negotiation status labels, document types |

---

## Non-Functional Requirements Addressed

| Requirement | Implementation |
|---|---|
| Response time < 3s (RNF-001) | Prisma optimized queries, connection pooling via Supabase pgBouncer |
| 99.5% uptime (RNF-002) | Cloud deployment (Supabase + hosting provider) |
| 25 concurrent users (RNF-003) | Express + Node.js event loop, rate limiting |
| Password hashing (RNF-004) | bcrypt, minimum 12-character salt |
| HTTPS / TLS encryption (RNF-014) | Enforced at infrastructure level (NGINX + SSL) |
| OWASP Top 10 (RNF-011) | Helmet, CORS, rate limiting, input validation with Zod, JWT |
| Test coverage >= 80% (RNF-021) | Vitest + Supertest |
| File uploads up to 50 MB (RF-DOC-002) | express.json limit + cloud storage (Supabase Storage or S3) |

---

## Key Development Decisions

**Express 5 over Express 4** — Express 5 became the npm default in March 2025 and introduced native async/await error propagation, eliminating the need for manual try/catch in every route handler.

**Prisma over Drizzle** — Prisma's schema-first approach, automatic migrations, and auto-generated TypeScript types reduce friction for a 5-person academic team. Drizzle's SQL-first model offers marginally better performance but requires deeper SQL expertise and manual migration management.

**Express over NestJS** — While NestJS offers superior structure for large enterprise teams, Express + TypeScript with a strict feature-based folder convention provides the same organizational guarantees with less framework overhead, making it more appropriate for a focused team with defined scope.

**Polyrepo over Monorepo** — Three independent repositories (`bopadigital-api`, `bopadigital-web`, `bopadigital-mobile`) allow independent deployment pipelines and team autonomy. Shared types are distributed via the `@bopacorp/shared` npm package to eliminate cross-repo type duplication without coupling the release cycles.

**Supabase for development** — A shared cloud PostgreSQL instance via Supabase eliminates "works on my machine" database inconsistencies across the 5-member team, provides a built-in visual editor (Supabase Studio), and removes the Docker installation requirement during the development phase.
