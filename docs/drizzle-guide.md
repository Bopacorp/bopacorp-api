# Drizzle ORM Guide — BOPADIGITAL API

Standard rules for working with Drizzle in this project. All team members and AI agents must follow these conventions.

## Overview

- **ORM**: Drizzle ORM with `node-postgres` driver
- **DB**: PostgreSQL (multi-schema: `app_auth`, `core`, `catalog`, `employability`)
- **Schema location**: `src/db/schema/` (one file per PostgreSQL schema + one shared `relations.ts`)
- **Migrations**: `drizzle/` (SQL files + journal tracked in git, snapshots ignored)
- **Config**: `drizzle.config.ts` at project root

## Project Structure

```
src/db/schema/
├── auth.ts              # pgSchema('app_auth') — 9 tables, 4 enums
├── core.ts              # pgSchema('core') — 2 tables
├── catalog.ts           # pgSchema('catalog') — 20 tables
├── employability.ts     # pgSchema('employability') — 4 tables, 1 enum
├── relations.ts         # ALL relations for ALL schemas
└── index.ts             # Barrel: export * from each file

drizzle/
├── 0000_xxx.sql         # Migration SQL (tracked by git)
├── meta/
│   ├── _journal.json    # Migration index (tracked by git — needed for db:migrate)
│   └── *_snapshot.json  # Schema snapshots (NOT tracked — regenerated locally)
```

## Commands

| Task | Command | When |
|------|---------|------|
| Generate migration | `npm run db:generate` | After changing any schema file |
| Apply migrations | `npm run db:migrate` | Deploy or sync local DB |
| Push schema directly | `npm run db:push` | Quick dev sync (no migration file) |
| Open DB GUI | `npm run db:studio` | Debug/inspect data |

---

## Rules

### Rule 1: One file per PostgreSQL schema

Each PostgreSQL schema gets exactly one `.ts` file. File declares the schema and all its tables:

```typescript
import { pgSchema } from 'drizzle-orm/pg-core';

export const catalogSchema = pgSchema('catalog');

export const itemTypes = catalogSchema.table('item_types', { ... });
export const categories = catalogSchema.table('categories', { ... });
```

New schemas must be added to `drizzle.config.ts` → `schemaFilter` array.

### Rule 2: Relations in one shared file

All relations go in `src/db/schema/relations.ts`. Never define relations inside schema files.

**Why**: Schema files import from each other for cross-schema FKs (e.g., `core.ts` imports `users` from `auth.ts`). If relations were in the same files, circular imports would break the build.

```typescript
// relations.ts — imports from ALL schema files
import { users, roles, ... } from './auth.js';
import { profiles, advisorSupervisors } from './core.js';
import { catalogItems, categories, ... } from './catalog.js';
import { candidates, jobVacancies, ... } from './employability.js';
```

### Rule 3: snake_case in DB, camelCase in TypeScript

DB columns use `snake_case`. TypeScript properties use `camelCase`. First argument to column builder is the DB name:

```typescript
// DB: password_hash VARCHAR(255) NOT NULL
// TS: passwordHash
passwordHash: varchar('password_hash', { length: 255 }).notNull(),

// DB: is_active BOOLEAN NOT NULL DEFAULT TRUE
// TS: isActive
isActive: boolean('is_active').notNull().default(true),

// DB: created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
// TS: createdAt
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
```

When DB name is a single word matching the TS name, omit the first argument:

```typescript
phone: varchar({ length: 20 }),
sms: integer().notNull().default(0),
```

### Rule 4: Column type mapping

| SQL type | Drizzle builder | Notes |
|----------|----------------|-------|
| `UUID DEFAULT gen_random_uuid()` | `uuid().primaryKey().defaultRandom()` | Standard PK pattern |
| `VARCHAR(N)` | `varchar('col', { length: N })` | |
| `TEXT` | `text('col')` | |
| `INTEGER` | `integer('col')` | |
| `BOOLEAN` | `boolean('col')` | |
| `TIMESTAMPTZ` | `timestamp('col', { withTimezone: true })` | |
| `DATE` | `date('col')` | Returns string |
| `DECIMAL(p,s)` | `decimal('col', { precision: p, scale: s })` | Returns string (avoids float errors) |
| `JSONB` | `jsonb('col').$type<Record<string, unknown>>()` | Always type with `$type<>()` |

