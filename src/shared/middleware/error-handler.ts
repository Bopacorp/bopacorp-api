import { createModuleLogger } from '@lib/logger.js';
import { HttpError } from '@shared/errors/http-error.js';
import { ValidationError } from '@shared/middleware/validate.js';
import type { NextFunction, Request, Response } from 'express';

const logger = createModuleLogger('error-handler');

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ValidationError) {
    logger.warn({ path: req.path, details: err.details }, err.message);
    res.status(422).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    logger.warn({ path: req.path, code: err.code }, err.message);
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
