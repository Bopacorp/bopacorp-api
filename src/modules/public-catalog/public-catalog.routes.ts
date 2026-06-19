import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './public-catalog.controller.js';

export const publicCatalogRoutes = Router();

const publicReadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});

publicCatalogRoutes.get('/items', publicReadRateLimit, controller.listItems);
