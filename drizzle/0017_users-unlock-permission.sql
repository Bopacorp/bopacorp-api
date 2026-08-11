-- Custom SQL migration file, put your code below! --
INSERT INTO "app_auth"."permissions" ("module_id", "code", "name", "description", "type")
SELECT "id", 'users.unlock', 'Unlock user', 'Clear temporary failed-login lock', 'action'
FROM "app_auth"."modules"
WHERE "code" = 'users'
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

INSERT INTO "app_auth"."role_permissions" ("role_id", "permission_id", "is_granted")
SELECT "roles"."id", "permissions"."id", true
FROM "app_auth"."roles"
CROSS JOIN "app_auth"."permissions"
WHERE "roles"."slug" IN ('admin', 'manager')
  AND "permissions"."code" = 'users.unlock'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
