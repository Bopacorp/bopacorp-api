# Project Structure Guide — BOPADIGITAL API

Standard rules for organizing code in this project. All team members and AI agents must follow these conventions.

## Architecture: Modular Monolith

Each business domain is an isolated module. Modules share infrastructure (db, logger, middleware) but not business logic.

```
src/
├── config/                        # App configuration
│   └── env.ts                     # Zod-validated environment variables
├── db/schema/                     # Drizzle ORM schema (one file per PG schema)
├── lib/                           # Singletons (db client, logger)
├── modules/                       # Business domain modules
│   ├── auth/                      # Login, logout, token refresh, password reset
│   ├── users/                     # CRUD users, assign/remove roles
│   ├── roles/                     # CRUD roles, permissions, modules (RBAC admin)
│   ├── profiles/                  # Profiles, advisor-supervisor assignments
│   ├── catalog/                   # Service catalog, categories, CMS content
│   └── employability/             # Job vacancies, candidates, applications
├── shared/                        # Cross-cutting concerns
│   ├── middleware/                 # Express middleware (auth, validation, errors)
│   ├── errors/                    # Error classes (HttpError hierarchy)
│   ├── utils/                     # Pure utility functions (pagination, etc.)
│   └── types/                     # Global type declarations (express.d.ts)
├── server.ts                      # Express app setup + middleware + route mounting
└── index.ts                       # Entry point (dotenv + env validation + boot)
```

---

## Module Rules

### Rule 1: Three files per module

Each module has exactly 3 files. No more, no less.

```
src/modules/auth/
├── auth.routes.ts          # Route definitions + middleware wiring
├── auth.controller.ts      # Request parsing + response formatting
└── auth.service.ts         # Business logic + DB queries
```

File naming: `[module-name].[layer].ts`. Always lowercase, always matches folder name.

### Rule 2: Layer responsibilities

| Layer | Does | Does NOT |
|-------|------|----------|
| **routes** | Define endpoints, attach middleware (auth, validate), call controller | Access DB, contain business logic, import `db` |
| **controller** | Parse `req.params`/`req.body`/`req.query`, call service, format `res.json()` | Write SQL/Drizzle queries, throw raw errors, import `db` |
| **service** | Execute business logic, query DB via Drizzle, throw typed errors | Access `req`/`res`, format HTTP responses, import Express types |

### Rule 3: One-way dependency flow

```
routes → controller → service → db
   ↓          ↓
validate   @bopacorp/shared (schemas + types)
middleware
```

**Allowed imports per layer:**

| File | Can import from |
|------|----------------|
| `*.routes.ts` | own controller, `@shared/middleware/*`, `@bopacorp/shared` |
| `*.controller.ts` | own service, `@bopacorp/shared` (types), `@shared/errors/*` |
| `*.service.ts` | `@lib/db.js`, `src/db/schema/*`, `@shared/errors/*`, `@shared/utils/*` |

**Never allowed:**
- Service imports controller
- Routes import `db` directly
- Module A imports Module B's service (use shared service or refactor)
- Controller imports Drizzle schema tables

### Rule 4: Validation lives in `@bopacorp/shared`

No `*.schema.ts` files inside modules. All Zod request/response schemas live in `@bopacorp/shared`.

```typescript
// In routes — validation middleware uses shared schema
import { CreateUserRequestSchema } from '@bopacorp/shared/auth';

router.post('/', validate(CreateUserRequestSchema), controller.create);

// In controller — types come from shared
import type { CreateUserRequest, UserResponse } from '@bopacorp/shared/auth';
```

### Rule 5: Module ≠ DB schema

API modules map to **business concerns**, not database schemas. One DB schema can feed multiple modules.

| DB Schema | Tables | API Modules |
|-----------|--------|-------------|
| `app_auth` | 9 tables | `auth` (login/tokens), `users` (CRUD), `roles` (RBAC admin) |
| `core` | 4 tables | `profiles` (profiles, advisor assignments, org roles, employees) |
| `catalog` | 20 tables | `catalog` (items, categories, CMS) |
| `employability` | 4 tables | `employability` (vacancies, candidates, applications) |

When a module grows too large (>500 lines in service), split by concern.

### Rule 6: Route mounting

All module routes mount from `server.ts` under `/api/v1`:

