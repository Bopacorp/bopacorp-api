# Auth Architecture — BOPADIGITAL API

Access + Refresh token pattern for stateless authentication with revocable sessions.

---

## Token Pair

| Token | Type | Lifetime | Storage | Revocable | Used for |
|-------|------|----------|---------|:---:|----------|
| Access | JWT | `JWT_EXPIRES_IN` (15 min) | Client memory only | No | Every API request (fast, no DB hit) |
| Refresh | Opaque string | `JWT_REFRESH_EXPIRES_IN` (7 days) | `auth_tokens` table | Yes | Silent renewal of access token |

**Access token** lives short because it can't be revoked — if stolen, exposure window is 15 minutes.

**Refresh token** is DB-backed so the server can revoke it (logout, password change, admin deactivation, token rotation replay detection).

**Security enhancement**: Refresh tokens are stored as `SHA-256` hashes in the database. The raw opaque string is only ever returned to the client. If the database is compromised, the attacker cannot reuse the stored hashes directly.

---

## Login Flow

```
POST /api/v1/auth/login
{ email, password }
       │
       ▼
1. Normalize email (lowercase + trim) via Zod transform
2. IP-based rate limit check (10 failed attempts per IP in 15 min → 429)
3. SELECT user WHERE email = ? AND deleted_at IS NULL
4. Check locked_until — if still locked, return 401 with lock message
5. If lock expired, auto-clear failed_login_attempts and locked_until
6. bcrypt.compare(password, user.password_hash)
7. On fail:
   a. Increment failed_login_attempts
   b. Exponential lockout (2→1min, 3→5min, 5→15min, 7→30min, 10→1h)
   c. INSERT login_log (status='failed', ip, user_agent)
   d. Return 401 (generic "Invalid credentials")
8. On success:
   a. Reset failed_login_attempts = 0, locked_until = NULL
   b. Set last_login_at = now()
   c. INSERT login_log (status='success', ip, user_agent)
   d. Cleanup expired refresh tokens for this user
   e. Generate access token (JWT, 15 min)
   f. Generate refresh token (opaque, crypto.randomBytes 32)
   g. Hash refresh token with SHA-256
   h. INSERT INTO auth_tokens (user_id, token_hash, type='refresh', expires_at=now+7d)
   i. Return { user, tokens: { accessToken, refreshToken, expiresIn } }
```

### JWT access token payload

```json
{
  "sub": "uuid",
  "email": "user@example.com",
  "iat": 1715900000,
  "exp": 1715900900
}
```

Self-contained: `sub` is the user ID. Verification is pure `jwt.verify(token, SECRET)` — no DB query.

---

## Authenticate Middleware (every protected request)

```
Request:
  GET /api/v1/users
  Authorization: Bearer eyJhbGciOi...
       │
       ▼
1. Extract "Bearer <token>" from Authorization header
2. jwt.verify(token, JWT_SECRET)
   → { sub: userId, email }
3. Query user with active roles:
   SELECT user.*, user_roles.*, roles.*
   WHERE user.id = userId
   AND user.deleted_at IS NULL
   AND user.is_active = true
   AND user_roles.is_active = true
4. Query role_permissions + permissions for those role IDs
   WHERE role_permissions.is_granted = true
5. Build req.user:
   {
     id: userId,
     email: user.email,
     roles: ['admin', 'advisor'],
     permissions: ['users.create', 'users.read', ...]
   }
6. next()
```

If any step fails → `throw new UnauthorizedError()`.

**Important**: `authenticate` is mounted per-route, not globally. Only routes that need auth get it.

---

## Authorize Middleware (RBAC permission check)

`authorize` runs **after** `authenticate` and checks that `req.user` has **all** required permissions.

```typescript
// Single permission
router.post('/', authenticate, authorize('users.create'), validate({ body: CreateSchema }), controller.create);

// Multiple permissions (ALL must be present)
router.delete('/:id', authenticate, authorize('users.delete', 'users.admin'), validate({ params: IdSchema }), controller.remove);
```

If `req.user` is missing → `throw new ForbiddenError('Authentication required')`.
If permissions don't match → `throw new ForbiddenError('Insufficient permissions')`.

### Permission naming convention

Permissions are defined in the `permissions` table with `code` values like:

