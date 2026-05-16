# API Conventions Guide — BOPADIGITAL

Standard rules for API design, error handling, and validation. All team members and AI agents must follow these conventions.

Applies to both `bopacorp-api` and `bopacorp-shared`.

---

## API Response Envelope

Every response uses the envelope defined in `@bopacorp/shared/common`:

### Success (single resource)

```json
{
  "success": true,
  "data": { ... }
}
```

Schema: `ApiSuccessSchema(EntityResponseSchema)`

### Success (paginated list)

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 143,
    "totalPages": 8
  }
}
```

Schema: `ApiPaginatedSchema(EntityListItemResponseSchema)`

### Error

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User with id '...' not found"
  }
}
```

Schema: `ApiErrorSchema`

---

## HTTP Status Codes

### Success codes

| Status | When | Controller returns |
|--------|------|-------------------|
| `200` | GET, PATCH, DELETE success | `res.json(envelope)` |
| `201` | POST creates a resource | `res.status(201).json(envelope)` |
| `204` | DELETE with no body | `res.status(204).end()` |

### Error codes

| Status | Error class | `code` field | When |
|--------|-------------|-------------|------|
| `400` | `BadRequestError` | `BAD_REQUEST` | Malformed input that isn't a validation issue |
| `401` | `UnauthorizedError` | `UNAUTHORIZED` | Missing/invalid/expired JWT |
| `403` | `ForbiddenError` | `FORBIDDEN` | Valid JWT but insufficient permissions |
| `404` | `NotFoundError` | `RESOURCE_NOT_FOUND` | Entity doesn't exist or is soft-deleted |
| `409` | `ConflictError` | `CONFLICT` | Duplicate email, username, etc. |
| `422` | `ValidationError` | `VALIDATION_ERROR` | Zod validation failure |
| `429` | — | `RATE_LIMITED` | Rate limiter (handled by middleware) |
| `500` | — | `INTERNAL_ERROR` | Unexpected error (never expose details) |

---

## Error Handling Architecture

### Error class hierarchy

Defined in `src/shared/errors/http-error.ts`:

```typescript
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message, 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends HttpError {
  constructor(resource: string, id: string) {
    super(404, `${resource} with id '${id}' not found`, 'RESOURCE_NOT_FOUND');
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}
```

### Error flow

```
Service throws HttpError
  → Controller does NOT catch (lets it propagate)
    → Global error handler catches
      → Formats { success: false, error: { code, message } }
      → Logs with appropriate level
      → Sends response
```

### Global error handler

Defined in `src/shared/middleware/error-handler.ts`:

```typescript
// Catches all errors, formats into ApiError envelope
app.use(errorHandler);  // mounted LAST in server.ts
```

Rules:
- `HttpError` → send `statusCode` + `code` + `message` as-is
- Zod validation error → `422` + `VALIDATION_ERROR` + formatted field errors
- Unknown error → `500` + `INTERNAL_ERROR` + generic message (never expose stack/details)
- Log `5xx` as `error` level, `4xx` as `warn` level

### Where errors are thrown

| Layer | Throws? | Example |
|-------|---------|---------|
| **Service** | Yes — typed `HttpError` subclasses | `throw new NotFoundError('User', id)` |
| **Controller** | No — never catches, never throws | — |
| **Middleware** | Yes — `UnauthorizedError`, `ForbiddenError`, `ValidationError` | `throw new UnauthorizedError()` |
| **Routes** | Never | — |

---

## Validation Architecture

### Where validation runs

```
Request → authenticate → authorize → validate(Schema) → controller → service → db
```

Validation happens in **middleware**, before controller. Controller receives already-validated data.

### Validate middleware

Defined in `src/shared/middleware/validate.ts`. Takes a Zod schema from `@bopacorp/shared`, validates the appropriate request property:

```typescript
// Usage in routes
import { CreateUserRequestSchema } from '@bopacorp/shared/auth';
import { IdParamSchema } from '@bopacorp/shared/auth';

router.post('/', validate({ body: CreateUserRequestSchema }), controller.create);
router.get('/:id', validate({ params: IdParamSchema }), controller.getById);
router.get('/', validate({ query: ListUsersQuerySchema }), controller.list);
```

### What gets validated where

| Source | Schema location | Validated by |
|--------|----------------|-------------|
| `req.body` | `@bopacorp/shared/[module]/request.ts` | `validate({ body: Schema })` |
| `req.params` | `@bopacorp/shared/[module]/request.ts` | `validate({ params: Schema })` |
| `req.query` | `@bopacorp/shared/[module]/request.ts` | `validate({ query: Schema })` |
| DB constraints | Drizzle schema | Database (NOT application layer) |
| Business rules | — | Service layer (throw `HttpError`) |

