import { NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: { $count: mockCount, select: mockSelect, insert: mockInsert, update: mockUpdate },
}));

const service = await import('./contact-requests.service.js');

const REQUEST_ID = '11111111-1111-1111-1111-111111111111';
const ITEM_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    itemId: ITEM_ID,
    clientName: 'Ana Client',
    clientEmail: 'ana@example.test',
    clientPhone: '0999999999',
    message: 'Please contact me',
    isAttended: false,
    attendedAt: null,
    attendedBy: null,
    createdAt: new Date('2026-08-13T10:00:00.000Z'),
    ...overrides,
  };
}

function listBuilder(result: unknown) {
  const builder = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.offset.mockResolvedValue(result);
  return builder;
}

function terminalSelect(result: unknown) {
  const builder = { from: vi.fn(), leftJoin: vi.fn(), where: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  return builder;
}

function insertResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  mockInsert.mockReturnValueOnce({ values });
  return values;
}

function updateResult(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return set;
}

describe('contact requests service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it('lists requests with filters, pagination, item names, and ISO dates', async () => {
    mockCount.mockResolvedValue(3);
    const row = requestRow({
      attendedAt: new Date('2026-08-13T11:00:00.000Z'),
      attendedBy: USER_ID,
    });
    const builder = listBuilder([{ request: row, itemName: 'Premium plan' }]);
    mockSelect.mockReturnValueOnce(builder);

    await expect(
      service.listContactRequests({
        page: 2,
        limit: 2,
        itemId: ITEM_ID,
        isAttended: true,
        search: 'ana',
      } as never)
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          itemName: 'Premium plan',
          attendedAt: '2026-08-13T11:00:00.000Z',
          createdAt: '2026-08-13T10:00:00.000Z',
        }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });

    mockCount.mockResolvedValue(0);
    mockSelect.mockReturnValueOnce(listBuilder([]));
    await expect(service.listContactRequests({ page: 1, limit: 10 } as never)).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
  });

  it('gets requests, creates public requests, and handles missing insert results', async () => {
    const row = requestRow();
    mockSelect.mockReturnValueOnce(terminalSelect([{ request: row, itemName: null }]));
    await expect(service.getContactRequestById(REQUEST_ID)).resolves.toEqual(
      expect.objectContaining({ id: REQUEST_ID, itemName: null, attendedAt: null })
    );

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(service.getContactRequestById(REQUEST_ID)).rejects.toThrow(NotFoundError);

    const inserted = requestRow({ isAttended: false });
    const values = insertResult([inserted]);
    await expect(
      service.createContactRequest({
        itemId: ITEM_ID,
        clientName: 'Ana Client',
        clientEmail: 'ana@example.test',
        clientPhone: '0999999999',
        message: 'Hello',
      } as never)
    ).resolves.toEqual(expect.objectContaining({ id: REQUEST_ID, itemName: null }));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ itemId: ITEM_ID }));

    insertResult([]);
    await expect(service.createContactRequest({ clientName: 'Empty' } as never)).rejects.toThrow(
      NotFoundError
    );
  });

  it('attends requests with the authenticated operator and handles failed updates', async () => {
    const existing = requestRow();
    mockSelect.mockReturnValueOnce(
      terminalSelect([{ request: existing, itemName: 'Premium plan' }])
    );
    const updated = requestRow({
      isAttended: true,
      attendedAt: NOW,
      attendedBy: USER_ID,
    });
    const set = updateResult([updated]);
    await expect(service.attendContactRequest(REQUEST_ID, USER_ID)).resolves.toEqual(
      expect.objectContaining({ itemName: 'Premium plan', isAttended: true })
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ isAttended: true, attendedBy: USER_ID, attendedAt: NOW })
    );

    mockSelect.mockReturnValueOnce(terminalSelect([{ request: existing, itemName: null }]));
    updateResult([]);
    await expect(service.attendContactRequest(REQUEST_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });
});