```
users.create
users.read
users.update
users.delete
roles.create
roles.admin
catalog_items.create
content_blocks.update
```

Always use the full `module.action` format.

---

## How to Protect a Route — Full Example

```typescript
import { Router } from 'express';
import { authenticate } from '@shared/middleware/authenticate.js';
import { authorize } from '@shared/middleware/authorize.js';
import { validate } from '@shared/middleware/validate.js';
import { CreateUserRequestSchema, IdParamSchema } from '@shared/schemas/users.js';
import { usersController } from './users.controller.js';

export const usersRoutes = Router();

// Public routes (no auth)
// none in this module

// Protected routes — authenticate first, then check permissions, then validate
usersRoutes.get('/', authenticate, authorize('users.read'), usersController.list);
usersRoutes.get('/:id', authenticate, authorize('users.read'), validate({ params: IdParamSchema }), usersController.getById);
usersRoutes.post('/', authenticate, authorize('users.create'), validate({ body: CreateUserRequestSchema }), usersController.create);
usersRoutes.patch('/:id', authenticate, authorize('users.update'), validate({ params: IdParamSchema, body: UpdateSchema }), usersController.update);
usersRoutes.delete('/:id', authenticate, authorize('users.delete'), validate({ params: IdParamSchema }), usersController.remove);
```

### Middleware order matters

```
authenticate → authorize → validate → controller
```

- `authenticate` must be first — it builds `req.user` that `authorize` depends on.
- `authorize` must be before `validate` — no point validating input if the user can't access the endpoint.
- `validate` is last before the controller — controller receives already-validated data.

---

## Accessing req.user in Controllers

After `authenticate` (and optionally `authorize`), `req.user` is guaranteed to exist:

```typescript
async changePassword(req: Request, res: Response) {
  const userId = req.user!.id;        // safe — authenticate ensures this exists
  const data = req.body as ChangePasswordRequest;
  await authService.changePassword(userId, data);
  res.json({ success: true, data: { message: 'Password changed' } });
}
```

`req.user` shape (defined in `src/shared/types/express.d.ts`):

```typescript
{
  id: string;
  email: string;
  roles: string[];        // role slugs, e.g. ['admin', 'advisor']
  permissions: string[];  // permission codes, e.g. ['users.create', 'users.read']
}
```

---

## Silent Token Refresh

The client intercepts 401 responses and refreshes transparently:

```
┌─ Client makes API call with expired access token ─────────────────┐
│                                                                    │
│  1. GET /api/v1/users (Authorization: Bearer expired-jwt)         │
│  2. Server returns 401 UNAUTHORIZED                               │
│  3. Client 401 interceptor fires                                  │
│  4. Client calls POST /api/v1/auth/refresh                        │
│     { refreshToken: storedOpaqueString }                          │
│                         │                                         │
│  5. Server:              ▼                                        │
│     a. Hash submitted refresh token with SHA-256                  │
│     b. SELECT FROM auth_tokens WHERE token_hash = ?               │
│     c. Verify type='refresh' AND expires_at > now()               │
│     d. Verify user is_active = true AND deleted_at IS NULL        │
│     e. DELETE old refresh token  ← rotation                       │
│     f. Sign new access JWT (15 min)                               │
│     g. Generate new refresh opaque string                           │
│     h. Hash new refresh token with SHA-256                        │
│     i. INSERT new auth_tokens row                                 │
│     j. Return { accessToken, refreshToken, expiresIn }           │
│                         │                                         │
│  6. Client stores new token pair                                  │
│  7. Client retries original GET /api/v1/users with new token      │
│  8. Success                                                       │
│                                                                    │
│  User experience: stayed logged in with zero interaction.         │
└────────────────────────────────────────────────────────────────────┘
```

---

## Token Rotation and Replay Detection

```
Normal rotation:
  Refresh token "ABC" → server deletes "ABC", inserts "DEF"
  Next refresh uses "DEF" → server deletes "DEF", inserts "GHI"
  ✓

Replay attack (stolen token):
  Attacker has token "ABC"
  Real user refreshes first → "ABC" deleted, "XYZ" created
  Attacker tries refresh with "ABC" → NOT FOUND (already deleted)
  → Detect: this is a reuse attempt on a rotated token
  → Server deletes ALL refresh tokens for this user
  → User logged out everywhere, must re-login
```

