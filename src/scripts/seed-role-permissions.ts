import 'dotenv/config';
import { permissions, rolePermissions, roles } from '@db/schema/auth.js';
import { closeDb, db } from '@lib/db.js';
import { eq, inArray, sql } from 'drizzle-orm';

function required<T>(value: T | undefined | null, label: string): T {
  if (value == null) throw new Error(`Required value missing: ${label}`);
  return value;
}

await db.execute(
  sql`UPDATE app_auth.modules SET name = 'CRM' WHERE code = 'crm' AND name = 'Contact Requests'`
);
await db.execute(
  sql`UPDATE app_auth.modules SET name = 'CMS' WHERE code = 'cms' AND name = 'Content Management'`
);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  advisor: [
    'business_clients.create',
    'business_clients.read',
    'business_clients.update',

    'negotiations.create',
    'negotiations.read',
    'negotiations.update',
    'negotiations.change_state',

    'negotiation_states.read',

    'visits.create',
    'visits.read',
    'visits.update',

    'visit_types.read',

    'negotiation_documents.create',
    'negotiation_documents.read',

    'document_types.read',

    'offer_matrices.create',
    'offer_matrices.read',
    'offer_matrices.update',
    'offer_matrices.delete',

    'matrix_attachments.create',
    'matrix_attachments.read',
    'matrix_attachments.delete',

    'notifications.read',
    'notifications.update',

    'employees.read',

    'report_exports.read',
    'sales_objectives.read',
  ],

  supervisor: [
    'business_clients.create',
    'business_clients.read',
    'business_clients.update',
    'business_clients.delete',

    'negotiations.create',
    'negotiations.read',
    'negotiations.update',
    'negotiations.delete',
    'negotiations.change_state',

    'negotiation_states.read',

    'visits.create',
    'visits.read',
    'visits.update',
    'visits.delete',
    'visits.verify',

    'visit_types.read',

    'negotiation_documents.create',
    'negotiation_documents.read',
    'negotiation_documents.change_state',

    'document_types.read',

    'offer_matrices.read',

    'matrix_attachments.read',

    'notifications.create',
    'notifications.read',
    'notifications.update',

    'employees.read',

    'report_exports.read',
    'report_exports.create',

    'sales_objectives.read',

    'users.read',

    'contact_requests.read',
    'contact_requests.update',
  ],

  manager: [
    'business_clients.create',
    'business_clients.read',
    'business_clients.update',
    'business_clients.delete',

    'negotiations.create',
    'negotiations.read',
    'negotiations.update',
    'negotiations.delete',
    'negotiations.change_state',

    'negotiation_states.read',

    'visits.create',
    'visits.read',
    'visits.update',
    'visits.delete',
    'visits.verify',

    'visit_types.read',

    'negotiation_documents.create',
    'negotiation_documents.read',
    'negotiation_documents.change_state',

    'document_types.read',

    'offer_matrices.read',

    'matrix_attachments.read',

    'notifications.create',
    'notifications.read',
    'notifications.update',

    'employees.read',

    'report_exports.read',
    'report_exports.create',

    'sales_objectives.create',
    'sales_objectives.read',
    'sales_objectives.update',
    'sales_objectives.delete',

    'users.read',

    'departments.read',
    'org_roles.read',

    'contact_requests.read',
    'contact_requests.update',

    'job_vacancies.create',
    'job_vacancies.read',
    'job_vacancies.update',
    'job_vacancies.delete',

    'job_applications.read',
    'job_applications.update',

    'candidates.read',
    'candidates.update',

    'candidate_resumes.read',
  ],

  coordinator: [
    'negotiation_documents.read',
    'negotiation_documents.change_state',

    'document_types.create',
    'document_types.read',
    'document_types.update',
    'document_types.delete',

    'negotiations.read',

    'business_clients.read',

    'employees.read',

    'notifications.read',
    'notifications.update',

    'contact_requests.read',
  ],

  'web-admin': [
    'content_blocks.create',
    'content_blocks.read',
    'content_blocks.update',
    'content_blocks.delete',

    'content_types.read',

    'contact_requests.read',
    'contact_requests.update',

    'catalog_items.create',
    'catalog_items.read',
    'catalog_items.update',
    'catalog_items.delete',

    'categories.create',
    'categories.read',
    'categories.update',
    'categories.delete',

    'item_types.read',
    'contract_types.read',
    'segments.read',
    'tiers.read',
    'geo_zones.read',
    'benefit_types.read',

    'job_vacancies.create',
    'job_vacancies.read',
    'job_vacancies.update',
    'job_vacancies.delete',

    'job_applications.read',
    'job_applications.update',

    'candidates.read',
    'candidates.update',

    'candidate_resumes.read',

    'notifications.read',
    'notifications.update',
  ],
};

const allPermCodes = [...new Set(Object.values(ROLE_PERMISSIONS).flat())];

const dbPerms = await db
  .select({ id: permissions.id, code: permissions.code })
  .from(permissions)
  .where(inArray(permissions.code, allPermCodes));

const permByCode = new Map(dbPerms.map((p) => [p.code, p.id]));

const missing = allPermCodes.filter((code) => !permByCode.has(code));
if (missing.length > 0) {
  throw new Error(`Permissions not found in DB: ${missing.join(', ')}`);
}

for (const [roleSlug, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
  const role = await db.query.roles.findFirst({ where: eq(roles.slug, roleSlug) });
  const roleId = required(role, `role:${roleSlug}`).id;

  const values = permCodes.map((code) => ({
    roleId,
    permissionId: required(permByCode.get(code), `perm:${code}`),
    isGranted: true,
  }));

  await db
    .insert(rolePermissions)
    .values(values)
    .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] });

  process.stdout.write(`${roleSlug}: ${permCodes.length} permissions assigned\n`);
}

process.stdout.write('Role permissions seed completed.\n');
await closeDb();
