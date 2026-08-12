import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockRefresh = vi.fn();
const mockForgotPassword = vi.fn();
const mockResetPassword = vi.fn();
const mockChangePassword = vi.fn();
const mockGetMe = vi.fn();

vi.mock('./auth.service.js', () => ({
  authService: {
    login: mockLogin,
    logout: mockLogout,
    refresh: mockRefresh,
    forgotPassword: mockForgotPassword,
    resetPassword: mockResetPassword,
    changePassword: mockChangePassword,
    getMe: mockGetMe,
  },
}));

const { authController } = await import('./auth.controller.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const CLIENT_IP = '203.0.113.8';
const USER_AGENT = 'BOPA-API-Test/1.0';

function createResponse() {
  return { json: vi.fn() } as unknown as Response;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    headers: {},
    ...overrides,
  } as unknown as Request;
}

describe('authController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the login envelope and forwards client information', async () => {
    const body = { email: 'user@bopacorp.com', password: 'Password1!' };
    const result = {
      user: { id: USER_ID, email: body.email },
      tokens: { accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 900 },
    };
    const req = createRequest({ body, ip: CLIENT_IP, headers: { 'user-agent': USER_AGENT } });
    const res = createResponse();
    mockLogin.mockResolvedValue(result);

    await authController.login(req, res);

    expect(mockLogin).toHaveBeenCalledWith({
      ...body,
      ipAddress: CLIENT_IP,
      userAgent: USER_AGENT,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: result });
  });

  it('returns the logout success envelope', async () => {
    const refreshToken = 'refresh-token';
    const res = createResponse();
    mockLogout.mockResolvedValue(undefined);

    await authController.logout(createRequest({ body: { refreshToken } }), res);

    expect(mockLogout).toHaveBeenCalledWith(refreshToken);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });

  it('returns the refresh envelope and forwards client information', async () => {
    const body = { refreshToken: 'refresh-token' };
    const result = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
    };
    const req = createRequest({ body, ip: CLIENT_IP, headers: { 'user-agent': USER_AGENT } });
    const res = createResponse();
    mockRefresh.mockResolvedValue(result);

    await authController.refresh(req, res);

    expect(mockRefresh).toHaveBeenCalledWith({
      ...body,
      ipAddress: CLIENT_IP,
      userAgent: USER_AGENT,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: result });
  });

  it('returns the non-disclosing forgot-password success envelope', async () => {
    const email = 'user@bopacorp.com';
    const res = createResponse();
    mockForgotPassword.mockResolvedValue(undefined);

    await authController.forgotPassword(createRequest({ body: { email } }), res);

    expect(mockForgotPassword).toHaveBeenCalledWith(email);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'If the email exists, instructions have been sent' },
    });
  });

  it('returns the reset-password success envelope', async () => {
    const body = { token: 'reset-token', newPassword: 'Password1!' };
    const res = createResponse();
    mockResetPassword.mockResolvedValue(undefined);

    await authController.resetPassword(createRequest({ body }), res);

    expect(mockResetPassword).toHaveBeenCalledWith(body);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Password reset successfully' },
    });
  });

  it('returns the authenticated user envelope', async () => {
    const data = {
      id: USER_ID,
      username: 'bopa-user',
      email: 'user@bopacorp.com',
      roles: [],
      profile: null,
    };
    const res = createResponse();
    mockGetMe.mockResolvedValue(data);

    await authController.getMe(createRequest({ user: { id: USER_ID } }), res);

    expect(mockGetMe).toHaveBeenCalledWith(USER_ID);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it('rejects unauthenticated get-me requests before calling the service', async () => {
    await expect(authController.getMe(createRequest(), createResponse())).rejects.toThrow(
      UnauthorizedError
    );

    expect(mockGetMe).not.toHaveBeenCalled();
  });

  it('returns the change-password success envelope and forwards client information', async () => {
    const body = { currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' };
    const req = createRequest({
      body,
      user: { id: USER_ID },
      ip: CLIENT_IP,
      headers: { 'user-agent': USER_AGENT },
    });
    const res = createResponse();
    mockChangePassword.mockResolvedValue(undefined);

    await authController.changePassword(req, res);

    expect(mockChangePassword).toHaveBeenCalledWith(USER_ID, {
      ...body,
      ipAddress: CLIENT_IP,
      userAgent: USER_AGENT,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  });

  it('rejects unauthenticated change-password requests before calling the service', async () => {
    await expect(authController.changePassword(createRequest(), createResponse())).rejects.toThrow(
      UnauthorizedError
    );

    expect(mockChangePassword).not.toHaveBeenCalled();
  });
});