Implementation note: when a refresh token is not found, query whether any token was recently deleted for the same user. If the submitted token matches a previously rotated one → replay attack.

---

## Logout

```
POST /api/v1/auth/logout
{ refreshToken: "opaque..." }
       │
       ▼
1. Hash submitted token with SHA-256
2. DELETE FROM auth_tokens WHERE token_hash = ? AND type = 'refresh'

That specific token is gone. Other devices/sessions keep their own refresh tokens.
```

---

## Password Change

```
PATCH /api/v1/auth/change-password
{ currentPassword, newPassword }
       │
       ▼
1. bcrypt.compare(currentPassword, user.password_hash)
2. Validate new password strength (8+ chars, upper, lower, number, special)
3. bcrypt.hash(newPassword, 12) → UPDATE user.password_hash
4. DELETE FROM auth_tokens WHERE user_id = ? AND type = 'refresh'
5. INSERT audit_log (operation='U', table='users', notes='Password changed by user')

All sessions across all devices are invalidated. User must re-login everywhere.
```

---

## Forgot / Reset Password

```
POST /api/v1/auth/forgot-password     POST /api/v1/auth/reset-password
{ email }                             { token, newPassword }
       │                                     │
       ▼                                     ▼
1. Normalize email                    1. Hash submitted token with SHA-256
2. Find user by email                 2. Find auth_token WHERE token_hash = ?
3. Generate opaque reset token           AND type = 'password_reset'
4. Hash token with SHA-256               AND expires_at > now()
5. INSERT auth_tokens                 3. Validate new password strength
   (type='password_reset',            4. bcrypt.hash(newPassword, 12)
    token_hash=sha256(...),           5. UPDATE user.password_hash
    expires_at=now+15min)             6. DELETE ALL user's password_reset tokens
6. Always return success              7. DELETE ALL user's refresh tokens
   (don't reveal email existence)     8. INSERT audit_log (operation='U')
                                      9. Return success
```

---

## Token Lifecycle

```
     Login
       │
       ├──► Access token (15 min, JWT, in-memory)
       │      │
       │      ├──► Every API call → Authorization header
       │      │
       │      └──► Expires → 401 → silent refresh via refresh token
       │
       ├──► Refresh token (7 days, opaque, DB-backed)
              │
              ├──► Used only for POST /auth/refresh
              │
              ├──► Rotated on every refresh call
              │
              ├──► Expires or revoked → user must re-login
              │
              └──► Revocation triggers:
                    - POST /auth/logout (single token)
                    - PATCH /auth/change-password (all tokens)
                    - Admin sets user.is_active = false
                    - Replay detection (all tokens)
```

---

## Middleware Chain

```
Server-level (server.ts):
  pinoHttp → helmet → cors → json → rateLimit

Route-level (per endpoint):
  authenticate → authorize('permission.code') → validate(schemas) → controller
```

Auth routes (no authenticate middleware — they are login endpoints):
  validate(schemas) → controller

Exception: PATCH /auth/change-password requires authenticate (user must be logged in).

---

## Security Checklist for Developers

- [ ] Always use `authenticate` before `authorize` — order matters.
- [ ] Never trust `req.user` without `authenticate` — it can be undefined.
- [ ] Use `authorize('permission.code')` for every mutating endpoint (POST/PATCH/DELETE).
- [ ] Return generic error messages on auth failures — never reveal if an email exists.
- [ ] Refresh tokens are hashed with SHA-256 before storage — never store raw tokens.
- [ ] Passwords require 8+ chars with upper, lower, number, and special character.
- [ ] IP rate limiting is active — test login flows with care to avoid lockouts.

---

## Files

| File | Purpose |
|------|---------|
| `src/modules/auth/auth.routes.ts` | Route definitions for all auth endpoints |
| `src/modules/auth/auth.controller.ts` | Request parsing and response formatting |
| `src/modules/auth/auth.service.ts` | Business logic: login, refresh, password management |
| `src/shared/middleware/authenticate.ts` | JWT verification + `req.user` construction |
| `src/shared/middleware/authorize.ts` | RBAC permission checking |
| `src/shared/schemas/auth.ts` | Zod validation schemas for auth requests |
