import type { CreateUserRequest, ListUsersQuery, UpdateUserRequest } from '@bopacorp/shared/auth';
import { roles, userRoles, users } from '@db/schema/auth.js';
import { profiles } from '@db/schema/core.js';
import { createAuditLog } from '@lib/audit.js';
import { db } from '@lib/db.js';
import { BCRYPT_SALT_ROUNDS } from '@shared/constants/auth.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import bcrypt from 'bcrypt';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

function getSortColumn(sortBy: string | undefined): AnyPgColumn {
  switch (sortBy) {
    case 'username':
      return users.username;
    case 'email':
      return users.email;
    case 'lastLoginAt':
      return users.lastLoginAt;
    case 'updatedAt':
      return users.updatedAt;
    default:
      return users.createdAt;
  }
}

export async function listUsers(query: ListUsersQuery) {
  const conditions: SQL[] = [isNull(users.deletedAt)];

  if (query.isActive !== undefined) {
    conditions.push(eq(users.isActive, query.isActive));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    const searchCond = or(
      ilike(users.username, term),
      ilike(users.email, term),
      ilike(profiles.firstName, term),
      ilike(profiles.lastName, term)
    );
    if (searchCond) conditions.push(searchCond);
  }

  const where = and(...conditions);

  const countResult = await db
    .select({ count: count() })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(where);

  const totalItems = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(totalItems / query.limit);

  const sortColumn = getSortColumn(query.sortBy);
  const orderFn = query.sortOrder === 'desc' ? desc : asc;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  const userIds = rows.map((r) => r.id);

  const userRoleRows =
    userIds.length > 0
      ? await db
          .select({
            userId: userRoles.userId,
            roleSlug: roles.slug,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(and(inArray(userRoles.userId, userIds), eq(userRoles.isActive, true)))
      : [];

  const rolesByUser = new Map<string, string[]>();
  for (const row of userRoleRows) {
    const list = rolesByUser.get(row.userId) ?? [];
    list.push(row.roleSlug);
    rolesByUser.set(row.userId, list);
  }

  return {
    data: rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : '',
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
      profile: row.firstName
        ? {
            firstName: row.firstName,
            lastName: row.lastName,
            avatarUrl: row.avatarUrl,
          }
        : null,
      roles: rolesByUser.get(row.id) ?? [],
    })),
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages,
    },
  };
}

export async function getUserById(id: string) {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deletedAt)),
    with: {
      profile: true,
      userRoles: {
        with: { role: true },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt ? user.createdAt.toISOString() : '',
    updatedAt: user.updatedAt ? user.updatedAt.toISOString() : '',
    profile: user.profile
      ? {
          id: user.profile.id,
          firstName: user.profile.firstName,
          secondName: user.profile.secondName,
          lastName: user.profile.lastName,
          secondLastName: user.profile.secondLastName,
          nationalId: user.profile.nationalId,
          phone: user.profile.phone,
          avatarUrl: user.profile.avatarUrl,
          address: user.profile.address,
        }
      : null,
    roles: user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      slug: ur.role.slug,
    })),
  };
}

export async function createUser(
  adminId: string,
  data: CreateUserRequest,
  clientInfo: { ipAddress?: string; userAgent?: string }
) {
  const existingUsername = await db
    .select()
    .from(users)
    .where(and(eq(users.username, data.username), isNull(users.deletedAt)));

  if (existingUsername.length > 0) {
    throw new ConflictError(`User with username '${data.username}' already exists`);
  }

  const existingEmail = await db
    .select()
    .from(users)
    .where(and(eq(users.email, data.email), isNull(users.deletedAt)));

  if (existingEmail.length > 0) {
    throw new ConflictError(`User with email '${data.email}' already exists`);
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

  const newUser = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        username: data.username,
        email: data.email,
        passwordHash,
        isActive: data.isActive,
      })
      .returning();

    if (!user) {
      throw new InternalServerError();
    }

    await tx.insert(profiles).values({
      userId: user.id,
      firstName: data.profile.firstName,
      secondName: data.profile.secondName,
      lastName: data.profile.lastName,
      secondLastName: data.profile.secondLastName,
      nationalId: data.profile.nationalId,
      phone: data.profile.phone,
      avatarUrl: data.profile.avatarUrl,
      address: data.profile.address,
    });

    if (data.roleIds.length > 0) {
      await tx.insert(userRoles).values(
        data.roleIds.map((roleId) => ({
          userId: user.id,
          roleId,
        }))
      );
    }

    return user;
  });

  await createAuditLog({
    tableName: 'users',
    recordId: newUser.id,
    operation: 'I',
    userId: adminId,
    newData: {
      username: data.username,
      email: data.email,
      isActive: data.isActive,
      roleIds: data.roleIds,
    },
    notes: 'User created by admin',
    ...clientInfo,
  });

  return getUserById(newUser.id);
}

