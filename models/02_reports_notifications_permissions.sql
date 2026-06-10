-- =============================================
-- Seed: Complete RBAC Modules + Permissions (All Modules)
-- Schema: app_auth
-- Idempotent: uses ON CONFLICT DO NOTHING
-- Run this after 01_rbac_permissions.seed.sql
-- =============================================

BEGIN;

-- ── Documents (no parent) ──

INSERT INTO app_auth.modules (code, name, description, sort_order) VALUES
  ('documents', 'Documents', 'Document management and approvals', 10)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_auth.modules (parent_id, code, name, description, sort_order) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'documents'), 'document_types', 'Document Types', 'Document type definitions', 1),
  ((SELECT id FROM app_auth.modules WHERE code = 'documents'), 'negotiation_documents', 'Negotiation Documents', 'Document uploads and approvals', 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'document_types'), 'document_types.read',         'View document types',        'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'document_types'), 'document_types.create',     'Create document types',      'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'document_types'), 'document_types.update',     'Update document types',      'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'document_types'), 'document_types.delete',     'Delete document types',      'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_documents'), 'negotiation_documents.read',        'View negotiation documents',    'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_documents'), 'negotiation_documents.create',      'Create negotiation documents',  'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_documents'), 'negotiation_documents.update',    'Update negotiation documents',    'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_documents'), 'negotiation_documents.delete',    'Delete negotiation documents',    'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'negotiation_documents'), 'negotiation_documents.change_state', 'Change document state', 'action')
ON CONFLICT (code) DO NOTHING;

-- ── Reports ──

INSERT INTO app_auth.modules (code, name, description, sort_order) VALUES
  ('reports', 'Reports', 'Sales objectives and report exports', 11)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_auth.modules (parent_id, code, name, description, sort_order) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'reports'), 'sales_objectives', 'Sales Objectives', 'Sales target management', 1),
  ((SELECT id FROM app_auth.modules WHERE code = 'reports'), 'report_exports',   'Report Exports',   'Generated report files',    2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'sales_objectives'), 'sales_objectives.read',   'View sales objectives',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'sales_objectives'), 'sales_objectives.create', 'Create sales objectives', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'sales_objectives'), 'sales_objectives.update', 'Update sales objectives', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'sales_objectives'), 'sales_objectives.delete', 'Delete sales objectives', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'report_exports'), 'report_exports.read',   'View report exports',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'report_exports'), 'report_exports.create', 'Create report exports', 'crud')
ON CONFLICT (code) DO NOTHING;

-- ── Notifications ──

INSERT INTO app_auth.modules (code, name, description, sort_order) VALUES
  ('notifications', 'Notifications', 'In-app notifications', 12)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_auth.permissions (module_id, code, name, type) VALUES
  ((SELECT id FROM app_auth.modules WHERE code = 'notifications'), 'notifications.read',   'View notifications',   'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'notifications'), 'notifications.create', 'Create notifications', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'notifications'), 'notifications.update', 'Update notifications', 'crud'),
  ((SELECT id FROM app_auth.modules WHERE code = 'notifications'), 'notifications.delete', 'Delete notifications', 'crud')
ON CONFLICT (code) DO NOTHING;

-- ── Assign ALL new permissions to Administrator role ──

INSERT INTO app_auth.role_permissions (role_id, permission_id, is_granted)
SELECT
  (SELECT id FROM app_auth.roles WHERE slug = 'admin'),
  p.id,
  TRUE
FROM app_auth.permissions p
WHERE p.code IN (
  -- Documents
  'document_types.read',
  'document_types.create',
  'document_types.update',
  'document_types.delete',
  'negotiation_documents.read',
  'negotiation_documents.create',
  'negotiation_documents.update',
  'negotiation_documents.delete',
  'negotiation_documents.change_state',
  -- Reports
  'sales_objectives.read',
  'sales_objectives.create',
  'sales_objectives.update',
  'sales_objectives.delete',
  'report_exports.read',
  'report_exports.create',
  -- Notifications
  'notifications.read',
  'notifications.create',
  'notifications.update',
  'notifications.delete'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