### Validation error format

When Zod validation fails, error handler returns:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email" },
      { "field": "password", "message": "String must contain at least 8 character(s)" }
    ]
  }
}
```

`details` array is only present for `VALIDATION_ERROR`. All other error codes return just `code` + `message`.

---

## Route Design

### URL patterns

```
/api/v1/{resource}             # collection
/api/v1/{resource}/:id         # single item
/api/v1/{resource}/:id/{sub}   # sub-resource
```

Rules:
- **Plural nouns**: `/users`, `/roles`, `/catalog-items` (not `/user`, `/role`)
- **kebab-case**: `/job-vacancies`, `/content-blocks` (not camelCase)
- **No verbs in URLs**: use HTTP methods instead (`POST /auth/login` is the exception for auth operations)
- **Max 2 levels deep**: `/users/:id/roles` is fine, `/users/:id/roles/:roleId/permissions` is too deep — flatten to `/role-permissions`

### HTTP methods

| Method | Purpose | Idempotent | Body |
|--------|---------|------------|------|
| `GET` | Read | Yes | Never |
| `POST` | Create / action | No | Always |
| `PATCH` | Partial update | Yes | Always |
| `DELETE` | Remove (soft) | Yes | Never |
| `PUT` | Replace entire relation set | Yes | Always |

Use `PUT` only for "replace all" operations like `PUT /users/:id/roles` (replaces entire role set). Use `PATCH` for partial updates.

### Standard CRUD endpoints per resource

```typescript
const router = Router();

router.get('/', validate({ query: ListQuerySchema }), controller.list);
router.get('/:id', validate({ params: IdParamSchema }), controller.getById);
router.post('/', validate({ body: CreateSchema }), controller.create);
router.patch('/:id', validate({ params: IdParamSchema, body: UpdateSchema }), controller.update);
router.delete('/:id', validate({ params: IdParamSchema }), controller.remove);
```

### Auth-specific routes (exceptions to REST)

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
PATCH  /api/v1/auth/change-password
```

These use verbs because they represent actions, not resources.

---

## Pagination

### Request

Query params via `PaginationQuerySchema` from `@bopacorp/shared/common`:

```
GET /api/v1/users?page=2&limit=10&sortBy=createdAt&sortOrder=desc&search=john
```

| Param | Type | Default | Constraints |
|-------|------|---------|-------------|
| `page` | number | `1` | min: 1 |
| `limit` | number | `20` | min: 1, max: 100 |
| `sortBy` | string | — | Optional, validated per-endpoint |
| `sortOrder` | `'asc'` \| `'desc'` | `'asc'` | — |

Module-specific query schemas extend `PaginationQuerySchema`:

```typescript
export const ListUsersQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});
```

### Response

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 10,
    "totalItems": 143,
    "totalPages": 15
  }
}
```

---

## Soft Delete Convention

Entities with `deletedAt` use soft delete:

- `DELETE /:id` sets `deletedAt = now()`, returns `200`
- All GET queries filter `WHERE deleted_at IS NULL` by default
- Service layer handles this — controller just calls `service.remove(id)`
- No "restore" endpoint unless explicitly needed

---

## Controller Patterns

### Standard controller shape

```typescript
import type { Request, Response } from 'express';
import type { CreateUserRequest, IdParam, ListUsersQuery } from '@bopacorp/shared/auth';
import { userService } from './users.service.js';

export const usersController = {
  async list(req: Request, res: Response) {
    const query = req.query as ListUsersQuery;
    const result = await userService.list(query);
    res.json({ success: true, data: result.data, meta: result.meta });
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params as IdParam;
    const user = await userService.getById(id);
    res.json({ success: true, data: user });
  },

  async create(req: Request, res: Response) {
    const data = req.body as CreateUserRequest;
    const user = await userService.create(data);
    res.status(201).json({ success: true, data: user });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params as IdParam;
    const data = req.body as UpdateUserRequest;
    const user = await userService.update(id, data);
    res.json({ success: true, data: user });
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params as IdParam;
    await userService.remove(id);
    res.json({ success: true, data: { message: 'User deleted' } });
  },
};
```

Rules:
- Controller is an object with async methods, not a class
- Methods extract typed data from `req`, call service, format response
- Never try/catch — global error handler catches
- Always use typed casts after validation middleware (`as CreateUserRequest`)

---

## Service Patterns

```typescript
import { db } from '@lib/db.js';
import { eq, and, isNull } from 'drizzle-orm';
import { users } from '../../db/schema/auth.js';
import { NotFoundError, ConflictError } from '@shared/errors/http-error.js';