export async function updateUser(
  adminId: string,
  id: string,
  data: UpdateUserRequest,
  clientInfo: { ipAddress?: string; userAgent?: string }
) {
  const existingUser = await getUserById(id);

  await db.transaction(async (tx) => {
    const userUpdate: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (data.email !== undefined) userUpdate.email = data.email;
    if (data.isActive !== undefined) userUpdate.isActive = data.isActive;

    if (data.email !== undefined && data.email !== existingUser.email) {
      const dup = await tx
        .select()
        .from(users)
        .where(and(eq(users.email, data.email), isNull(users.deletedAt)));
      if (dup.length > 0) {
        throw new ConflictError(`User with email '${data.email}' already exists`);
      }
    }

    if (Object.keys(userUpdate).length > 1) {
      await tx.update(users).set(userUpdate).where(eq(users.id, id));
    }

    if (data.profile) {
      const profileUpdate: Partial<typeof profiles.$inferInsert> = { updatedAt: new Date() };
      if (data.profile.firstName !== undefined) profileUpdate.firstName = data.profile.firstName;
      if (data.profile.secondName !== undefined) profileUpdate.secondName = data.profile.secondName;
      if (data.profile.lastName !== undefined) profileUpdate.lastName = data.profile.lastName;
      if (data.profile.secondLastName !== undefined)
        profileUpdate.secondLastName = data.profile.secondLastName;
      if (data.profile.nationalId !== undefined) profileUpdate.nationalId = data.profile.nationalId;
      if (data.profile.phone !== undefined) profileUpdate.phone = data.profile.phone;
      if (data.profile.avatarUrl !== undefined) profileUpdate.avatarUrl = data.profile.avatarUrl;
      if (data.profile.address !== undefined) profileUpdate.address = data.profile.address;

      if (Object.keys(profileUpdate).length > 1) {
        await tx.update(profiles).set(profileUpdate).where(eq(profiles.userId, id));
      }
    }
  });

  await createAuditLog({
    tableName: 'users',
    recordId: id,
    operation: 'U',
    userId: adminId,
    oldData: {
      email: existingUser.email,
      isActive: existingUser.isActive,
    },
    newData: {
      email: data.email,
      isActive: data.isActive,
    },
    notes: 'User updated by admin',
    ...clientInfo,
  });

  return getUserById(id);
}

export async function deleteUser(
  adminId: string,
  id: string,
  clientInfo: { ipAddress?: string; userAgent?: string }
) {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deletedAt)),
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ deletedAt: new Date(), isActive: false }).where(eq(users.id, id));
    await tx.update(userRoles).set({ isActive: false }).where(eq(userRoles.userId, id));
  });

  await createAuditLog({
    tableName: 'users',
    recordId: id,
    operation: 'D',
    userId: adminId,
    oldData: { username: user.username, email: user.email, isActive: user.isActive },
    notes: 'User soft-deleted by admin',
    ...clientInfo,
  });
}

export async function assignUserRoles(
  adminId: string,
  id: string,
  roleIds: string[],
  clientInfo: { ipAddress?: string; userAgent?: string }
) {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deletedAt)),
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, id));
    if (roleIds.length > 0) {
      await tx.insert(userRoles).values(
        roleIds.map((roleId) => ({
          userId: id,
          roleId,
        }))
      );
    }
  });

  await createAuditLog({
    tableName: 'user_roles',
    recordId: id,
    operation: 'U',
    userId: adminId,
    newData: { roleIds },
    notes: 'Roles reassigned by admin',
    ...clientInfo,
  });

  return getUserById(id);
}
