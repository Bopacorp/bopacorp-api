-- =============================================
-- Seed: RBAC Modules + Permissions
-- Schema: app_auth
-- Idempotent: uses ON CONFLICT DO NOTHING
-- =============================================

BEGIN;

-- ── Default Role ──

INSERT INTO app_auth.roles (name, slug, description) VALUES
  ('Administrator', 'admin', 'Full system access')
ON CONFLICT (slug) DO NOTHING;

-- ── Parent Modules (top-level navigation groups) ──

INSERT INTO app_auth.modules (code, name, description, sort_order) VALUES
  ('user_management', 'User Management',    'Users and access control',       1),
  ('rbac',            'Roles & Permissions', 'RBAC administration',            2),
  ('organization',    'Organization',        'Org structure and employees',    3),
  ('service_catalog', 'Service Catalog',     'Catalog items and categories',   4),
  ('cms',             'Content Management',  'CMS content types and blocks',   5),
  ('crm',             'Contact Requests',    'Customer contact requests',      6),
  ('employability',   'Employability',       'Job vacancies and applications', 7)
ON CONFLICT (code) DO NOTHING;

-- ── Child Modules (feature modules with permissions) ──

INSERT INTO app_auth.modules (parent_id, code, name, description, sort_order) VALUES
  -- User Management
  ((SELECT id FROM app_auth.modules WHERE code = 'user_management'),
    'users', 'Users', 'User CRUD and role assignment', 1),

  -- RBAC
  ((SELECT id FROM app_auth.modules WHERE code = 'rbac'),
    'roles', 'Roles', 'Role management', 1),
  ((SELECT id FROM app_auth.modules WHERE code = 'rbac'),
    'modules', 'Modules', 'Module management', 2),
  ((SELECT id FROM app_auth.modules WHERE code = 'rbac'),
    'permissions', 'Permissions', 'Permission management', 3),

  -- Organization
  ((SELECT id FROM app_auth.modules WHERE code = 'organization'),
    'departments', 'Departments', 'Department management', 1),
  ((SELECT id FROM app_auth.modules WHERE code = 'organization'),
    'org_roles', 'Org Roles', 'Organizational role management', 2),
  ((SELECT id FROM app_auth.modules WHERE code = 'organization'),
    'employees', 'Employees', 'Employee management and supervisors', 3),

  -- Catalog
  ((SELECT id FROM app_auth.modules WHERE code = 'service_catalog'),
    'catalog_items', 'Catalog Items', 'Service catalog items', 1),
  ((SELECT id FROM app_auth.modules WHERE code = 'service_catalog'),
    'categories', 'Categories', 'Catalog categories', 2),
  ((SELECT id FROM app_auth.modules WHERE code = 'service_catalog'),
    'segments', 'Segments', 'Market segments', 3),
  ((SELECT id FROM app_auth.modules WHERE code = 'service_catalog'),
    'tiers', 'Tiers', 'Service tiers', 4),
  ((SELECT id FROM app_auth.modules WHERE code = 'service_catalog'),
    'geo_zones', 'Geo Zones', 'Geographic zones', 5),
  ((SELECT id FROM app_auth.modules WHERE code = 'service_catalog'),
    'item_types', 'Item Types', 'Catalog item types', 6),
  ((SELECT id FROM app_auth.modules WHERE code = 'service_catalog'),
    'contract_types', 'Contract Types', 'Contract types', 7),
  ((SELECT id FROM app_auth.modules WHERE code = 'service_catalog'),
    'benefit_types', 'Benefit Types', 'Benefit types', 8),

  -- CMS
  ((SELECT id FROM app_auth.modules WHERE code = 'cms'),
    'content_types', 'Content Types', 'CMS content type definitions', 1),
  ((SELECT id FROM app_auth.modules WHERE code = 'cms'),
    'content_blocks', 'Content Blocks', 'CMS content blocks', 2),

  -- Contact Requests
  ((SELECT id FROM app_auth.modules WHERE code = 'crm'),
    'contact_requests', 'Contact Requests', 'Customer contact request management', 1),

  -- Employability
  ((SELECT id FROM app_auth.modules WHERE code = 'employability'),
    'job_vacancies', 'Job Vacancies', 'Job vacancy management', 1),
  ((SELECT id FROM app_auth.modules WHERE code = 'employability'),
    'candidates', 'Candidates', 'Candidate management', 2),
  ((SELECT id FROM app_auth.modules WHERE code = 'employability'),
    'candidate_resumes', 'Candidate Resumes', 'Resume management', 3),
  ((SELECT id FROM app_auth.modules WHERE code = 'employability'),
    'job_applications', 'Job Applications', 'Application management', 4)
