-- =============================================
-- Seed: CRM + Matrices + Missing Action Permissions
-- Schema: app_auth
-- Idempotent: uses ON CONFLICT DO NOTHING
-- Run this after 01_rbac_permissions.seed.sql and 02_reports_notifications_permissions.sql
-- =============================================

BEGIN;

-- ── CRM Child Modules (under existing 'crm' parent) ──

INSERT INTO app_auth.modules (parent_id, code, name, description, sort_order) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'crm'), 'business_clients',   'Business Clients',   'Client management',         2),
  ((SELECT id FROM app_auth.modules WHERE code = 'crm'), 'negotiations',       'Negotiations',       'Sales negotiations',         3),
  ((SELECT id FROM app_auth.modules WHERE code = 'crm'), 'negotiation_states', 'Negotiation States', 'Negotiation state workflow', 4),
  ((SELECT id FROM app_auth.modules WHERE code = 'crm'), 'visits',             'Visits',             'Visit scheduling and tracking', 5),
  ((SELECT id FROM app_auth.modules WHERE code = 'crm'), 'visit_types',        'Visit Types',        'Visit type definitions',     6)
ON CONFLICT (code) DO NOTHING;

-- ── CRM Permissions ──

INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'business_clients'), 'business_clients.read',   'View business clients',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'business_clients'), 'business_clients.create', 'Create business clients', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'business_clients'), 'business_clients.update', 'Update business clients', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'business_clients'), 'business_clients.delete', 'Delete business clients', 'crud'),

  ((SELECT id FROM app_auth.modules WHERE code = 'negotiations'), 'negotiations.read',         'View negotiations',       'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiations'), 'negotiations.create',       'Create negotiations',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiations'), 'negotiations.update',       'Update negotiations',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiations'), 'negotiations.delete',       'Delete negotiations',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiations'), 'negotiations.change_state', 'Change negotiation state', 'action'),

  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_states'), 'negotiation_states.read',   'View negotiation states',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_states'), 'negotiation_states.create', 'Create negotiation states', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_states'), 'negotiation_states.update', 'Update negotiation states', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_states'), 'negotiation_states.delete', 'Delete negotiation states', 'crud'),

  ((SELECT id FROM app_auth.modules WHERE code = 'visits'), 'visits.read',   'View visits',       'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'visits'), 'visits.create', 'Create visits',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'visits'), 'visits.update', 'Update visits',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'visits'), 'visits.delete', 'Delete visits',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'visits'), 'visits.verify', 'Verify visits',     'action'),

  ((SELECT id FROM app_auth.modules WHERE code = 'visit_types'), 'visit_types.read',   'View visit types',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'visit_types'), 'visit_types.create', 'Create visit types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'visit_types'), 'visit_types.update', 'Update visit types', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'visit_types'), 'visit_types.delete', 'Delete visit types', 'crud')
ON CONFLICT (code) DO NOTHING;

-- ── Matrices Module ──

INSERT INTO app_auth.modules (code, name, description, sort_order) VALUES
  ('matrices', 'Matrices', 'Offer matrices and approvals', 13)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_auth.modules (parent_id, code, name, description, sort_order) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'matrices'), 'offer_matrices',   'Offer Matrices',   'Offer matrix management',   1),
  ((SELECT id FROM app_auth.modules WHERE code = 'matrices'), 'matrix_line_items', 'Matrix Line Items', 'Matrix line items',         2),
  ((SELECT id FROM app_auth.modules WHERE code = 'matrices'), 'matrix_attachments', 'Matrix Attachments', 'Matrix file attachments',  3)
ON CONFLICT (code) DO NOTHING;

-- ── Matrices Permissions ──

INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'offer_matrices'), 'offer_matrices.read',         'View offer matrices',       'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'offer_matrices'), 'offer_matrices.create',       'Create offer matrices',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'offer_matrices'), 'offer_matrices.update',       'Update offer matrices',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'offer_matrices'), 'offer_matrices.delete',       'Delete offer matrices',     'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'offer_matrices'), 'offer_matrices.change_state', 'Change matrix state',       'action'),

  ((SELECT id FROM app_auth.modules WHERE code = 'matrix_line_items'), 'matrix_line_items.read',   'View matrix line items',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'matrix_line_items'), 'matrix_line_items.create', 'Create matrix line items', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'matrix_line_items'), 'matrix_line_items.update', 'Update matrix line items', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'matrix_line_items'), 'matrix_line_items.delete', 'Delete matrix line items', 'crud'),

  ((SELECT id FROM app_auth.modules WHERE code = 'matrix_attachments'), 'matrix_attachments.read',   'View matrix attachments',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'matrix_attachments'), 'matrix_attachments.create', 'Create matrix attachments', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'matrix_attachments'), 'matrix_attachments.delete', 'Delete matrix attachments', 'crud')
ON CONFLICT (code) DO NOTHING;

-- ── Missing Action Permissions (from 01 seed) ──

INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'users'),     'users.roles.update',     'Assign user roles',      'action'),
  ((SELECT id FROM app_auth.modules WHERE code = 'roles'),     'roles.permissions.update', 'Assign role permissions', 'action'),
  ((SELECT id FROM app_auth.modules WHERE code = 'employees'), 'employees.supervisors.update', 'Assign supervisors', 'action')
ON CONFLICT (code) DO NOTHING;

-- ── Assign ALL new permissions to Administrator role ──

INSERT INTO app_auth.role_permissions (role_id, permission_id, is_granted)
SELECT
  (SELECT id FROM app_auth.roles WHERE slug = 'admin'),
  p.id,
  TRUE
FROM app_auth.permissions p
WHERE p.code IN (
  -- CRM
  'business_clients.read',
  'business_clients.create',
  'business_clients.update',
  'business_clients.delete',
  'negotiations.read',
  'negotiations.create',
  'negotiations.update',
  'negotiations.delete',
  'negotiations.change_state',
  'negotiation_states.read',
  'negotiation_states.create',
  'negotiation_states.update',
  'negotiation_states.delete',
  'visits.read',
  'visits.create',
  'visits.update',
  'visits.delete',
  'visits.verify',
  'visit_types.read',
  'visit_types.create',
  'visit_types.update',
  'visit_types.delete',
  -- Matrices
  'offer_matrices.read',
  'offer_matrices.create',
  'offer_matrices.update',
  'offer_matrices.delete',
  'offer_matrices.change_state',
  'matrix_line_items.read',
  'matrix_line_items.create',
  'matrix_line_items.update',
  'matrix_line_items.delete',
  'matrix_attachments.read',
  'matrix_attachments.create',
  'matrix_attachments.delete',
  -- Missing actions
  'users.roles.update',
  'roles.permissions.update',
  'employees.supervisors.update'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
