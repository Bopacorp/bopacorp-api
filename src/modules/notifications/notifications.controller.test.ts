import { UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockList = vi.fn();
const mockUnreadCount = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockMarkAllRead = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('./notifications.service.js', () => ({
  listNotifications: mockList,
  getUnreadCount: mockUnreadCount,
  getNotificationById: mockGet,
  createNotification: mockCreate,
  markAllRead: mockMarkAllRead,
  updateNotification: mockUpdate,
  removeNotification: mockRemove,
}));

const controller = await import('./notifications.controller.js');

const NOTIFICATION_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function request(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: { id: NOTIFICATION_ID },
    query: {},
    ...overrides,
  } as unknown as Request;
}

function response() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

function authenticatedRequest(overrides: Record<string, unknown> = {}) {
  return request({ user: { id: USER_ID, roles: [], permissions: [] }, ...overrides });
}

describe('notifications controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards every operation and returns the expected envelopes', async () => {
    const query = { page: 1, limit: 10, isRead: false };
    const body = { recipientId: USER_ID, title: 'New message', message: 'Hello' };
    const data = { id: NOTIFICATION_ID, title: 'New message' };
    const listResult = {
      data: [data],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    };
    mockList.mockResolvedValue(listResult);
    mockUnreadCount.mockResolvedValue(3);
    mockGet.mockResolvedValue(data);
    mockCreate.mockResolvedValue(data);
    mockUpdate.mockResolvedValue(data);

    const listRes = response();
    await controller.listNotifications(authenticatedRequest({ query }), listRes);
    expect(mockList).toHaveBeenCalledWith(USER_ID, query);
    expect(listRes.json).toHaveBeenCalledWith({ success: true, ...listResult });

    const countRes = response();
    await controller.getUnreadCount(authenticatedRequest(), countRes);
    expect(mockUnreadCount).toHaveBeenCalledWith(USER_ID);
    expect(countRes.json).toHaveBeenCalledWith({ success: true, data: { count: 3 } });

    const getRes = response();
    await controller.getNotificationById(authenticatedRequest(), getRes);
    expect(mockGet).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID);
    expect(getRes.json).toHaveBeenCalledWith({ success: true, data });

    const createRes = response();
    await controller.createNotification(request({ body }), createRes);
    expect(mockCreate).toHaveBeenCalledWith(body);
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createRes.json).toHaveBeenCalledWith({ success: true, data });

    const markRes = response();
    await controller.markAllRead(authenticatedRequest(), markRes);
    expect(mockMarkAllRead).toHaveBeenCalledWith(USER_ID);
    expect(markRes.json).toHaveBeenCalledWith({ success: true, data: null });

    const updateRes = response();
    await controller.updateNotification(
      authenticatedRequest({ body: { isRead: true } }),
      updateRes
    );
    expect(mockUpdate).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID, { isRead: true });
    expect(updateRes.json).toHaveBeenCalledWith({ success: true, data });

    const removeRes = response();
    await controller.removeNotification(authenticatedRequest(), removeRes);
    expect(mockRemove).toHaveBeenCalledWith(USER_ID, NOTIFICATION_ID);
    expect(removeRes.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('requires authentication for protected operations', async () => {
    await expect(controller.listNotifications(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.getUnreadCount(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.getNotificationById(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.markAllRead(request(), response())).rejects.toThrow(UnauthorizedError);
    await expect(controller.updateNotification(request(), response())).rejects.toThrow(
      UnauthorizedError
    );
    await expect(controller.removeNotification(request(), response())).rejects.toThrow(
      UnauthorizedError
    );

    expect(mockList).not.toHaveBeenCalled();
    expect(mockUnreadCount).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockMarkAllRead).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('propagates service failures without writing a response', async () => {
    const error = new Error('notification service unavailable');
    mockList.mockRejectedValue(error);
    const res = response();

    await expect(controller.listNotifications(authenticatedRequest(), res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
