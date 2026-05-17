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

---

## Login Flow

```
POST /api/v1/auth/login
{ email, password }
       │
       ▼
1. SELECT user WHERE email = ? AND deleted_at IS NULL
2. Check locked_until — if still locked, return 401
3. bcrypt.compare(password, user.password_hash)
4. On fail:
   a. Increment failed_login_attempts
   b. If attempts >= 5 → set locked_until = NULL (permanent lock)
   c. INSERT login_log (status='failed')
   d. Return 401
5. On success:
   a. Reset failed_login_attempts = 0, locked_until = NULL
   b. Set last_login_at = now()
   c. INSERT login_log (status='success')
   d. Generate access token (JWT, 15 min)
   e. Generate refresh token (opaque, crypto.randomBytes)
   f. INSERT INTO auth_tokens (user_id, token, type='refresh', expires_at=now+7d)
   g. Return { user, tokens: { accessToken, refreshToken, expiresIn } }
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
3. Query user with roles and permissions:
   SELECT user.*, user_roles.*, roles.*, role_permissions.*, permissions.*
   WHERE user.id = userId
   AND user.deleted_at IS NULL
   AND user.is_active = true
4. Build req.user:
   {
     id: userId,
     email: user.email,
     roles: ['admin', 'advisor'],
     permissions: ['users.create', 'users.read', ...]
   }
5. next()
```

If any step fails → `throw new UnauthorizedError()`.

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
│     a. SELECT FROM auth_tokens WHERE token = ?                    │
│     b. Verify type='refresh' AND expires_at > now()               │
│     c. Verify user is_active = true AND deleted_at IS NULL        │
│     d. DELETE old refresh token  ← rotation                       │
│     e. Sign new access JWT (15 min)                               │
│     f. Generate new refresh opaque string                         │
│     g. INSERT new auth_tokens row                                 │
│     h. Return { accessToken, refreshToken, expiresIn }           │
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
DELETE FROM auth_tokens WHERE token = ?

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
2. bcrypt.hash(newPassword) → UPDATE user.password_hash
3. DELETE FROM auth_tokens WHERE user_id = ? AND type = 'refresh'

All sessions across all devices are invalidated. User must re-login everywhere.
```

---

## Forgot / Reset Password

```
POST /api/v1/auth/forgot-password     POST /api/v1/auth/reset-password
{ email }                             { token, newPassword }
       │                                     │
       ▼                                     ▼
1. Find user by email                 1. Find auth_token WHERE token = ?
2. Generate opaque reset token           AND type = 'password_reset'
3. INSERT auth_tokens                    AND expires_at > now()
   (type='password_reset',            2. bcrypt.hash(newPassword)
    expires_at=now+15min)             3. UPDATE user.password_hash
4. Always return success              4. DELETE ALL user's password_reset tokens
   (don't reveal email existence)     5. Return success
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

Auth routes (no authenticate middleware — they are login endpoints):
  validate(schemas) → controller

Exception: PATCH /auth/change-password requires authenticate (user must be logged in).
```
