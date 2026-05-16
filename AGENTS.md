# AGENTS.md - BOPADIGITAL API

## Quick Reference

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Lint + fix | `npm run lint:fix` |
| Format | `npm run format` |
| Lint + format + typecheck | `npm run check` |
| Test | `npm test` |
| Single test | `npx vitest run src/path/to/file.test.ts` |
| Generate migration | `npm run db:generate` |
| Apply migrations | `npm run db:migrate` |
| Push schema (no migration) | `npm run db:push` |
| DB GUI | `npm run db:studio` |

## Critical Setup Notes

### 1. ESM + TypeScript Configuration

- **Module system**: ESM only (`"type": "module"` in package.json)
- **tsconfig**: `module: "nodenext"`, `moduleResolution: "nodenext"`
- **Import syntax**: Always use `.js` extensions in imports, even for `.ts` files
  ```typescript
  import { db } from '@lib/db.js';    // correct
  import { db } from '@lib/db';       // breaks at runtime
  ```

### Path Aliases

Use path aliases instead of relative imports:

```typescript
import { db } from '@lib/db.js';
import { logger } from '@lib/logger.js';
import { users } from '../db/schema/auth.js';  // only within src/db/
```

Available aliases: `@config/*`, `@lib/*`, `@modules/*`, `@shared/*`.

- **Development**: `tsx` resolves from `tsconfig.json`
- **Production**: `tsc-alias` rewrites during build
- **Testing**: `vitest.config.ts` handles resolution

**Exception**: `drizzle.config.ts` at root uses relative imports (loaded by drizzle-kit directly).

### 2. Drizzle ORM Configuration

**Files:**
- `drizzle.config.ts` — Drizzle Kit config (migrations, push, studio)
- `src/db/schema/*.ts` — Schema definitions (one file per PostgreSQL schema)
- `src/db/schema/relations.ts` — All relations in one file
- `src/db/schema/index.ts` — Barrel export
- `src/lib/db.ts` — Database client singleton (lazy pool + error recovery)
- `drizzle/` — Generated migration SQL output

**Environment:**
- `DATABASE_URL` — Pooled connection (app queries)
- `DIRECT_URL` — Direct connection (migrations)

**Import:**
```typescript
import { db } from '@lib/db.js';

const user = await db.query.users.findFirst({
  where: eq(users.id, id),
  with: { profile: true, userRoles: { with: { role: true } } },
});
```

Types are inferred directly from schema — no generate step needed.

### 3. TypeScript Strictness

Very strict settings. Common gotchas:
- `noUncheckedIndexedAccess`: `arr[0]` is `T | undefined`
- `exactOptionalPropertyTypes`: `{ foo?: undefined }` !== `{ }`
- `verbatimModuleSyntax`: `import type` required for type-only imports
- `noUnusedLocals` / `noUnusedParameters`: dead code = compile error

### 4. Project Structure

```
src/
├── config/env.ts              # Zod-validated environment
├── db/schema/                 # Drizzle schema definitions
│   ├── auth.ts                # auth schema (9 tables, 4 enums)
│   ├── core.ts                # core schema (2 tables)
│   ├── catalog.ts             # catalog schema (20 tables)
│   ├── employability.ts       # employability schema (4 tables, 1 enum)
│   ├── relations.ts           # All relations (auth + core + catalog + employability)
│   └── index.ts               # Barrel export
├── lib/
│   ├── db.ts                  # Database client singleton
│   └── logger.ts              # Pino logger
├── modules/                   # Business domain modules (3 files each)
│   ├── auth/                  # Login, logout, tokens, password reset
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   └── auth.service.ts
│   ├── users/                 # CRUD users, assign/remove roles
│   │   └── ...
│   ├── roles/                 # CRUD roles, permissions, modules (RBAC admin)
│   │   └── ...
│   ├── profiles/              # Profiles, advisor-supervisor assignments
│   │   └── ...
│   ├── catalog/               # Service catalog, categories, CMS
│   │   └── ...
│   └── employability/         # Job vacancies, candidates, applications
│       └── ...
├── shared/
│   ├── middleware/             # authenticate, authorize, validate, error-handler
│   ├── errors/                # HttpError class hierarchy
│   ├── utils/                 # Pure utility functions
│   └── types/                 # Global TS declarations (express.d.ts)
├── server.ts                  # Express app + middleware + route mounting
└── index.ts                   # Entry point (dotenv + env + boot)
```

### Module Pattern

Each module has **exactly 3 files**: `routes.ts`, `controller.ts`, `service.ts`.

**No `*.schema.ts` in modules** — validation schemas live in `@bopacorp/shared`.

**Dependency flow** (one-way only):
```
routes → controller → service → db
   ↓          ↓
validate   @bopacorp/shared
middleware
```

**Never**: service imports controller, routes import db, module A imports module B's service.

Full rules: `docs/project-structure.md`

### 5. Environment

