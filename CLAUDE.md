# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RESTful API for BOPACORP S.A. — B2B telecom sales platform (Movistar Ecuador partner). Powers two clients: web CRM/CMS for supervisors and mobile field app for sales advisors.

Stack: Express 5 + TypeScript 6 + Prisma 7 + PostgreSQL (Supabase) + Zod 4 + JWT auth + Pino logging. Node.js 22+. ESM only.

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
| Generate Prisma client | `npx prisma generate` |
| Create migration | `npx prisma migrate dev` |
| Seed database | `npx prisma db seed` |
| Prisma GUI | `npx prisma studio` |

## Architecture

**Entry point**: `src/index.ts` → loads dotenv, validates env via Zod (`src/config/env.ts`), boots `src/server.ts`.

**Module pattern** — each business domain lives in `src/modules/[name]/`:
- `[name].routes.ts` — Express routes
- `[name].controller.ts` — request handling
- `[name].service.ts` — business logic
- `[name].schema.ts` — Zod validation schemas

**Shared code** in `src/shared/` (middleware, utils, types). Library singletons in `src/lib/` (db client, logger).

**Database**: Prisma 7 with `@prisma/adapter-pg` driver adapter. Schema at `prisma/schema.prisma`, client generated to `generated/prisma/`. Config in root `prisma.config.ts`. Two connection strings: `DATABASE_URL` (pooled, app queries) and `DIRECT_URL` (direct, migrations).

## Critical Rules

### ESM imports require `.js` extension
```typescript
import { db } from '@lib/db.js';     // correct
import { db } from '@lib/db';        // breaks at runtime
```

### Path aliases over relative imports
`@config/*`, `@lib/*`, `@modules/*`, `@shared/*` — defined in `tsconfig.json`, resolved by `tsx` (dev), `tsc-alias` (build), `vitest.config.ts` (test). Exception: files loaded by external tools (e.g., `prisma.config.ts`) must use relative imports.

### Prisma client import path
```typescript
import { PrismaClient } from '../../generated/prisma/client.js';
```
Run `npx prisma generate` after any schema change.

### Strict TypeScript
`noUncheckedIndexedAccess` (array access returns `T | undefined`), `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (must use `import type` for type-only imports), `noUnusedLocals`, `noUnusedParameters`.

## Coding Standards

- **All code in English** — variable names, function names, error messages, log messages, DB fields, API endpoints.
- **No comments** — write self-explanatory code instead. Extract named functions, use clear variable names. Only exceptions: external links, legal requirements, complex math.
- **No emojis in source files** — no emojis in `.ts`, `.js`, test files, config files, or API responses.
- **No `any`** — Biome enforces `noExplicitAny: error`.

## Formatting (Biome)

2-space indent, single quotes, semicolons always, trailing commas ES5, 100 char line width, LF line endings. Pre-commit hook runs Biome via husky + lint-staged.
