import { Router } from 'express';
import * as controller from './cms.controller.js';

export const cmsRoutes = Router();

cmsRoutes.get('/landing', controller.getLandingBlocks);
