import type {
  ChangePasswordRequest,
  LoginRequest,
  LogoutRequest,
  RefreshTokenRequest,
  ResetPasswordRequest,
} from '@bopacorp/shared/auth';
import type { Request, Response } from 'express';
import { authService } from './auth.service.js';

function getClientInfo(req: Request) {
  const info: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) info.ipAddress = req.ip;
  if (req.headers['user-agent']) info.userAgent = req.headers['user-agent'];
  return info;
}

export const authController = {
  async login(req: Request, res: Response) {
    const data = req.body as LoginRequest;
    const result = await authService.login({ ...data, ...getClientInfo(req) });
    res.json({ success: true, data: result });
  },

  async logout(req: Request, res: Response) {
    const { refreshToken } = req.body as LogoutRequest;
    await authService.logout(refreshToken);
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  },

  async refresh(req: Request, res: Response) {
    const data = req.body as RefreshTokenRequest;
    const result = await authService.refresh({ ...data, ...getClientInfo(req) });
    res.json({ success: true, data: result });
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body as { email: string };
    await authService.forgotPassword(email);
    res.json({
      success: true,
      data: { message: 'If the email exists, instructions have been sent' },
    });
  },

  async resetPassword(req: Request, res: Response) {
    const data = req.body as ResetPasswordRequest;
    await authService.resetPassword(data);
    res.json({ success: true, data: { message: 'Password reset successfully' } });
  },

  async changePassword(req: Request, res: Response) {
    const data = req.body as ChangePasswordRequest;
    const userId = req.user?.id ?? '';
    await authService.changePassword(userId, { ...data, ...getClientInfo(req) });
    res.json({ success: true, data: { message: 'Password changed successfully' } });
  },
};