ON CONFLICT (code) DO NOTHING;

-- ── Permissions ──
-- Pattern: module_code.action for standard CRUD
--          module_code.sub_resource.action for sub-resource ops

-- Users
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'users'), 'users.read',         'View users',          'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'users'), 'users.create',       'Create users',        'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'users'), 'users.update',       'Update users',        'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'users'), 'users.delete',       'Delete users',        'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'users'), 'users.roles.update', 'Assign user roles',   'action')
ON CONFLICT (code) DO NOTHING;

-- Roles
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'roles'), 'roles.read',               'View roles',               'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'roles'), 'roles.create',             'Create roles',             'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'roles'), 'roles.update',             'Update roles',             'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'roles'), 'roles.delete',             'Delete roles',             'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'roles'), 'roles.permissions.update', 'Assign role permissions',  'action')
ON CONFLICT (code) DO NOTHING;

-- Modules (RBAC)
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'modules'), 'modules.read',   'View modules',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'modules'), 'modules.create', 'Create modules', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'modules'), 'modules.update', 'Update modules', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'modules'), 'modules.delete', 'Delete modules', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Permissions (RBAC)
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'permissions'), 'permissions.read',   'View permissions',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'permissions'), 'permissions.create', 'Create permissions', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'permissions'), 'permissions.update', 'Update permissions', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'permissions'), 'permissions.delete', 'Delete permissions', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Departments
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'departments'), 'departments.read',   'View departments',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'departments'), 'departments.create', 'Create departments', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'departments'), 'departments.update', 'Update departments', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'departments'), 'departments.delete', 'Delete departments', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Org Roles
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'org_roles'), 'org_roles.read',   'View org roles',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'org_roles'), 'org_roles.create', 'Create org roles', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'org_roles'), 'org_roles.update', 'Update org roles', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'org_roles'), 'org_roles.delete', 'Delete org roles', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Employees
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'employees'), 'employees.read',               'View employees',        'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'employees'), 'employees.create',             'Create employees',      'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'employees'), 'employees.update',             'Update employees',      'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'employees'), 'employees.delete',             'Delete employees',      'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'employees'), 'employees.supervisors.update', 'Assign supervisors',    'action')
ON CONFLICT (code) DO NOTHING;

