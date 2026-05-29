import 'dotenv/config';
import { modules, permissions, rolePermissions, roles } from '@db/schema/auth.js';
import { closeDb, db } from '@lib/db.js';
import type { InferSelectModel } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';

type Role = InferSelectModel<typeof roles>;

async function getOrCreateRole(roleData: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Role> {
  const [inserted] = await db
    .insert(roles)
    .values(roleData)
    .onConflictDoNothing({ target: roles.slug })
    .returning();

  if (inserted) {
    return inserted;
  }

  const found = await db.query.roles.findFirst({
    where: (roles, { eq }) => eq(roles.slug, roleData.slug),
  });

  if (!found) {
    throw new Error(`No se pudo obtener o crear el rol: ${roleData.slug}`);
  }

  return found;
}

const MODULE_DEFS = [
  {
    code: 'content_blocks',
    name: 'Content Blocks',
    description: 'Gestion de bloques de contenido',
    sortOrder: 1,
  },
  {
    code: 'content_types',
    name: 'Content Types',
    description: 'Gestion de tipos de contenido',
    sortOrder: 2,
  },
];

const PERMISSION_DEFS: {
  moduleCode: string;
  code: string;
  name: string;
  type: 'crud' | 'action' | 'report' | 'view' | 'approval';
}[] = [
  { moduleCode: 'content_blocks', code: 'content_blocks.read', name: 'Ver', type: 'crud' },
  { moduleCode: 'content_blocks', code: 'content_blocks.create', name: 'Crear', type: 'crud' },
  { moduleCode: 'content_blocks', code: 'content_blocks.update', name: 'Editar', type: 'crud' },
  { moduleCode: 'content_blocks', code: 'content_blocks.delete', name: 'Eliminar', type: 'crud' },
  { moduleCode: 'content_types', code: 'content_types.read', name: 'Ver', type: 'crud' },
  { moduleCode: 'content_types', code: 'content_types.create', name: 'Crear', type: 'crud' },
  { moduleCode: 'content_types', code: 'content_types.update', name: 'Editar', type: 'crud' },
  { moduleCode: 'content_types', code: 'content_types.delete', name: 'Eliminar', type: 'crud' },
];

async function seed() {
  await db.insert(modules).values(MODULE_DEFS).onConflictDoNothing({ target: modules.code });

  const dbModules = await db
    .select()
    .from(modules)
    .where(
      inArray(
        modules.code,
        MODULE_DEFS.map((m) => m.code)
      )
    );

  const moduleByCode = new Map(dbModules.map((m) => [m.code, m.id]));

  const permValues = PERMISSION_DEFS.map((p) => {
    const moduleId = moduleByCode.get(p.moduleCode);

    if (!moduleId) {
      throw new Error(`Modulo no encontrado: ${p.moduleCode}`);
    }

    return {
      moduleId,
      code: p.code,
      name: p.name,
      type: p.type,
    };
  });

  await insertPermissions(permValues);

  const adminRole = await getOrCreateRole({
    name: 'Administrador',
    slug: 'admin',
    description: 'Rol con acceso total al sistema',
  });

  const dbPermissions = await loadAllDBPermissions();

  await assignPermissionsToRole(adminRole, dbPermissions);

  process.stdout.write('Seed completado: modulos, permisos y rol admin.\n');
  await closeDb();

  async function insertPermissions(
    values: {
      moduleId: string;
      code: string;
      name: string;
      type: 'crud' | 'action' | 'report' | 'view' | 'approval';
    }[]
  ) {
    await db.insert(permissions).values(values).onConflictDoNothing({ target: permissions.code });
  }

  async function loadAllDBPermissions() {
    return db
      .select()
      .from(permissions)
      .where(
        inArray(
          permissions.code,
          PERMISSION_DEFS.map((p) => p.code)
        )
      );
  }

  async function assignPermissionsToRole(
    role: InferSelectModel<typeof roles>,
    perms: InferSelectModel<typeof permissions>[]
  ) {
    await db
      .insert(rolePermissions)
      .values(
        perms.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
          isGranted: true,
        }))
      )
      .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] });
  }
}

seed().catch((err) => {
  process.stderr.write(`Error ejecutando seed: ${String(err)}\n`);
  process.exit(1);
});
