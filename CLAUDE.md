# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RESTful API for BOPACORP S.A. — B2B telecom sales platform (Movistar Ecuador partner). Powers two clients: web CRM/CMS for supervisors and mobile field app for sales advisors.

Stack: Express 5 + TypeScript 6 + Drizzle ORM + PostgreSQL (Supabase) + Zod 4 + JWT auth + Pino logging. Node.js 22+. ESM only.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Lint + fix | `npm run lint:fix` |
| Format | `npm run format` |
| Lint + format + typecheck | `npm run check` |
| Run tests | `npm test` |
| Single test file | `npx vitest run src/path/to/file.test.ts` |
| Tests with coverage | `npx vitest --coverage` |
| Generate migration | `npm run db:generate` |
| Apply migrations | `npm run db:migrate` |
| Push schema (no migration) | `npm run db:push` |
| DB GUI | `npm run db:studio` |

## Architecture

**Entry point**: `src/index.ts` → loads dotenv, validates env via Zod (`src/config/env.ts`), boots `src/server.ts`.

**Module pattern** — each business domain lives in `src/modules/[name]/` with exactly 3 files:
- `[name].routes.ts` — route definitions + middleware wiring
- `[name].controller.ts` — request parsing + response formatting
- `[name].service.ts` — business logic + DB queries

No `*.schema.ts` in modules — all Zod validation schemas live in `@bopacorp/shared`.

**Current modules**: `auth`, `users`, `roles`, `profiles`, `catalog`, `employability`.

**Dependency flow** (one-way): `routes → controller → service → db`. Never reverse. Never cross-import between modules.

**Shared code** in `src/shared/` (middleware, errors, utils, types). Library singletons in `src/lib/` (db client, logger). Full module rules in `docs/project-structure.md`.

**Database**: Drizzle ORM with `node-postgres` driver. Schema defined in TypeScript at `src/db/schema/`. Config at `drizzle.config.ts`. Migrations output to `drizzle/`. Two connection strings: `DATABASE_URL` (pooled, app queries) and `DIRECT_URL` (direct, migrations). Multi-schema PostgreSQL via `pgSchema()`.

**DB schemas** — 4 PostgreSQL schemas, one Drizzle file each:

| Schema | File | Tables | Source SQL |
|--------|------|--------|-----------|
| `app_auth` | `auth.ts` | 9 tables, 4 enums | `models/01_auth_rbac.sql` |
| `core` | `core.ts` | 2 tables | `models/02_profiles.sql` |
| `catalog` | `catalog.ts` | 20 tables | `models/04_catalog.sql` |
| `employability` | `employability.ts` | 4 tables, 1 enum | `models/07_employability.sql` |

Relations live in `relations.ts` (one file for all schemas — avoids circular imports).

## Critical Rules

### ESM imports require `.js` extension
```typescript
import { db } from '@lib/db.js';     // correct
import { db } from '@lib/db';        // breaks at runtime
```

### Path aliases over relative imports
`@config/*`, `@lib/*`, `@modules/*`, `@shared/*` — defined in `tsconfig.json`, resolved by `tsx` (dev), `tsc-alias` (build), `vitest.config.ts` (test). Exception: `drizzle.config.ts` at root uses relative imports (loaded by drizzle-kit directly).

### Database client
```typescript
import { db } from '@lib/db.js';
```
Schema defined in `src/db/schema/*.ts` — types inferred directly, no generate step.

### Strict TypeScript
`noUncheckedIndexedAccess` (array access returns `T | undefined`), `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (must use `import type` for type-only imports), `noUnusedLocals`, `noUnusedParameters`.

## Coding Standards

- **All code in English** — variable names, function names, error messages, log messages, DB fields, API endpoints.
- **No comments** — write self-explanatory code instead. Extract named functions, use clear variable names. Only exceptions: external links, legal requirements, complex math.
- **No emojis in source files** — no emojis in `.ts`, `.js`, test files, config files, or API responses.
- **No `any`** — Biome enforces `noExplicitAny: error`.

## Formatting (Biome)

2-space indent, single quotes, semicolons always, trailing commas ES5, 100 char line width, LF line endings. Pre-commit hook runs Biome via husky + lint-staged.
