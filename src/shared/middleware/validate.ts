import { HttpError } from '@shared/errors/http-error.js';
import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

interface ValidationSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

interface ValidationDetail {
  field: string;
  message: string;
}

export class ValidationError extends HttpError {
  constructor(public readonly details: ValidationDetail[]) {
    super(422, 'Validation failed', 'VALIDATION_ERROR');
  }
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const details: ValidationDetail[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        req.params = result.data as Record<string, string>;
      } else {
        details.push(...formatIssues(result.error.issues));
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        Object.defineProperty(req, 'query', {
          value: result.data,
          configurable: true,
          enumerable: true,
          writable: true,
        });
      } else {
        details.push(...formatIssues(result.error.issues));
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
      } else {
        details.push(...formatIssues(result.error.issues));
      }
    }

    if (details.length > 0) {
      throw new ValidationError(details);
    }

    next();
  };
}

function formatIssues(issues: z.core.$ZodIssue[]): ValidationDetail[] {
  return issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