```typescript
import { authRoutes } from '@modules/auth/auth.routes.js';
import { usersRoutes } from '@modules/users/users.routes.js';
import { rolesRoutes } from '@modules/roles/roles.routes.js';
import { profilesRoutes } from '@modules/profiles/profiles.routes.js';
import { catalogRoutes } from '@modules/catalog/catalog.routes.js';
import { employabilityRoutes } from '@modules/employability/employability.routes.js';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/roles', rolesRoutes);
app.use('/api/v1/profiles', profilesRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/employability', employabilityRoutes);
```

Route prefix matches the API resource, not necessarily the module name.

### Rule 7: Export pattern

Each module exports its router from routes file. No barrel `index.ts` per module — import directly:

```typescript
// auth.routes.ts
export const authRoutes = Router();

// server.ts
import { authRoutes } from '@modules/auth/auth.routes.js';
```

---

## Shared Code Rules

### `shared/middleware/`

Express middleware used across modules:

| File | Purpose |
|------|---------|
| `authenticate.ts` | JWT verification → sets `req.user` |
| `authorize.ts` | Permission/role check (uses RBAC from app_auth schema) |
| `validate.ts` | Generic Zod validation middleware (works with any schema) |
| `error-handler.ts` | Global error handler (catches HttpError, formats response) |

### `shared/errors/`

Typed error classes that services throw and error-handler catches:

```typescript
// http-error.ts
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { ... }
}

export class NotFoundError extends HttpError { ... }       // 404
export class UnauthorizedError extends HttpError { ... }   // 401
export class ForbiddenError extends HttpError { ... }      // 403
export class ConflictError extends HttpError { ... }       // 409
export class ValidationError extends HttpError { ... }     // 422
```

Services throw these. Controllers never catch — global error handler does.

### `shared/utils/`

Pure functions with no side effects. No Express imports. No DB imports.

### `shared/types/`

Global TypeScript declarations. Example: Express request augmentation for `req.user`.

---

## Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Module routes | `[module].routes.ts` | `auth.routes.ts` |
| Module controller | `[module].controller.ts` | `auth.controller.ts` |
| Module service | `[module].service.ts` | `auth.service.ts` |
| Middleware | `[name].ts` | `authenticate.ts` |
| Error classes | `http-error.ts` | Single file, all classes |
| Test | `[file].test.ts` | `auth.service.test.ts` |

### Functions

| Layer | Pattern | Example |
|-------|---------|---------|
| Controller | HTTP verb semantics | `login`, `register`, `create`, `getById`, `update`, `remove` |
| Service | Business action | `authenticateUser`, `createProfile`, `assignRoles` |
| Middleware | Descriptive | `authenticate`, `authorize`, `validate` |

### Routes

| HTTP | Route | Controller method | Purpose |
|------|-------|-------------------|---------|
| POST | `/` | `create` | Create resource |
| GET | `/` | `list` | List with pagination |
| GET | `/:id` | `getById` | Get single by ID |
| PATCH | `/:id` | `update` | Partial update |
| DELETE | `/:id` | `remove` | Soft delete |

---

## Adding a New Module — Checklist

Example: adding `documents` module.

- [ ] Create folder `src/modules/documents/`
- [ ] Create `documents.routes.ts` — define endpoints, attach middleware
- [ ] Create `documents.controller.ts` — request/response handling
- [ ] Create `documents.service.ts` — business logic + DB queries
- [ ] Mount routes in `server.ts`: `app.use('/api/v1/documents', documentRoutes)`
- [ ] Add schemas to `@bopacorp/shared` (request + response Zod schemas)
- [ ] `npm run build` — zero errors
- [ ] `npm run lint` — zero errors

---

## Cross-Module Communication

When module A needs data from module B's domain:

1. **Preferred**: Query DB directly (both services can read any Drizzle schema table)
2. **If business logic needed**: Extract shared utility to `shared/utils/`
3. **Never**: Import another module's service

Services are independent. They share the database layer, not each other's functions.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Zod schema inside module | Move to `@bopacorp/shared` |
| Controller queries DB | Move query to service |
| Service accesses `req`/`res` | Pass only needed data as function params |
| Module imports another module's service | Query DB directly or extract to shared utility |
| Business logic in routes file | Move to controller or service |
| `index.ts` barrel per module | Not needed — import files directly |
| Catching errors in controller | Let global error handler catch |
| Raw string errors in service | Throw typed `HttpError` subclass |
