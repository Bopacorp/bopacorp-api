# Development Workflow — BOPADIGITAL API

Step-by-step guide for building API features. Covers the full cycle from branch creation to merged PR, across both `bopacorp-shared` and `bopacorp-api` repos.

---

## Overview

Every feature touches two repos in this order:

```
1. bopacorp-shared    →  Define schemas (request/response/enums)
2. bopacorp-api       →  Build module (routes/controller/service)
```

Shared package first because API imports from it. Never the reverse.

---

## Phase 1: Plan

Before writing code, answer these questions:

| Question | Example answer |
|----------|---------------|
| Which module? | `users` |
| Which endpoints? | `POST /users`, `GET /users`, `GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id` |
| Which DB tables? | `app_auth.users`, `app_auth.user_roles`, `core.profiles` |
| Which shared schemas exist? | `CreateUserRequestSchema`, `UserResponseSchema` (check `bopacorp-shared`) |
| Which shared schemas need to be created? | `UpdateUserRequestSchema` if missing |
| Auth required? | Yes — all endpoints need `authenticate` middleware |
| Permissions needed? | `users.create`, `users.read`, `users.update`, `users.delete` |

---

## Phase 2: Shared Package (`bopacorp-shared`)

### Step 2.1 — Branch

```bash
cd bopacorp-shared
git checkout main && git pull
git checkout -b feat/users-schemas
```

### Step 2.2 — Define or update schemas

Check what already exists:

```bash
ls src/auth/          # enums.ts, request.ts, response.ts, index.ts
```

If schemas for your endpoints already exist, skip to Phase 3.

If not, follow the 4-file module pattern:

| File | Add |
|------|-----|
| `enums.ts` | New enum values if needed |
| `request.ts` | `Create*RequestSchema`, `Update*RequestSchema`, `List*QuerySchema` |
| `response.ts` | `*ResponseSchema`, `*ListItemResponseSchema`, `*DetailResponseSchema` |
| `index.ts` | Export new schemas + types |

Rules from `bopacorp-shared/AGENTS.md`:
- Request: nullable SQL columns → `.optional()`, all update fields → `.optional()` (PATCH semantics)
- Response: nullable SQL columns → `.nullable()` (field always present, value may be null)
- Never expose `passwordHash`, `deletedAt`, `failedLoginAttempts`, `lockedUntil`
- Every schema exports its inferred type on next line: `export type X = z.infer<typeof XSchema>`
- Reuse `UuidSchema`, `EmailSchema`, `PaginationQuerySchema` from `common/primitives`

### Step 2.3 — Build + verify

```bash
rm -rf dist && npm run build    # zero errors
grep -r "password_hash\|deleted_at" src/    # zero results
```

### Step 2.4 — Publish

```bash
npm version patch
npm publish
git add -A
git commit -m "feat(auth): add user management schemas"
git push -u origin feat/users-schemas
# Create PR → merge
```

### Step 2.5 — Update in API

```bash
cd bopacorp-api
npm update @bopacorp/shared
```

---

## Phase 3: API Module (`bopacorp-api`)

### Step 3.1 — Branch

```bash
git checkout main && git pull
git checkout -b feat/users-crud-endpoints
```

### Step 3.2 — Create routes file

`src/modules/users/users.routes.ts`

```typescript
import {
  CreateUserRequestSchema,
  IdParamSchema,
  ListUsersQuerySchema,
  UpdateUserRequestSchema,
} from '@bopacorp/shared/auth';
import { validate } from '@shared/middleware/validate.js';
import { usersController } from './users.controller.js';
import { Router } from 'express';

export const usersRoutes = Router();

usersRoutes.get('/', validate({ query: ListUsersQuerySchema }), usersController.list);
usersRoutes.get('/:id', validate({ params: IdParamSchema }), usersController.getById);
usersRoutes.post('/', validate({ body: CreateUserRequestSchema }), usersController.create);
usersRoutes.patch(
  '/:id',
  validate({ params: IdParamSchema, body: UpdateUserRequestSchema }),
  usersController.update,
);
usersRoutes.delete('/:id', validate({ params: IdParamSchema }), usersController.remove);
```

When auth middleware exists, add `authenticate` and `authorize` per route:

```typescript
usersRoutes.post('/', authenticate, authorize('users.create'), validate({ body: CreateUserRequestSchema }), usersController.create);
```

### Step 3.3 — Create controller file

`src/modules/users/users.controller.ts`

```typescript
import type { CreateUserRequest, IdParam, ListUsersQuery, UpdateUserRequest } from '@bopacorp/shared/auth';
import type { Request, Response } from 'express';
import { usersService } from './users.service.js';

export const usersController = {
  async list(req: Request, res: Response) {
    const query = req.query as ListUsersQuery;
    const result = await usersService.list(query);
    res.json({ success: true, data: result.data, meta: result.meta });
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    const user = await usersService.getById(id);
    res.json({ success: true, data: user });
  },

  async create(req: Request, res: Response) {
    const data = req.body as CreateUserRequest;
    const user = await usersService.create(data);
    res.status(201).json({ success: true, data: user });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    const data = req.body as UpdateUserRequest;
    const user = await usersService.update(id, data);
    res.json({ success: true, data: user });
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params as unknown as IdParam;
    await usersService.remove(id);
    res.json({ success: true, data: { message: 'User deleted' } });
  },
};
```

