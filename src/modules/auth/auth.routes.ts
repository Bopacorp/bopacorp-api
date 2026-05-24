import {
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshTokenRequestSchema,
  ResetPasswordRequestSchema,
} from '@bopacorp/shared/auth';
import { authenticate } from '@shared/middleware/authenticate.js';
import { validate } from '@shared/middleware/validate.js';
import { Router } from 'express';
import { authController } from './auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/login', validate({ body: LoginRequestSchema }), authController.login);
authRoutes.post('/logout', validate({ body: LogoutRequestSchema }), authController.logout);
authRoutes.post('/refresh', validate({ body: RefreshTokenRequestSchema }), authController.refresh);
authRoutes.post(
  '/forgot-password',
  validate({ body: ForgotPasswordRequestSchema }),
  authController.forgotPassword
);
authRoutes.post(
  '/reset-password',
  validate({ body: ResetPasswordRequestSchema }),
  authController.resetPassword
);
authRoutes.patch(
  '/change-password',
  authenticate,
  validate({ body: ChangePasswordRequestSchema }),
  authController.changePassword
);
