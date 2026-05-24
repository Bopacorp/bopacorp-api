import { env } from '@config/env.js';
import { db } from '@lib/db.js';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import { and, eq, isNull } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { users } from '../../db/schema/auth.js';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);

  let payload: { sub: string; email: string };

  try {
    payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, payload.sub), isNull(users.deletedAt)),
    with: {
      userRoles: {
        where: (ur, { eq }) => eq(ur.isActive, true),
        with: {
          role: true,
        },
      },
    },
  });

  if (!user?.isActive) {
    throw new UnauthorizedError('User inactive or deleted');
  }

  const roleIds = user.userRoles.map((ur) => ur.roleId);

  const permissions = new Set<string>();

  if (roleIds.length > 0) {
    const rolePerms = await db.query.rolePermissions.findMany({
      where: (rp, { eq, and, inArray }) => and(eq(rp.isGranted, true), inArray(rp.roleId, roleIds)),
      with: {
        permission: true,
      },
    });

    for (const rp of rolePerms) {
      if (rp.permission?.code) {
        permissions.add(rp.permission.code);
      }
    }
  }

  req.user = {
    id: user.id,
    email: user.email,
    roles: user.userRoles.map((ur) => ur.role.slug),
    permissions: Array.from(permissions),
  };

  next();
}
