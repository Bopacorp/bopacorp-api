# Git Workflow Guide — BOPADIGITAL

Standard rules for branching, commits, and pull requests. All team members must follow these conventions.

## Branch Strategy

### Branch types

| Prefix | Purpose | Base | Merges into |
|--------|---------|------|-------------|
| `feat/` | New feature or endpoint | `main` | `main` |
| `fix/` | Bug fix | `main` | `main` |
| `refactor/` | Code restructuring (no behavior change) | `main` | `main` |
| `docs/` | Documentation only | `main` | `main` |
| `chore/` | Config, deps, tooling | `main` | `main` |
| `test/` | Adding or fixing tests | `main` | `main` |

### Branch naming

Pattern: `{type}/{module}-{short-description}`

```
feat/auth-login-endpoint
feat/catalog-crud-items
fix/users-duplicate-email-check
refactor/profiles-service-query
docs/api-conventions-update
chore/update-drizzle-deps
```

Rules:
- **kebab-case** always
- **Include module name** when touching a specific module
- **Max 50 chars** — short but descriptive
- **No ticket numbers** in branch name (put them in PR description)

### Protected branch

`main` is protected. No direct pushes. All changes go through pull requests.

---

## Commits

### Convention: Conventional Commits

Enforced by `commitlint` + `@commitlint/config-conventional` via husky hook. Commits that don't follow the format are rejected.

### Format

```
type(scope): description

[optional body]
```

### Types

| Type | When |
|------|------|
| `feat` | New feature, endpoint, or capability |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't add feature or fix bug |
| `docs` | Documentation only |
| `chore` | Build, deps, config, tooling |
| `test` | Adding or fixing tests |
| `style` | Formatting (Biome auto-fixes) |
| `perf` | Performance improvement |

### Scope

Use the module or area being changed:

```
feat(auth): add login endpoint
fix(catalog): price validation accepts negative values
refactor(users): extract password hashing to shared util
docs(drizzle): update migration workflow section
chore(deps): update drizzle-orm to 0.42
test(profiles): add service unit tests
```

When touching multiple modules or shared code:

```
feat(shared): add validate middleware
refactor(db): rename auth schema to app_auth
chore: update biome config
```

### Rules

- **Lowercase** everything — type, scope, description
- **No period** at end of description
- **Imperative mood**: "add login endpoint" not "added login endpoint"
- **Max 72 chars** for first line
- **Body** for non-obvious changes — explain WHY, not WHAT
- **One logical change per commit** — don't mix feature + refactor + formatting

### Good examples

```
feat(auth): add login endpoint with jwt token generation
fix(users): prevent duplicate email on update
refactor(catalog): simplify category tree query
chore(deps): update express to v5.1
test(auth): add login service unit tests
docs(api): add error code reference table
```

### Bad examples

```
Update files                          # no type, vague
feat: stuff                           # vague description
FEAT(auth): Add Login Endpoint        # uppercase
feat(auth): add login endpoint.       # trailing period
fix: fix bug                          # says nothing
feat(auth,users,roles): add all crud  # too many scopes, split into commits
```

---

## Pull Requests

### PR size

| Size | Lines changed | Review time | Rule |
|------|--------------|-------------|------|
| Small | < 200 | ~15 min | Preferred |
| Medium | 200–500 | ~30 min | Acceptable |
| Large | 500+ | 1+ hour | Split if possible |

**Exception**: schema files (Drizzle tables, shared package schemas) can be large in a single PR when they represent one logical unit.

### PR title

Follows same conventional commit format:

```
feat(auth): add login and token refresh endpoints
fix(catalog): category tree returns deleted items
```

### PR description template

```markdown
## Summary
- What changed and why (2-3 bullet points max)

## Related
- Link to issue/task if applicable

## Testing
- [ ] `npm run check` passes (lint + format + typecheck)
- [ ] `npm test` passes
- [ ] Tested manually via dev server / Postman
- [ ] Migration generated and reviewed (if schema changed)

## Screenshots
(if UI-relevant or API response examples)
```

### Review rules

- **1 approval required** before merge
- **All checks must pass** (CI, lint, typecheck, tests)
- **Author merges** after approval (not reviewer)
- **Squash merge** to main — keeps history clean
- **Delete branch** after merge

### Review etiquette

- Reviewer: comment on logic and correctness, not style (Biome handles style)
- Author: respond to all comments before merging
- If PR sits >24h without review, ping in team channel

---

## Workflow: Feature Development

### Step by step

```bash
# 1. Start from latest main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feat/auth-login-endpoint

# 3. Work in small commits
git add src/modules/auth/auth.routes.ts
git commit -m "feat(auth): add login route with validation"

git add src/modules/auth/auth.service.ts
git commit -m "feat(auth): implement login service with jwt"

# 4. Push and create PR
git push -u origin feat/auth-login-endpoint
# Create PR via GitHub

# 5. After approval, squash merge via GitHub UI

# 6. Clean up
git checkout main
git pull origin main
git branch -d feat/auth-login-endpoint
```

### Before pushing

Always run:

```bash
npm run check    # lint + format + typecheck
npm test         # all tests pass
```

The pre-commit hook runs Biome on staged files automatically, but `npm run check` catches issues Biome doesn't (TypeScript errors).

---

## Workflow: Database Changes

Schema changes require extra care because migrations are irreversible in production.

```bash
# 1. Edit schema files in src/db/schema/
# 2. Generate migration
npm run db:generate

# 3. Review generated SQL in drizzle/XXXX_name.sql
# 4. Test migration locally
npm run db:migrate

# 5. Commit schema + migration together
git add src/db/schema/catalog.ts
git add drizzle/0002_add_catalog_tables.sql
git add drizzle/meta/_journal.json
git commit -m "feat(db): add catalog schema tables"
```

Rules:
- **Always review generated SQL** before committing
- **Schema change + migration in same commit** — they must stay in sync
- **Never edit generated SQL manually** — regenerate if wrong
- **`_journal.json` must be committed** — needed for `db:migrate` on deploy
- **Snapshot files are gitignored** — never commit them

---

## Conflict Resolution

### `_journal.json` conflicts

When two devs generate migrations in parallel, `_journal.json` will conflict. Resolution:

1. Keep both migration entries
2. Ensure `idx` values are sequential (no gaps, no duplicates)
3. Both `.sql` files have unique filenames — no conflict there

### Schema file conflicts

If two devs edit the same schema file:
1. Resolve manually — keep both sets of changes
2. Regenerate migration: `npm run db:generate`
3. Review new migration SQL
4. Delete the old conflicting migration file if regenerated

---

## Hooks (Automated)

| Hook | Tool | What it does |
|------|------|-------------|
| `pre-commit` | lint-staged + Biome | Formats and lints staged `.ts`/`.js` files |
| `commit-msg` | commitlint | Rejects non-conventional commit messages |

Both run automatically via husky. Do not skip with `--no-verify`.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Push directly to main | Use feature branch + PR |
| Giant PR with 5 features | One feature per PR |
| Commit generated migration separately from schema | Same commit — they must stay in sync |
| Force push to shared branch | Never force push to main or shared branches |
| Commit `.env` or secrets | Already in `.gitignore` — never remove those entries |
| Skip pre-commit hook | Fix the lint error instead of skipping |
| Merge without running `npm run check` | Always verify locally before pushing |
| Vague commit messages | Follow conventional commits format with clear scope |