### Rule 5: Foreign keys

**Same-schema FK:**
```typescript
moduleId: uuid('module_id')
  .notNull()
  .references(() => modules.id, { onDelete: 'cascade' }),
```

**Cross-schema FK** — import table from other schema file:
```typescript
import { users } from './auth.js';

userId: uuid('user_id')
  .notNull()
  .references(() => users.id, { onDelete: 'restrict' }),
```

**Self-reference** — requires `AnyPgColumn` type annotation:
```typescript
import { type AnyPgColumn } from 'drizzle-orm/pg-core';

parentId: uuid('parent_id')
  .references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
```

### Rule 6: ON DELETE actions

| SQL | Drizzle | Use when |
|-----|---------|----------|
| `ON DELETE CASCADE` | `{ onDelete: 'cascade' }` | Child has no meaning without parent |
| `ON DELETE RESTRICT` | `{ onDelete: 'restrict' }` | Parent deletion should fail if children exist |
| `ON DELETE SET NULL` | `{ onDelete: 'set null' }` | Child survives, loses parent reference |

### Rule 7: Primary keys

**Single column (standard):**
```typescript
id: uuid().primaryKey().defaultRandom(),
```

**Composite PK** — defined in table config (third argument):
```typescript
export const rolePermissions = authSchema.table(
  'role_permissions',
  {
    roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
  ]
);
```

### Rule 8: Indexes and unique constraints

Defined in table config as array. Always prefix with `idx_` or `uq_`:

```typescript
(t) => [
  // Regular index
  index('idx_profiles_user').on(t.userId),

  // Unique index
  uniqueIndex('idx_users_email').on(t.email).where(sql`deleted_at IS NULL`),

  // Composite unique
  uniqueIndex('uq_application_per_vacancy').on(t.vacancyId, t.candidateId),

  // Partial index (with WHERE)
  index('idx_catalog_items_published').on(t.isPublished).where(sql`deleted_at IS NULL`),
]
```

Index naming convention: `idx_[table]_[column(s)]`

### Rule 9: CHECK constraints

```typescript
import { check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

(t) => [
  check('chk_price', sql`price >= 0`),
  check('chk_age_range', sql`max_age IS NULL OR max_age >= min_age`),
  check('chk_no_self_supervision', sql`advisor_id <> supervisor_id`),
]
```

Prefix: `chk_[description]`

### Rule 10: Enums over CHECK IN (...)

Prefer `pgEnum` when a column has a fixed set of values:

```typescript
// Instead of: CHECK (state IN ('DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED'))
export const applicationStateEnum = pgEnum('application_state', [
  'DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED',
]);

// Usage
state: applicationStateEnum().notNull().default('DRAFT'),
```

**Why**: Type-safe in TS, reusable across tables, Drizzle handles it natively.

### Rule 11: Relation conventions

**One-to-many** — parent has `many()`, child has `one()` with `fields`/`references`:

```typescript
// Parent side
export const usersRelations = relations(users, ({ many }) => ({
  authTokens: many(authTokens),
}));

// Child side
export const authTokensRelations = relations(authTokens, ({ one }) => ({
  user: one(users, {
    fields: [authTokens.userId],
    references: [users.id],
  }),
}));
```

**Self-referencing** — requires `relationName` on both sides:

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

**Multiple FKs to same table** — each pair needs a unique `relationName`:

```typescript
// In advisorSupervisorsRelations
advisor: one(users, { ..., relationName: 'advisor' }),
supervisor: one(users, { ..., relationName: 'supervisor' }),

// In usersRelations — reverse side must match
advisorOf: many(advisorSupervisors, { relationName: 'advisor' }),
supervisorOf: many(advisorSupervisors, { relationName: 'supervisor' }),
```

### Rule 12: Defaults and nullability

| SQL | Drizzle |
|-----|---------|
| `NOT NULL` | `.notNull()` |
| `DEFAULT value` | `.default(value)` |
| `DEFAULT CURRENT_TIMESTAMP` | `.defaultNow()` |
| `DEFAULT gen_random_uuid()` | `.defaultRandom()` |
| `DEFAULT TRUE` | `.default(true)` |
| `DEFAULT 0` | `.default(0)` |
| `DEFAULT '0'` | `.default('0')` (for decimal columns) |
| Column without NOT NULL | No `.notNull()` — nullable by default |

