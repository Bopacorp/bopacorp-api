# AGENTS.md - BOPADIGITAL API

## Quick Reference

| Task | Command |
|------|---------|
| Dev server | `npx tsx watch src/server.ts` |
| Build | `tsc && tsc-alias` |
| Start | `node dist/server.js` |
| DB migrate | `npx prisma migrate dev` |
| DB GUI | `npx prisma studio` |
| Test | `npx vitest` |

## Critical Setup Notes

### 1. ESM + TypeScript Configuration

- **Module system**: ESM only (`"type": "module"` in package.json)
- **tsconfig**: `module: "nodenext"`, `moduleResolution: "nodenext"`
- **Import syntax**: Always use `.js` extensions in imports, even for `.ts` files
  ```typescript
  // Correct
  import { foo } from './lib/prisma.js'
  
  // Wrong (will fail)
  import { foo } from './lib/prisma'
  ```

### Path Aliases

Use path aliases instead of relative imports:

```typescript
// ❌ Wrong - Relative imports
import { logger } from '../../config/logger.js'
import { AppError } from '../../../shared/errors/AppError.js'

// ✅ Correct - Path aliases
import { logger } from '@config/logger.js'
import { AppError } from '@shared/errors/AppError.js'
```

Available aliases:
- `@config/*` → `src/config/*`
- `@lib/*` → `src/lib/*`
- `@modules/*` → `src/modules/*`
- `@shared/*` → `src/shared/*`

How it works:
- **Development**: `tsx` resolves aliases automatically from `tsconfig.json`
- **Production**: `tsc-alias` rewrites aliases to relative paths during build
- **Testing**: `vitest.config.ts` handles alias resolution

### 2. Prisma Configuration

Prisma uses **new config format** (Prisma 7.x+):

- **Config file**: `prisma.config.ts` (not `schema.prisma` env block)
- **Client output**: `generated/prisma/` (custom location, not node_modules)
- **Env loading**: Config file imports `dotenv/config` explicitly
- **Generate command**: `npx prisma generate` creates client at `generated/prisma/`

Import pattern:
```typescript
import { PrismaClient } from '../generated/prisma/index.js'
```

### 3. TypeScript Strictness

Very strict settings enabled. Common gotchas:
- `noUncheckedIndexedAccess`: `arr[0]` is `T | undefined`
- `exactOptionalPropertyTypes`: `{ foo?: undefined }` !== `{ }`
- `verbatimModuleSyntax`: `import type` required for type imports
- Test files excluded from compilation (`**/*.test.ts` in exclude)

### 4. Project Structure Conventions

```
src/
├── modules/[name]/          # Domain modules
│   ├── [name].routes.ts    # Express routes
│   ├── [name].controller.ts
│   ├── [name].service.ts
│   └── [name].schema.ts    # Zod validation
├── shared/
│   ├── middleware/         # Auth, roles, error handlers
│   ├── utils/
│   └── types/
├── lib/prisma.ts           # Prisma client singleton
└── index.ts                # Entry point
```

### 5. Environment Requirements

Copy `.env.example` to `.env`. Required:
- `DATABASE_URL`: PostgreSQL connection string (Supabase recommended)
- `JWT_SECRET`: Min 32 chars (`openssl rand -base64 32`)
- `PORT`: Server port (default: 3000)

### 6. Testing

- **Framework**: Vitest
- **API testing**: Supertest
- **Coverage**: `@vitest/coverage-v8` installed
- **Note**: Test files excluded from tsc compilation (run via vitest only)

## Architecture Context

- **Pattern**: Modular monolith (10 business modules)
- **Auth**: JWT + bcrypt, 5 role hierarchy
- **Validation**: Zod schemas per module
- **ORM**: Prisma with PostgreSQL
- **Uploads**: Local dev → Supabase Storage (prod)
- **Logging**: Pino (JSON in prod, pretty in dev)

## Coding Standards

### English Only

**All code must be written in English.** This includes:
- Variable names
- Function names
- Class names
- File names
- Error messages
- Log messages
- Database field names
- API endpoint names

```typescript
// ❌ Wrong
const usuario = await findUsuarioById(id)
const fechaCreacion = new Date()
throw new Error('Usuario no encontrado')

// ✅ Correct
const user = await findUserById(id)
const createdAt = new Date()
throw new Error('User not found')
```

### No Comments - Self-Explanatory Code

**Code must be self-explanatory. No comments allowed.**

If you feel the need to add a comment, refactor the code instead:
- Extract to a named function
- Rename variables for clarity
- Use early returns
- Simplify logic

```typescript
// ❌ Wrong (needs comment)
// Check if user is active and has permission
if (u.status === 1 && u.perms.includes('admin')) {
  // ...
}

// ✅ Correct (self-explanatory)
const isActive = user.status === 'active'
const hasAdminPermission = user.permissions.includes('admin')

if (isActive && hasAdminPermission) {
  // ...
}
```

**Exceptions** (very rare):
- External links or references
- Legal requirements
- Complex mathematical formulas

### No Emojis in Code

**All code files must be emoji-free.** This includes comments, strings, log messages, and documentation within source files.

```typescript
// ❌ Wrong
console.log('✅ User created successfully')
throw new Error('❌ Invalid input')

// ✅ Correct
console.log('User created successfully')
throw new Error('Invalid input')
```

Emojis belong in:
- Commit messages
- Markdown documentation (README, AGENTS.md)
- CI/CD output logs
- Terminal scripts (pre-commit hooks, etc.)

Not in:
- TypeScript/JavaScript source files
- Test files
- Configuration files (JSON, YAML)
- Database strings or API responses

## Common Issues

**Error**: `Cannot find module '../generated/prisma'`
- **Fix**: Run `npx prisma generate` after schema changes

**Error**: `Cannot use import statement outside a module`
- **Fix**: Ensure file has `.ts` extension and import uses `.js` suffix

**Error**: `File is not under 'rootDir'`
- **Fix**: `rootDir: "./src"` means all TS files must be in src/. Config files (prisma.config.ts) are OK at root but won't be compiled.
