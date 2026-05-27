# Audit Report — Auth Module

**Scope:** `src/modules/auth/` + `src/shared/middleware/authenticate.ts`
**Date:** 2026-05-26
**Auditor:** AI Code Review

---

## Critical

### 1. Silent empty-string fallback for `req.user.id` — FIXED

**File:** `auth.controller.ts:54`
**Finding:**
```typescript
const userId = req.user?.id ?? '';
```
If the `authenticate` middleware fails or is bypassed, this silently passes an empty string to the service, producing a confusing `NotFoundError('User', '')` instead of a proper `401 Unauthorized`.
**Fix:** Throw `UnauthorizedError` if `req.user` is missing.

**Status:** Resolved in commit. Controller now explicitly checks `if (!req.user)` and throws `UnauthorizedError('Authentication required')` before accessing `req.user.id`.

### 2. No database transactions for multi-step operations

**Files:** `auth.service.ts`
**Finding:** The `login`, `resetPassword`, and `changePassword` methods perform multiple DB operations (update user, insert log, delete tokens, insert token, etc.) without a transaction. If any step fails, partial state persists.
**Fix:** Wrap multi-step operations in `db.transaction()`.

### 3. `authenticate` middleware hits the database twice per request

**File:** `src/shared/middleware/authenticate.ts`
**Finding:** Every authenticated request triggers (1) a user fetch with roles, then (2) a separate permissions query. This doubles query overhead on every protected endpoint.
**Fix:** Cache permissions in JWT payload, or fetch permissions in a single query.

### 4. Missing rate limiting on password endpoints

**File:** `auth.routes.ts`
**Finding:** Only `/login` has rate limiting. `/forgot-password`, `/reset-password`, and `/change-password` are unprotected, leaving them open to brute-force and enumeration attacks.
**Fix:** Add `express-rate-limit` or custom IP-based rate limiting to all password-related routes.

---

## High

### 5. Controllers use `as` type assertions instead of typed Request generics

**File:** `auth.controller.ts`
**Finding:**
```typescript
const data = req.body as LoginRequest;
```
Validation middleware already parses and types the data, but TypeScript is not informed because the Request interface lacks generics.
**Fix:** Use `Request<Params, ResBody, ReqBody, ReqQuery>` generics to eliminate unsafe casts.

### 6. Inline type in `forgotPassword` controller

**File:** `auth.controller.ts:37`
**Finding:**
```typescript
const { email } = req.body as { email: string };
```
Inconsistent with the rest of the module, which imports request types from `@bopacorp/shared`.
**Fix:** Import and use `ForgotPasswordRequest` type.

### 7. Mixed query styles between relational and raw SQL-like

**Files:** `auth.service.ts`, `authenticate.ts`
**Finding:** `login()` uses `db.select().from().innerJoin()` (SQL-like), while `authenticate.ts` uses `db.query.rolePermissions.findMany({ with: ... })` (relational). Inconsistent ORM usage across the codebase makes maintenance harder.
**Fix:** Standardize on one style per query type (relational queries for simple lookups, SQL-like for complex aggregations).

### 8. `generateAccessToken` suppresses type checking with `as SignOptions`

**File:** `auth.service.ts:30-34`
**Finding:**
```typescript
return jwt.sign({ sub: userId, email }, env.JWT_SECRET, {
  expiresIn: env.JWT_EXPIRES_IN,
} as SignOptions);
```
The `as` cast hides potential runtime mismatches between `env.JWT_EXPIRES_IN` and the expected type.
**Fix:** Properly type the options object or validate the environment variable format on startup.

---

## Medium

### 9. `bcrypt` rounds are hardcoded in multiple places

**File:** `auth.service.ts`
**Finding:** `bcrypt.hash(..., 12)` appears in `resetPassword` and `changePassword`. If the work factor needs to change, it must be updated in every location.
**Fix:** Extract to a shared constant (e.g., `BCRYPT_ROUNDS`).

### 10. Token type string literals are not type-safe

**File:** `auth.service.ts`
**Finding:** `'refresh'`, `'password_reset'`, etc. are used as raw strings in multiple places. These match `tokenTypeEnum` values but are not validated at compile time because the Drizzle enum is not imported.
**Fix:** Import and use `tokenTypeEnum` values or define a TypeScript union type.

### 11. No cleanup of old password reset tokens on `forgotPassword` success

**File:** `auth.service.ts:376-378`
**Finding:** Only deletes tokens of type `password_reset` for the user, but if the user had multiple pending requests, all are cleared. This is intentional but not documented. If the goal is only to clear previous tokens, a comment should explain why.
**Fix:** Add an inline comment clarifying the cleanup intent.

---

## Low

### 12. `parseTimeToSeconds` returns `0` for invalid input

**File:** `auth.service.ts:40-57`
**Finding:** An invalid `JWT_EXPIRES_IN` silently falls back to `0`, which then triggers hardcoded defaults. This can mask misconfigured environment variables.
**Fix:** Validate `env.JWT_EXPIRES_IN` and `env.JWT_REFRESH_EXPIRES_IN` in `config/env.ts` with Zod.

### 13. `createLoginLog` and `createAuditLog` are module-level helpers, not in a shared location

**File:** `auth.service.ts`
**Finding:** These are generic logging/auditing functions that could be reused by other modules, but they are defined inside the auth module.
**Fix:** Move to `src/shared/utils/` or a dedicated `audit.service.ts` when other modules need auditing.

### 14. `getClientInfo` helper is duplicated logic

**File:** `auth.controller.ts:11-16`
**Finding:** Every authenticated action extracts `ipAddress` and `userAgent` manually. This pattern will repeat in every module that needs auditing.
**Fix:** Extract to `src/shared/utils/` or attach normalized client info to `req` in a middleware.

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| **Now** | Add rate limiting to all password routes |
| ~~**Now**~~ | ~~Replace `req.user?.id ?? ''` with explicit `UnauthorizedError` throw~~ — **FIXED** |
| **Next** | Wrap multi-step auth flows in `db.transaction()` |
| **Next** | Standardize query style and reduce per-request DB calls in `authenticate` |
| **Later** | Extract reusable audit/logging helpers to shared utils |
| **Later** | Validate JWT time formats in environment schema |
