# Soft Delete Strategy — BOPADIGITAL API

Guidelines for when and how to apply soft delete across schemas. Covers the distinction between `is_active` (state toggle) and `deleted_at` (soft delete), and identifies gaps in the current `models/*.sql` definitions.

---

## `is_active` vs `deleted_at`

| Concept | Column | Purpose | Reversible? | Examples |
|---------|--------|---------|-------------|----------|
| **State toggle** | `is_active` | Temporarily enable/disable a record without losing it | Yes — flip back to `true` | Deprecate a `visit_type`, disable a `role`, deactivate a tier |
| **Soft delete** | `deleted_at` | Mark a record as deleted while preserving it for audit, recovery, and referential integrity | Yes — clear the timestamp | Remove a `user`, delete a `catalog_item`, withdraw a `job_vacancy` |

A record with `is_active = false` is expected to potentially come back. A record with `deleted_at IS NOT NULL` was intentionally removed — the timestamp records when, and the data can be restored if needed.

---

## Current state (from `models/*.sql`)

### Tables with soft delete (`deleted_at`) — 11 of 51

| Schema | Table | Notes |
|--------|-------|-------|
| app_auth | `users` | Indexes filter `WHERE deleted_at IS NULL` |
| core | `profiles` | Indexes filter `WHERE deleted_at IS NULL` |
| crm | `business_clients` | Indexes filter `WHERE deleted_at IS NULL` |
| crm | `negotiations` | Indexes filter `WHERE deleted_at IS NULL` |
| crm | `visits` | Indexes filter `WHERE deleted_at IS NULL` |
| catalog | `catalog_items` | Most indexes filter `WHERE deleted_at IS NULL` |
| catalog | `content_blocks` | Unique index filters `WHERE deleted_at IS NULL` |
| matrices | `offer_matrices` | Indexes filter `WHERE deleted_at IS NULL` |
| documents | `negotiation_documents` | Indexes filter `WHERE deleted_at IS NULL` |
| employability | `job_vacancies` | Indexes filter `WHERE deleted_at IS NULL` |
| employability | `job_applications` | Indexes filter `WHERE deleted_at IS NULL` |

### Tables without soft delete — 40 of 51

#### Lookup tables with `is_active` only (deactivation, not deletion)

`modules`, `permissions`, `roles`, `negotiation_states`, `visit_types`, `item_types`, `contract_types`, `segments`, `tiers`, `geo_zones`, `benefit_types`, `content_types`, `categories`, `document_types`, `item_benefits`

- These are reference data. Toggling `is_active` hides them from dropdowns but preserves references in historical records.

#### Junction tables

`role_permissions`, `user_roles`, `advisor_supervisors`

- `user_roles` and `advisor_supervisors` have `is_active` for soft deactivation. Deleting a row permanently loses audit history.

#### Append-only audit/history trails

`login_logs`, `audit_logs`, `negotiation_state_history`, `matrix_state_history`, `document_state_history`

- Append-only by design. Hard delete is acceptable — these are event logs.

#### Transient/expirable records

`auth_tokens`, `notifications`

- `auth_tokens` expire via `expires_at`. `notifications` uses `is_read`. Hard delete is acceptable.

#### 1:1 detail tables cascaded from a soft-delete parent

`voice_details`, `connectivity_details`, `digital_details`, `roaming_details`, `device_details`, `age_conditions`, `legal_conditions`, `temporal_conditions`, `matrix_line_items`, `matrix_attachments`, `candidate_resumes`

- These live and die with their parent record. When the parent is soft-deleted, these become unreachable. Hard delete cascading is acceptable.

#### Other entity tables (no soft mechanism at all)

`candidates`, `contact_requests`, `sales_objectives`, `report_exports`

---

## Recommended improvements

### High priority

| Table | Problem | Recommendation |
|-------|---------|----------------|
| `employability.candidates` | Stores PII (national_id, email, phone, address). No `is_active`, no `deleted_at`. Deleting cascades to `candidate_resumes` and `job_applications`. GDPR right-to-erasure demands the ability to remove a candidate while preserving application history. | Add `deleted_at`. When soft-deleted, anonymize PII fields (`first_name` → empty string, `national_id` → hash, etc.). Update `job_applications` FK to `ON DELETE SET NULL` or reference a "deleted candidate" placeholder. |
| `app_auth.modules` | Self-referencing FK (`parent_id`). Hard delete cascades to `permissions` → `role_permissions`, destroying RBAC config. | Add `deleted_at`. Update unique index on `code` to `WHERE deleted_at IS NULL`. |
| `app_auth.permissions` | Hard delete cascades to `role_permissions`. Permissions referenced by roles disappear. | Add `deleted_at`. |
| `app_auth.roles` | Hard delete cascades to `role_permissions` and `user_roles`. Losing a role permanently destroys assignment history. | Add `deleted_at`. |

### Medium priority

| Table | Problem | Recommendation |
|-------|---------|----------------|
| `catalog.contact_requests` | Customer inquiries with PII (name, email, phone). Has `is_attended` but no cleanup mechanism. | Add `deleted_at`. |
| `reports.sales_objectives` | Business data with no soft delete. Accidental deletes lose historical targets permanently. | Add `deleted_at`. |
| `reports.report_exports` | File metadata. No mechanism to track that a report was generated and later removed. | Add `deleted_at`. |
| `core.advisor_supervisors` | Junction table. `is_active` handles current state, but deleting a row loses the historical record of when the relationship was terminated. | Add `deleted_at`. |
| `app_auth.user_roles` | Junction table. `is_active` exists, but removing a role assignment permanently loses audit history. | Add `deleted_at`. |

### Not needed

| Category | Tables | Reason |
|----------|--------|--------|
| Lookup tables | `item_types`, `contract_types`, `segments`, etc. | `is_active` is sufficient. These are reference data that should never be truly "deleted" — toggling them off keeps referential integrity intact. |
| History/audit trails | `audit_logs`, `*_state_history`, `login_logs` | Append-only event logs. Hard delete (or retention-based cleanup) is the correct pattern. |
| Transient records | `auth_tokens`, `notifications` | Tokens expire, notifications are read/cleared. Hard delete is appropriate. |
| Cascade children | `voice_details`, `device_details`, `matrix_line_items`, etc. | If the parent has soft delete, children are unreachable and don't need their own. |

---

## Implementation pattern

### Adding `deleted_at` to a table

```sql
ALTER TABLE schema.table ADD COLUMN deleted_at TIMESTAMPTZ;
```

### Updating indexes

All unique indexes and filtered indexes must include `WHERE deleted_at IS NULL`:

```sql
CREATE UNIQUE INDEX idx_table_code ON schema.table(code) WHERE deleted_at IS NULL;
```

### Soft-delete query pattern

```typescript
import { eq, isNull } from 'drizzle-orm';

await db.update(table)
  .set({ deletedAt: new Date() })
  .where(eq(table.id, id));

const active = await db.select()
  .from(table)
  .where(isNull(table.deletedAt));
```

### Restore pattern

```typescript
await db.update(table)
  .set({ deletedAt: null })
  .where(eq(table.id, id));
```