Copy `.env.example` to `.env`.

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `DIRECT_URL`: Direct PostgreSQL connection (migrations)
- `JWT_SECRET`: Min 32 chars

**Optional (with defaults):**
- `PORT` (3000), `NODE_ENV` (development), `LOG_LEVEL` (info), `LOG_PRETTY` (false)

---

## Drizzle ORM — SQL to Schema Translation Guide

Source SQL lives in `models/*.sql`. Each SQL file maps to one Drizzle schema file in `src/db/schema/`.

| SQL file | Drizzle file | PostgreSQL schema |
|----------|-------------|-------------------|
| `01_auth_rbac.sql` | `auth.ts` | `auth` |
| `02_profiles.sql` | `core.ts` | `core` |
| `04_catalog.sql` | `catalog.ts` | `catalog` |
| `07_employability.sql` | `employability.ts` | `employability` |

### Schema declaration

Each file declares its PostgreSQL schema and all tables within it:

```typescript
import { pgSchema } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const users = authSchema.table('users', {
  // columns...
});
```

### Column type mapping

| SQL | Drizzle | Notes |
|-----|---------|-------|
| `UUID DEFAULT gen_random_uuid()` | `uuid().primaryKey().defaultRandom()` | |
| `VARCHAR(N)` | `varchar({ length: N })` | Or `varchar('col_name', { length: N })` for snake_case |
| `TEXT` | `text()` | Or `text('col_name')` |
| `INTEGER` | `integer()` | Or `integer('col_name')` |
| `BOOLEAN DEFAULT TRUE` | `boolean('is_active').notNull().default(true)` | |
| `TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP` | `timestamp('created_at', { withTimezone: true }).defaultNow()` | |
| `DATE` | `date('col_name')` | Returns string by default |
| `DECIMAL(p,s)` | `decimal('col_name', { precision: p, scale: s })` | Returns string by default |
| `JSONB` | `jsonb('col_name').$type<Record<string, unknown>>()` | Type with `$type<>()` |
| `SERIAL` | `integer().primaryKey().generatedAlwaysAsIdentity()` | Rare in this project |

### Column naming — snake_case DB, camelCase TS

First argument is the DB column name. TS property name is camelCase:

```typescript
passwordHash: varchar('password_hash', { length: 255 }).notNull(),
isActive: boolean('is_active').notNull().default(true),
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
```

When DB name matches TS name (single word), omit the first argument:

```typescript
phone: varchar({ length: 20 }),
sms: integer().notNull().default(0),
```

### NOT NULL and defaults

| SQL | Drizzle |
|-----|---------|
| `NOT NULL` | `.notNull()` |
| `DEFAULT value` | `.default(value)` |
| `DEFAULT CURRENT_TIMESTAMP` | `.defaultNow()` |
| `DEFAULT gen_random_uuid()` | `.defaultRandom()` |

### UNIQUE constraints

```typescript
// Column-level unique
email: varchar({ length: 150 }).notNull().unique(),

// Composite unique (in table config)
uniqueIndex('uq_application_per_vacancy').on(t.vacancyId, t.candidateId),
```

### Foreign keys

**Same-schema FK:**
```typescript
moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
```

**Cross-schema FK** (e.g., core → auth):
```typescript
import { users } from './auth.js';

userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
```

**Self-reference** (e.g., modules.parent_id → modules.id):
```typescript
import { type AnyPgColumn } from 'drizzle-orm/pg-core';

parentId: uuid('parent_id').references((): AnyPgColumn => modules.id, { onDelete: 'set null' }),
```

### ON DELETE mapping

| SQL | Drizzle |
|-----|---------|
| `ON DELETE CASCADE` | `{ onDelete: 'cascade' }` |
| `ON DELETE RESTRICT` | `{ onDelete: 'restrict' }` |
| `ON DELETE SET NULL` | `{ onDelete: 'set null' }` |

### Primary keys

**Single column:**
```typescript
id: uuid().primaryKey().defaultRandom(),
```

**Composite PK** (in table config):
```typescript
(t) => [
  primaryKey({ columns: [t.roleId, t.permissionId] }),
]
```

### Indexes

Defined in the third argument of `table()` as an array:

```typescript
export const users = authSchema.table('users', {
  // columns...
}, (t) => [
  index('idx_users_active').on(t.isActive).where(sql`deleted_at IS NULL`),
  uniqueIndex('idx_users_email').on(t.email).where(sql`deleted_at IS NULL`),
]);
```

| SQL | Drizzle |
|-----|---------|
| `CREATE INDEX name ON ...` | `index('name').on(t.col)` |
| `CREATE UNIQUE INDEX name ON ...` | `uniqueIndex('name').on(t.col)` |
| `WHERE condition` | `.where(sql\`condition\`)` |
| Multi-column | `.on(t.col1, t.col2)` |

### CHECK constraints

```typescript
import { check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

(t) => [
  check('chk_price', sql`price >= 0`),
  check('chk_age_range', sql`max_age IS NULL OR max_age >= min_age`),
  check('chk_no_self', sql`advisor_id <> supervisor_id`),
]
```

