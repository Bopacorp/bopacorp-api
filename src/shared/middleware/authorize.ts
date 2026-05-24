import { ForbiddenError } from '@shared/errors/http-error.js';
import type { NextFunction, Request, Response } from 'express';

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      throw new ForbiddenError('Authentication required');
    }

    const hasAllPermissions = requiredPermissions.every((p) => user.permissions.includes(p));

    if (!hasAllPermissions) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
}
