import { notifications } from '@db/schema/notifications.js';
import { NotFoundError } from '@shared/errors/http-error.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFindUser = vi.fn();
const mockFindNotification = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: {
    $count: mockCount,
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      users: { findFirst: mockFindUser },
      notifications: { findFirst: mockFindNotification },
    },
  },
}));

const service = await import('./notifications.service.js');

const NOTIFICATION_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_NOTIFICATION_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-4444-444444444444';
const REFERENCE_ID = '55555555-5555-5555-5555-555555555555';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function notificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    recipientId: USER_ID,
    title: 'Application reviewed',
    message: 'Your application has been reviewed',
    referenceType: 'job_application',
    referenceId: REFERENCE_ID,
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-08-13T10:00:00.000Z'),
    recipient: {
      id: USER_ID,
      username: 'ada',
      email: 'ada@example.com',
      profile: null,
    },
    ...overrides,
  };
}

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    recipientId: USER_ID,
    title: 'Application reviewed',
    message: 'x'.repeat(120),
    isRead: true,
    readAt: new Date('2026-08-13T11:00:00.000Z'),
    createdAt: new Date('2026-08-13T10:00:00.000Z'),
    ...overrides,
  };
}

function listBuilder(result: unknown) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
  return builder;
}

function insertResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return values;
}

function updateResult() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return set;
}

describe('notifications service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists notifications with filters, pagination, truncation, and recipient fallback', async () => {
    mockCount.mockResolvedValue(3);
    const builder = listBuilder([listRow()]);
    mockSelect.mockReturnValueOnce(builder);
    mockFindUser.mockResolvedValueOnce({ id: USER_ID, username: 'ada' });

    await expect(
      service.listNotifications(USER_ID, {
        page: 2,
        limit: 2,
        isRead: true,
      } as never)
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: NOTIFICATION_ID,
          message: 'x'.repeat(100),
          readAt: '2026-08-13T11:00:00.000Z',
          recipient: { id: USER_ID, username: 'ada' },
        }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(builder.limit).toHaveBeenCalledWith(2);
    expect(builder.offset).toHaveBeenCalledWith(2);

    mockCount.mockResolvedValue(0);
    mockSelect.mockReturnValueOnce(listBuilder([listRow({ readAt: null, isRead: false })]));
    mockFindUser.mockResolvedValueOnce(undefined);
    await expect(
      service.listNotifications(USER_ID, { page: 1, limit: 10 } as never)
    ).resolves.toEqual(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            readAt: null,
            recipient: { id: USER_ID, username: '' },
          }),
        ],
        meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
      })
    );
  });

  it('returns the unread count for a user', async () => {
    mockCount.mockResolvedValue(4);

    await expect(service.getUnreadCount(USER_ID)).resolves.toBe(4);
    expect(mockCount).toHaveBeenCalledWith(notifications, expect.anything());
  });

  it('returns owned notification details with relation mapping and rejects inaccessible rows', async () => {
    mockFindNotification.mockResolvedValueOnce(notificationRow());
    await expect(service.getNotificationById(USER_ID, NOTIFICATION_ID)).resolves.toEqual(
      expect.objectContaining({
        id: NOTIFICATION_ID,
        recipient: {
          id: USER_ID,
          username: 'ada',
          email: 'ada@example.com',
          profile: null,
        },
        readAt: null,
      })
    );

    mockFindNotification.mockResolvedValueOnce(
      notificationRow({ recipient: null, referenceType: null, referenceId: null, readAt: NOW })
    );
    await expect(service.getNotificationById(USER_ID, NOTIFICATION_ID)).resolves.toEqual(
      expect.objectContaining({ recipient: null, readAt: NOW.toISOString() })
    );

    mockFindNotification.mockResolvedValueOnce(notificationRow({ recipientId: OTHER_USER_ID }));
    await expect(service.getNotificationById(USER_ID, OTHER_NOTIFICATION_ID)).rejects.toThrow(
      NotFoundError
    );

    mockFindNotification.mockResolvedValueOnce(undefined);
    await expect(service.getNotificationById(USER_ID, OTHER_NOTIFICATION_ID)).rejects.toThrow(
      NotFoundError
    );
  });

  it('creates notifications for existing users and rejects invalid inserts', async () => {
    const input = {
      recipientId: USER_ID,
      title: 'Application reviewed',
      message: 'Your application has been reviewed',
      referenceType: 'job_application',
      referenceId: REFERENCE_ID,
    };
    mockFindUser.mockResolvedValueOnce({ id: USER_ID });
    const values = insertResult([{ id: NOTIFICATION_ID }]);
    mockFindNotification.mockResolvedValueOnce(notificationRow());

    await expect(service.createNotification(input)).resolves.toEqual(
      expect.objectContaining({ id: NOTIFICATION_ID })
    );
    expect(values).toHaveBeenCalledWith(input);

    mockFindUser.mockResolvedValueOnce(undefined);
    await expect(service.createNotification(input)).rejects.toThrow(NotFoundError);

    mockFindUser.mockResolvedValueOnce({ id: USER_ID });
    insertResult([]);
    await expect(service.createNotification(input)).rejects.toThrow(
      'Failed to create notification'
    );
  });

  it('marks all unread notifications as read with the current timestamp', async () => {
    const set = updateResult();

    await expect(service.markAllRead(USER_ID)).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith({ isRead: true, readAt: NOW });
  });

  it('updates notification read state and clears the timestamp when unread', async () => {
    mockFindNotification.mockResolvedValueOnce(notificationRow());
    const readSet = updateResult();
    mockFindNotification.mockResolvedValueOnce(notificationRow({ isRead: true, readAt: NOW }));

    await expect(
      service.updateNotification(USER_ID, NOTIFICATION_ID, { isRead: true })
    ).resolves.toEqual(expect.objectContaining({ isRead: true, readAt: NOW.toISOString() }));
    expect(readSet).toHaveBeenCalledWith({ isRead: true, readAt: NOW });

    mockFindNotification.mockResolvedValueOnce(notificationRow({ isRead: true, readAt: NOW }));
    const unreadSet = updateResult();
    mockFindNotification.mockResolvedValueOnce(notificationRow({ isRead: false, readAt: null }));

    await expect(
      service.updateNotification(USER_ID, NOTIFICATION_ID, { isRead: false })
    ).resolves.toEqual(expect.objectContaining({ isRead: false, readAt: null }));
    expect(unreadSet).toHaveBeenCalledWith({ isRead: false, readAt: null });

    mockFindNotification.mockResolvedValueOnce(undefined);
    await expect(
      service.updateNotification(USER_ID, OTHER_NOTIFICATION_ID, { isRead: true })
    ).rejects.toThrow(NotFoundError);
  });

  it('deletes an owned notification and rejects inaccessible deletes', async () => {
    mockFindNotification.mockResolvedValueOnce(notificationRow());

    await expect(service.removeNotification(USER_ID, NOTIFICATION_ID)).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledWith(notifications);

    mockFindNotification.mockResolvedValueOnce(notificationRow({ recipientId: OTHER_USER_ID }));
    await expect(service.removeNotification(USER_ID, OTHER_NOTIFICATION_ID)).rejects.toThrow(
      NotFoundError
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