### Enums

SQL `CHECK (col IN (...))` or custom types become `pgEnum`:

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const applicationStateEnum = pgEnum('application_state', [
  'DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED',
]);

// Usage in column
state: applicationStateEnum().notNull().default('DRAFT'),
```

### Relations

All relations live in `src/db/schema/relations.ts` to avoid circular imports between schema files.

**One-to-many:**
```typescript
export const usersRelations = relations(users, ({ many }) => ({
  authTokens: many(authTokens),
}));

export const authTokensRelations = relations(authTokens, ({ one }) => ({
  user: one(users, {
    fields: [authTokens.userId],
    references: [users.id],
  }),
}));
```

**Self-referencing (parent/children):**
```typescript
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryParent',
  }),
  children: many(categories, { relationName: 'categoryParent' }),
}));
```

**Multiple FKs to same table** (need `relationName`):
```typescript
export const advisorSupervisorsRelations = relations(advisorSupervisors, ({ one }) => ({
  advisor: one(users, {
    fields: [advisorSupervisors.advisorId],
    references: [users.id],
    relationName: 'advisor',
  }),
  supervisor: one(users, {
    fields: [advisorSupervisors.supervisorId],
    references: [users.id],
    relationName: 'supervisor',
  }),
}));
```

Both sides of a named relation must use the same `relationName` string.

### Adding a new schema file — Checklist

Example: adding `reporting` from `08_reports_notifications.sql`.

1. Read SQL file — identify tables, columns, enums, FKs, indexes, CHECK constraints
2. Create `src/db/schema/reporting.ts`:
   - Declare `pgSchema('reporting')`
   - Define enums with `pgEnum()`
   - Define tables with `reportingSchema.table()`
   - Import cross-schema tables (e.g., `users` from `./auth.js`) for FK references
3. Update `src/db/schema/relations.ts`:
   - Import new tables
   - Add relation definitions for new tables
   - Update existing relations (e.g., `usersRelations`) to include reverse references
4. Update `src/db/schema/index.ts` — add `export * from './reporting.js';`
5. Add schema name to `drizzle.config.ts` → `schemaFilter` array
6. `npm run build` — zero errors
7. `npm run lint` — zero errors
8. `npm run db:generate` — generates migration

### Querying patterns

```typescript
import { db } from '@lib/db.js';
import { eq, and, isNull } from 'drizzle-orm';
import { users } from '../db/schema/auth.js';

// Relational query (uses relations.ts)
const user = await db.query.users.findFirst({
  where: eq(users.id, id),
  with: {
    profile: true,
    userRoles: { with: { role: true } },
  },
});

// SQL-like query
const activeUsers = await db
  .select()
  .from(users)
  .where(and(eq(users.isActive, true), isNull(users.deletedAt)));

// Insert
const [newUser] = await db.insert(users).values({ ... }).returning();

// Update
await db.update(users).set({ isActive: false }).where(eq(users.id, id));

// Delete
await db.delete(authTokens).where(eq(authTokens.userId, id));
```

### Type inference from schema

No generate step. Types come directly from schema definitions:

```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from '../db/schema/auth.js';

type User = InferSelectModel<typeof users>;          // what you SELECT
type NewUser = InferInsertModel<typeof users>;        // what you INSERT
```

---

## Architecture Context

- **Pattern**: Modular monolith (4 business schemas: auth, core, catalog, employability)
- **Auth**: JWT + bcrypt, RBAC with roles/permissions
- **Validation**: `@bopacorp/shared` for all Zod request/response schemas (no schemas in API modules)
- **ORM**: Drizzle with `node-postgres` driver, multi-schema PostgreSQL
- **Logging**: Pino (JSON in prod, pretty in dev)
- **Formatting**: Biome (2-space indent, single quotes, semicolons, 100 char width)
- **Full module rules**: `docs/project-structure.md`

## Coding Standards

- **English only** — variable names, function names, error messages, log messages, DB fields, API endpoints
- **No comments** — write self-explanatory code. Extract named functions, use clear variable names
- **No emojis** in source files (`.ts`, `.js`, test files, config files, API responses)
- **No `any`** — Biome enforces `noExplicitAny: error`
- **`.js` extension** on all imports
- **`import type`** for type-only imports (enforced by `verbatimModuleSyntax`)

## Common Issues

**Error**: `Cannot use import statement outside a module`
→ Ensure file has `.ts` extension and import uses `.js` suffix

**Error**: `File is not under 'rootDir'`
→ `rootDir: "./src"` means all TS files must be in src/. Config files at root won't be compiled.

**Error**: Drizzle migration fails
→ Check `DIRECT_URL` is set (not pooled). Run `npm run db:migrate` with direct connection.

**Error**: Relation not found in query
→ Check `relations.ts` has both sides defined. Both sides of named relations need matching `relationName`.