export const userService = {
  async getById(id: string) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, id), isNull(users.deletedAt)),
      with: { profile: true, userRoles: { with: { role: true } } },
    });
    if (!user) throw new NotFoundError('User', id);
    return toUserResponse(user);
  },
};
```

Rules:
- Service is an object with async methods, not a class
- Queries DB via Drizzle, throws typed errors
- Returns API-shaped data (maps DB → response shape)
- Never accesses `req` or `res`

---

## Middleware Chain Order

Mounted in `server.ts`:

```typescript
// 1. Global middleware
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ ... }));

// 2. Public routes (no auth required)
app.use('/api/v1/auth', authRoutes);
app.get('/health', healthCheck);

// 3. Protected routes (auth required)
app.use('/api/v1/users', authenticate, usersRoutes);
app.use('/api/v1/roles', authenticate, rolesRoutes);
app.use('/api/v1/profiles', authenticate, profilesRoutes);
app.use('/api/v1/catalog', authenticate, catalogRoutes);
app.use('/api/v1/employability', authenticate, employabilityRoutes);

// 4. Error handler (MUST be last)
app.use(errorHandler);
```

Per-route middleware order:

```
authenticate → authorize('permission.code') → validate({ body, params, query }) → controller
```

---

## Shared Package Integration

### How `@bopacorp/shared` connects to API

```
@bopacorp/shared          bopacorp-api
─────────────────         ─────────────────────────
request.ts schemas   →    validate middleware
response.ts schemas  →    controller response typing
enums.ts             →    service business logic
api-response.ts      →    controller envelope format
primitives.ts        →    reused in both packages
```

### Schema ownership

| Schema type | Lives in | Used by |
|-------------|----------|---------|
| Request validation (Zod) | `@bopacorp/shared` | API validate middleware |
| Response shape (Zod) | `@bopacorp/shared` | API controller + frontend types |
| DB schema (Drizzle) | `bopacorp-api/src/db/schema/` | API service layer only |
| Enums | `@bopacorp/shared` | Both API + frontend |

### Adding an endpoint — full flow

Example: `POST /api/v1/users`

1. **`@bopacorp/shared/auth/request.ts`** — `CreateUserRequestSchema` (already exists)
2. **`@bopacorp/shared/auth/response.ts`** — `UserResponseSchema` (already exists)
3. **`bopacorp-api/src/modules/users/users.routes.ts`**:
   ```typescript
   router.post('/', validate({ body: CreateUserRequestSchema }), controller.create);
   ```
4. **`bopacorp-api/src/modules/users/users.controller.ts`**:
   ```typescript
   async create(req, res) {
     const data = req.body as CreateUserRequest;
     const user = await userService.create(data);
     res.status(201).json({ success: true, data: user });
   }
   ```
5. **`bopacorp-api/src/modules/users/users.service.ts`**:
   ```typescript
   async create(data: CreateUserRequest) {
     // check uniqueness, hash password, insert, return response shape
   }
   ```

---

## Error Code Reference

Standard `code` values used across all endpoints:

| Code | HTTP | Meaning |
|------|------|---------|
| `BAD_REQUEST` | 400 | Malformed request |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `RESOURCE_NOT_FOUND` | 404 | Entity not found |
| `CONFLICT` | 409 | Duplicate resource (email, username, etc.) |
| `VALIDATION_ERROR` | 422 | Request body/params/query failed Zod validation |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error (details never exposed) |

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Try/catch in controller | Remove — global error handler catches |
| Throwing raw `new Error()` in service | Use typed `HttpError` subclass |
| Validation in controller | Move to `validate()` middleware |
| Returning DB model directly | Map to response shape (strip `passwordHash`, `deletedAt`, etc.) |
| `camelCase` in URLs | Use `kebab-case`: `/catalog-items` not `/catalogItems` |
| Mixing 200/204 for DELETE | Pick one per project — we use `200` with message body |
| Business logic in controller | Move to service |
| Exposing stack traces in production | Error handler hides details for 5xx |
| `PUT` for partial update | Use `PATCH` — `PUT` replaces entire resource/relation |
| Hardcoding error messages | Use error classes with consistent `code` field |