Rules:
- Object with async methods, not a class
- Cast `req.body`/`req.params`/`req.query` to shared types (validation already ran)
- Call service, format envelope response
- Never try/catch — error handler catches
- `201` for POST create, `200` for everything else

### Step 3.4 — Create service file

`src/modules/users/users.service.ts`

```typescript
import { db } from '@lib/db.js';
import type { CreateUserRequest, ListUsersQuery, UpdateUserRequest } from '@bopacorp/shared/auth';
import { and, eq, ilike, isNull, sql } from 'drizzle-orm';
import { users } from '../../db/schema/auth.js';
import { profiles } from '../../db/schema/core.js';
import { ConflictError, NotFoundError } from '@shared/errors/http-error.js';

export const usersService = {
  async list(query: ListUsersQuery) {
    // 1. Build WHERE conditions
    // 2. Count total
    // 3. Query with pagination: .limit(query.limit).offset((query.page - 1) * query.limit)
    // 4. Map to response shape
    // 5. Return { data, meta: { page, limit, totalItems, totalPages } }
  },

  async getById(id: string) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, id), isNull(users.deletedAt)),
      with: { profile: true, userRoles: { with: { role: true } } },
    });
    if (!user) throw new NotFoundError('User', id);
    return toUserResponse(user);
  },

  async create(data: CreateUserRequest) {
    // 1. Check email uniqueness → throw ConflictError if exists
    // 2. Hash password with bcrypt
    // 3. Transaction: insert user + profile + user_roles
    // 4. Return response shape
  },

  async update(id: string, data: UpdateUserRequest) {
    // 1. Find user → throw NotFoundError if missing
    // 2. If email changed, check uniqueness → throw ConflictError
    // 3. Update user + profile
    // 4. Return response shape
  },

  async remove(id: string) {
    // 1. Find user → throw NotFoundError if missing
    // 2. Soft delete: set deletedAt = now()
  },
};
```

Rules:
- Object with async methods, not a class
- Import `db` from `@lib/db.js`, tables from `../../db/schema/`
- Throw `NotFoundError`, `ConflictError`, etc. from `@shared/errors/http-error.js`
- Never access `req` or `res` — receive plain data, return plain objects
- Map DB rows → response shape (strip internal fields)
- Use `db.transaction()` for multi-table writes

### Step 3.5 — Mount routes in server.ts

```typescript
import { usersRoutes } from '@modules/users/users.routes.js';

// Under protected routes section:
app.use('/api/v1/users', usersRoutes);
```

### Step 3.6 — Verify

```bash
npm run check          # lint + format + typecheck — zero errors
npm test               # all tests pass
npm run dev            # start server
```

### Step 3.7 — Manual testing

Test each endpoint with curl or Postman:

```bash
# Create
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@test.com","password":"securepass123","profile":{...},"roleIds":[...]}'

# List
curl http://localhost:3000/api/v1/users?page=1&limit=10

# Get by ID
curl http://localhost:3000/api/v1/users/{id}

# Update
curl -X PATCH http://localhost:3000/api/v1/users/{id} \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com"}'

# Delete
curl -X DELETE http://localhost:3000/api/v1/users/{id}
```

Verify:
- Valid request → correct status code + envelope
- Missing required field → 422 with details array
- Duplicate email → 409 conflict
- Unknown ID → 404 not found
- Unknown route → 404 route not found

### Step 3.8 — Commit + PR

```bash
git add src/modules/users/ src/server.ts
git commit -m "feat(users): add crud endpoints with pagination"
git push -u origin feat/users-crud-endpoints
# Create PR → review → squash merge
```

---

## Phase 4: Database Changes (if needed)

When a feature requires schema changes:

```bash
# 1. Edit schema in src/db/schema/
# 2. Generate migration
npm run db:generate

# 3. Review SQL
cat drizzle/XXXX_name.sql

# 4. Apply locally
npm run db:migrate

# 5. Commit together
git add src/db/schema/ drizzle/
git commit -m "feat(db): add new columns to users table"
```

Schema + migration always in the same commit.

---

## Quick Reference: File Creation Order

For any new feature, create files in this order:

```
1. @bopacorp/shared  →  enums → request schemas → response schemas → index exports
2. bopacorp-api      →  service → controller → routes → mount in server.ts
```

Service first in API because controller imports it, and routes import controller.

---

## Checklist

Copy this for every feature PR:

```markdown
### Shared package
- [ ] Schemas defined in `@bopacorp/shared` (or already exist)
- [ ] `npm run build` passes in shared package
- [ ] Published + updated in API

### API module
- [ ] `[module].service.ts` — business logic + DB queries
- [ ] `[module].controller.ts` — request parsing + response formatting
- [ ] `[module].routes.ts` — endpoints + validation middleware
- [ ] Routes mounted in `server.ts`
- [ ] `npm run check` passes (lint + format + typecheck)
- [ ] `npm test` passes
- [ ] Manual testing: success + error cases verified
- [ ] No `passwordHash`, `deletedAt`, or internal fields in responses
```
