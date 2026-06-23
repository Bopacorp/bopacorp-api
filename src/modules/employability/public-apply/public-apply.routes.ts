import { ApplyJobVacancyRequestSchema } from '@bopacorp/shared/employability';
import { uploadSinglePdf } from '@shared/middleware/upload.js';
import { validate } from '@shared/middleware/validate.js';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './public-apply.controller.js';

export const publicApplyRoutes = Router();

const applyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many applications from this IP' },
  },
});

function parseMultipartJsonBody(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const field of fields) {
      const value = req.body?.[field];
      if (typeof value === 'string') {
        try {
          req.body[field] = JSON.parse(value);
        } catch {
          // Leave as string; validation will catch invalid JSON
        }
      }
    }
    next();
  };
}

publicApplyRoutes.post(
  '/',
  applyRateLimit,
  uploadSinglePdf,
  parseMultipartJsonBody(['candidate']),
  validate({ body: ApplyJobVacancyRequestSchema }),
  controller.applyJobVacancy
);
