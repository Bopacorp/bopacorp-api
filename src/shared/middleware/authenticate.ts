import { env } from '@config/env.js';
import { users } from '@db/schema/auth.js';
import { db } from '@lib/db.js';
import { UnauthorizedError } from '@shared/errors/http-error.js';
import { and, eq, isNull } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);

  let payload: { sub: string; email: string; roles: string[]; permissions: string[] };

  try {
    payload = jwt.verify(token, env.JWT_SECRET) as typeof payload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, payload.sub), isNull(users.deletedAt)),
    columns: { isActive: true },
  });

  if (!user?.isActive) {
    throw new UnauthorizedError('User inactive or deleted');
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
    roles: payload.roles,
    permissions: payload.permissions,
  };

  next();
}
