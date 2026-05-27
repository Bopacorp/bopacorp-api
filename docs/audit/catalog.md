# Audit Report — Catalog Module

**Scope:** `src/modules/catalog/`
**Date:** 2026-05-26
**Auditor:** AI Code Review

---

## Critical

### 1. Silent empty-string fallback for `req.user.id` — FIXED

**Files:** `catalog.controller.ts:48, 57`
**Finding:**
```typescript
req.user?.id ?? ''
```
If `authenticate` middleware is bypassed or fails, the controller silently passes an empty string as `userId` to the service, which later results in a confusing `NotFoundError` or stores `updated_by = NULL` instead of failing fast with a 401.
**Fix:** Throw `UnauthorizedError` if `req.user` is not present.

**Status:** Resolved in commit. Both occurrences now explicitly check `if (!req.user)` and throw `UnauthorizedError('Authentication required')` before accessing `req.user.id`.

---

## High

### 2. `authenticate` middleware is repeated on every route — FIXED

**File:** `catalog.routes.ts`
**Finding:** Every single route repeats `authenticate, authorize(...)` instead of mounting `authenticate` once at the router level in `server.ts`, as documented in `docs/api-conventions.md`.
**Fix:** Remove per-route `authenticate` and mount it globally in `server.ts`:
```typescript
app.use('/api/v1/catalog', authenticate, catalogRoutes);
```

**Status:** Resolved in commit. Removed `authenticate` from all 10 catalog route definitions and mounted it once in `server.ts` at the router level.

### 3. Controllers use double type assertion

**File:** `catalog.controller.ts:35`
**Finding:**
```typescript
const query = req.query as unknown as ListContentBlocksQuery;
```
This is a strong code smell. The validation middleware already parses the query, but the Request type is not generic, so TypeScript is bypassed with `unknown`.
**Fix:** Use `Request<Params, ResBody, ReqBody, ReqQuery>` generics.

### 4. Raw `new Error()` thrown in service — FIXED

**File:** `catalog.service.ts:37, 186`
**Finding:**
```typescript
if (!type) {
  throw new Error('Failed to create content type');
}
```
The global error handler converts this to `500 INTERNAL_ERROR`, but per project conventions services must only throw typed `HttpError` subclasses so clients get predictable error codes.
**Fix:** Throw `ConflictError` or `InternalServerError` subclass with a proper `code` field.

**Status:** Resolved in commit. Both occurrences replaced with `new InternalServerError()`. Added `InternalServerError` class to `http-error.ts` and updated the error handler to mask 5xx message details from clients while preserving them in server logs.

### 5. Race condition in uniqueness checks

**Files:** `catalog.service.ts` — `createContentType`, `createContentBlock`, `updateContentType`, `updateContentBlock`
**Finding:**
```typescript
const existing = await db.select().from(contentTypes).where(eq(contentTypes.code, input.code));
if (existing.length > 0) throw new ConflictError(...);
await db.insert(contentTypes).values(input);
```
Two concurrent requests can both pass the check and insert duplicate data. The database unique constraint will catch it, but the user gets an unhandled `500 INTERNAL_ERROR` (postgres unique violation) instead of a clean `409 CONFLICT`.
**Fix:** Handle the unique constraint exception explicitly, or use a transaction with `SELECT FOR UPDATE`.

---

## Medium

### 6. `disableContentType` returns `void` / `data: null`

**File:** `catalog.service.ts:77-83`
**Finding:** The controller returns `{ success: true, data: null }`, but all other PATCH endpoints return the updated resource. This inconsistency means the client cannot see the new `isActive: false` state without a follow-up GET.
**Fix:** Return the updated record so the controller can include it in the response.

### 7. No pagination on `GET /content-types`

**File:** `catalog.service.ts:13-15`
**Finding:**
```typescript
export async function listContentTypes() {
  return db.select().from(contentTypes).orderBy(contentTypes.code);
}
```
This returns every row. If the catalog grows, it becomes a performance and memory bottleneck. The `GET /content-blocks` endpoint is paginated, but `GET /content-types` is not.
**Fix:** Apply the same pagination pattern used in `listContentBlocks`.

### 8. Unnecessary truthy checks for Drizzle conditions

**File:** `catalog.service.ts:117-128`
**Finding:**
```typescript
if (query.contentTypeId) {
  const cond = eq(contentBlocks.contentTypeId, query.contentTypeId);
  if (cond) conditions.push(cond);  // eq() always returns an object — always truthy
}
```
These `if (cond)` checks add noise without value.
**Fix:** Remove the inner `if (cond)` checks.

### 9. Manual field-by-field partial update mapping

**File:** `catalog.service.ts:55-62`, `insertInputToUpdateData()`
**Finding:** Updates are mapped manually field by field:
```typescript
if (input.code !== undefined) updateData.code = input.code;
if (input.name !== undefined) updateData.name = input.name;
// ...
```
This is fragile: adding a new column to the schema requires updating every patch method.
**Fix:** Use a generic utility to strip `undefined` values from the input object, or use Drizzle's built-in behavior when `undefined` fields are ignored.

### 10. Search string interpolation in `ilike`

**File:** `catalog.service.ts:123-126`
**Finding:**
```typescript
ilike(contentBlocks.contentKey, `%${query.search}%`)
```
While Drizzle parameterizes this under the hood, the pattern relies on ORM implementation details and could be misused elsewhere.
**Fix:** Use Drizzle's `sql` helper or ensure all dynamic parts are passed as bound parameters explicitly.

---

## Low

### 11. `CONTENT_BLOCK_RESPONSE_COLUMNS` constant is defined mid-file

**File:** `catalog.service.ts:86-95`
**Finding:** A column-mapping constant is defined between two exported functions, breaking the natural top-down reading flow.
**Fix:** Move constants and helpers to the top of the file or to a shared location.

### 12. `getSortColumn` is a local helper that will be duplicated in every paginated module

**File:** `catalog.service.ts:97-112`
**Finding:** The sort-column switch will be repeated for every entity that supports pagination.
**Fix:** Extract to `src/shared/utils/pagination.ts` as a generic helper that accepts a sortable-column map.

### 13. `listContentBlocks` builds `where` even when no conditions are needed

**File:** `catalog.service.ts:130`
**Finding:**
```typescript
const where = and(...conditions);
```
When `conditions` contains only `isNull(deletedAt)`, the extra spread is harmless but unnecessary. Drizzle handles single-condition `and()` fine, but the pattern could confuse future readers.
**Fix:** Use `and(...conditions)` directly in the query, or skip `and()` entirely when there is only one condition.

### 14. No authorization check on public content

**File:** `catalog.routes.ts`
**Finding:** Every catalog route is protected. If some content (e.g., public-facing catalog items) should be readable without authentication, there is no mechanism for that.
**Fix:** Document whether catalog is fully admin-only, or split public vs. admin routes.

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| ~~**Now**~~ | ~~Replace `req.user?.id ?? ''` with explicit `UnauthorizedError` throw~~ — **FIXED** |
| **Now** | Handle unique constraint exceptions to return `409 CONFLICT` instead of `500` |
| ~~**Now**~~ | ~~Replace raw `new Error()` in `createContentType` with typed `HttpError`~~ — **FIXED** |
| ~~**Next**~~ | ~~Mount `authenticate` globally in `server.ts` and remove per-route repetition~~ — **FIXED** |
| **Next** | Add pagination to `GET /content-types` |
| **Next** | Return updated record from `disableContentType` |
| **Later** | Extract `getSortColumn` to shared pagination utils |
| **Later** | Create a generic partial-update utility to replace manual field mapping |