-- Catalog Items
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'catalog_items'), 'catalog_items.read',   'View catalog items',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'catalog_items'), 'catalog_items.create', 'Create catalog items', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'catalog_items'), 'catalog_items.update', 'Update catalog items', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'catalog_items'), 'catalog_items.delete', 'Delete catalog items', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Categories
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'categories'), 'categories.read',   'View categories',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'categories'), 'categories.create', 'Create categories', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'categories'), 'categories.update', 'Update categories', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'categories'), 'categories.delete', 'Delete categories', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Segments
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'segments'), 'segments.read',   'View segments',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'segments'), 'segments.create', 'Create segments', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'segments'), 'segments.update', 'Update segments', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'segments'), 'segments.delete', 'Delete segments', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Tiers
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'tiers'), 'tiers.read',   'View tiers',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'tiers'), 'tiers.create', 'Create tiers', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'tiers'), 'tiers.update', 'Update tiers', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'tiers'), 'tiers.delete', 'Delete tiers', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Geo Zones
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'geo_zones'), 'geo_zones.read',   'View geo zones',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'geo_zones'), 'geo_zones.create', 'Create geo zones', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'geo_zones'), 'geo_zones.update', 'Update geo zones', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'geo_zones'), 'geo_zones.delete', 'Delete geo zones', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Item Types
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'item_types'), 'item_types.read',   'View item types',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'item_types'), 'item_types.create', 'Create item types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'item_types'), 'item_types.update', 'Update item types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'item_types'), 'item_types.delete', 'Delete item types', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Contract Types
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'contract_types'), 'contract_types.read',   'View contract types',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'contract_types'), 'contract_types.create', 'Create contract types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'contract_types'), 'contract_types.update', 'Update contract types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'contract_types'), 'contract_types.delete', 'Delete contract types', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Benefit Types
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'benefit_types'), 'benefit_types.read',   'View benefit types',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'benefit_types'), 'benefit_types.create', 'Create benefit types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'benefit_types'), 'benefit_types.update', 'Update benefit types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'benefit_types'), 'benefit_types.delete', 'Delete benefit types', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Content Types
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'content_types'), 'content_types.read',   'View content types',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'content_types'), 'content_types.create', 'Create content types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'content_types'), 'content_types.update', 'Update content types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'content_types'), 'content_types.delete', 'Delete content types', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Content Blocks
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'content_blocks'), 'content_blocks.read',   'View content blocks',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'content_blocks'), 'content_blocks.create', 'Create content blocks', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'content_blocks'), 'content_blocks.update', 'Update content blocks', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'content_blocks'), 'content_blocks.delete', 'Delete content blocks', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Contact Requests
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'contact_requests'), 'contact_requests.read',   'View contact requests',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'contact_requests'), 'contact_requests.update', 'Update contact requests', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Job Vacancies
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'job_vacancies'), 'job_vacancies.read',   'View job vacancies',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'job_vacancies'), 'job_vacancies.create', 'Create job vacancies', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'job_vacancies'), 'job_vacancies.update', 'Update job vacancies', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'job_vacancies'), 'job_vacancies.delete', 'Delete job vacancies', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Candidates
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'candidates'), 'candidates.read',   'View candidates',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'candidates'), 'candidates.create', 'Create candidates', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'candidates'), 'candidates.update', 'Update candidates', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'candidates'), 'candidates.delete', 'Delete candidates', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Candidate Resumes
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'candidate_resumes'), 'candidate_resumes.read',   'View resumes',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'candidate_resumes'), 'candidate_resumes.create', 'Upload resumes', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'candidate_resumes'), 'candidate_resumes.delete', 'Delete resumes', 'crud')
ON CONFLICT (code) DO NOTHING;

-- Job Applications
INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'job_applications'), 'job_applications.read',   'View applications',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'job_applications'), 'job_applications.create', 'Create applications', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'job_applications'), 'job_applications.update', 'Update applications', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'job_applications'), 'job_applications.delete', 'Delete applications', 'crud')
ON CONFLICT (code) DO NOTHING;

-- ── Assign ALL permissions to Administrator role ──

INSERT INTO app_auth.role_permissions (role_id, permission_id, is_granted)
SELECT
  (SELECT id FROM app_auth.roles WHERE slug = 'admin'),
  p.id,
  TRUE
FROM app_auth.permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ── Cleanup: fix old modules without parent ──
-- Old content/content_blocks/content_types modules get reparented under cms

UPDATE app_auth.modules
SET parent_id = (SELECT id FROM app_auth.modules WHERE code = 'cms')
WHERE code IN ('content', 'content_blocks', 'content_types')
  AND parent_id IS NULL
  AND code NOT IN ('cms');

-- Deactivate legacy 'content' module (replaced by cms parent)
UPDATE app_auth.modules SET is_active = FALSE WHERE code = 'content';

-- Fix content_blocks permissions: repoint to correct module
UPDATE app_auth.permissions
SET module_id = (SELECT id FROM app_auth.modules WHERE code = 'content_blocks')
WHERE code LIKE 'content_blocks.%'
  AND module_id != (SELECT id FROM app_auth.modules WHERE code = 'content_blocks');

-- Fix content_types permission names (were in Spanish)
UPDATE app_auth.permissions SET name = 'View content types'   WHERE code = 'content_types.read';
UPDATE app_auth.permissions SET name = 'Create content types' WHERE code = 'content_types.create';
UPDATE app_auth.permissions SET name = 'Update content types' WHERE code = 'content_types.update';
UPDATE app_auth.permissions SET name = 'Delete content types' WHERE code = 'content_types.delete';

COMMIT;