---

## Type Inference

Types are inferred from schema — no generate step:

```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from '../db/schema/auth.js';

type User = InferSelectModel<typeof users>;       // SELECT result shape
type NewUser = InferInsertModel<typeof users>;     // INSERT input shape
```

---

## Query Patterns

### Relational queries (uses relations.ts)

```typescript
import { db } from '@lib/db.js';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema/auth.js';

const user = await db.query.users.findFirst({
  where: eq(users.id, id),
  with: {
    profile: true,
    userRoles: { with: { role: true } },
  },
});
```

### SQL-like queries

```typescript
import { eq, and, isNull } from 'drizzle-orm';

const activeUsers = await db
  .select()
  .from(users)
  .where(and(eq(users.isActive, true), isNull(users.deletedAt)));
```

### Mutations

```typescript
// Insert
const [newUser] = await db.insert(users).values({ ... }).returning();

// Update
await db.update(users).set({ isActive: false }).where(eq(users.id, id));

// Delete
await db.delete(authTokens).where(eq(authTokens.userId, id));
```

### Transactions

```typescript
const result = await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({ ... }).returning();
  await tx.insert(profiles).values({ userId: user.id, ... });
  return user;
});
```

---

## Migration Workflow

### Creating a migration

1. Edit schema file(s) in `src/db/schema/`
2. Run `npm run db:generate`
3. Review generated SQL in `drizzle/XXXX_name.sql`
4. Apply with `npm run db:migrate`

### What gets committed

| Path | Git tracked | Purpose |
|------|------------|---------|
| `drizzle/*.sql` | Yes | Migration SQL applied to DB |
| `drizzle/meta/_journal.json` | Yes | Migration order — `db:migrate` reads this |
| `drizzle/meta/*_snapshot.json` | No | Schema snapshots — regenerated by `db:generate` |

### Multiple developers

If two devs generate migrations in parallel:
1. Both commit their `.sql` files — no conflict (different filenames)
2. `_journal.json` may conflict — resolve by keeping both entries in order
3. Snapshots are gitignored — no conflict

---

## Adding a New Schema — Checklist

Example: adding `reporting` from `08_reports_notifications.sql`.

- [ ] Read SQL file — identify tables, columns, enums, FKs, indexes, CHECK constraints
- [ ] Create `src/db/schema/reporting.ts`
  - [ ] Declare `export const reportingSchema = pgSchema('reporting');`
  - [ ] Define enums with `pgEnum()`
  - [ ] Define tables with `reportingSchema.table()`
  - [ ] Import cross-schema tables for FK references (e.g., `users` from `./auth.js`)
- [ ] Update `src/db/schema/relations.ts`
  - [ ] Import new tables
  - [ ] Add relation definitions for new tables
  - [ ] Update existing relations (e.g., `usersRelations`) with reverse references
- [ ] Update `src/db/schema/index.ts` — add `export * from './reporting.js';`
- [ ] Update `drizzle.config.ts` — add `'reporting'` to `schemaFilter`
- [ ] Run `npm run build` — zero errors
- [ ] Run `npm run lint` — zero errors
- [ ] Run `npm run db:generate` — generates migration SQL
- [ ] Review generated SQL
- [ ] Run `npm run db:migrate` — apply to DB

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Relations in schema file instead of `relations.ts` | Move to `relations.ts` — prevents circular imports |
| Missing `relationName` when two FKs point to same table | Add matching `relationName` string on both sides |
| Using `camelCase` for DB column name | First argument must be `snake_case`: `varchar('first_name', ...)` |
| Missing `.js` extension on import | Always use `.js`: `import { users } from './auth.js'` |
| Using `number` mode for decimal | Keep default (string) — avoids floating point precision loss |
| Forgot to add schema to `schemaFilter` | Add to `drizzle.config.ts` or `db:generate` won't see it |
| Snapshot committed to git | Only `_journal.json` needs tracking, snapshots are gitignored |
| CHECK as raw SQL when values are fixed | Use `pgEnum` — type-safe, reusable |
| Defining relation only on one side | Both sides required — parent `many()` and child `one()` with fields |
