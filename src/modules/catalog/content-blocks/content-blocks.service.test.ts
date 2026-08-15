import { ContentTypeCode } from '@bopacorp/shared/catalog';
import { contentBlocks } from '@db/schema/catalog.js';
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCount = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockGetContentTypeById = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: { $count: mockCount, select: mockSelect, insert: mockInsert, update: mockUpdate },
}));
vi.mock('../content-types/content-types.service.js', () => ({
  getContentTypeById: mockGetContentTypeById,
}));

const service = await import('./content-blocks.service.js');

const BLOCK_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_BLOCK_ID = '22222222-2222-2222-2222-222222222222';
const TYPE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function block(overrides: Record<string, unknown> = {}) {
  return {
    id: BLOCK_ID,
    contentKey: 'home.hero.title',
    contentTypeId: TYPE_ID,
    title: 'Hero title',
    body: 'Welcome',
    sortOrder: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    contentTypeIdJoined: TYPE_ID,
    contentTypeCode: ContentTypeCode.TEXT,
    contentTypeName: 'Text',
    ...overrides,
  };
}

function blockQuery(result: unknown) {
  const builder = { from: vi.fn(), leftJoin: vi.fn(), where: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.leftJoin.mockReturnValue(builder);
  builder.where.mockResolvedValue(result);
  return builder;
}

function listQuery(result: unknown) {
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
  const builder = { from: vi.fn(), where: vi.fn() };
  builder.from.mockReturnValue(builder);
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

describe('content blocks service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockGetContentTypeById.mockResolvedValue({
      id: TYPE_ID,
      code: ContentTypeCode.TEXT,
      name: 'Text',
    });
  });

  it('lists and maps blocks with all filters and pagination metadata', async () => {
    mockCount.mockResolvedValue(3);
    const rows = [block(), block({ id: OTHER_BLOCK_ID, contentTypeIdJoined: null })];
    const builder = listQuery(rows);
    mockSelect.mockReturnValueOnce(builder);

    await expect(
      service.listContentBlocks({
        page: 2,
        limit: 2,
        contentTypeId: TYPE_ID,
        section: 'home',
        search: 'hero',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      } as never)
    ).resolves.toEqual({
      data: [
        expect.objectContaining({
          contentType: { id: TYPE_ID, code: ContentTypeCode.TEXT, name: 'Text' },
        }),
        expect.objectContaining({ contentType: null }),
      ],
      meta: { page: 2, limit: 2, totalItems: 3, totalPages: 2 },
    });
    expect(mockCount).toHaveBeenCalledWith(contentBlocks, expect.anything());
    expect(builder.limit).toHaveBeenCalledWith(2);
    expect(builder.offset).toHaveBeenCalledWith(2);
  });

  it('gets blocks and rejects missing or deleted rows', async () => {
    mockSelect.mockReturnValueOnce(blockQuery([block()]));
    await expect(service.getContentBlockById(BLOCK_ID)).resolves.toEqual(
      expect.objectContaining({ id: BLOCK_ID, contentType: expect.any(Object) })
    );

    mockSelect.mockReturnValueOnce(blockQuery([]));
    await expect(service.getContentBlockById(OTHER_BLOCK_ID)).rejects.toThrow(NotFoundError);
  });

  it('validates image blocks, detects duplicate keys, creates, and handles failed hydration', async () => {
    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.IMAGE });
    await expect(
      service.createContentBlock(
        { contentTypeId: TYPE_ID, contentKey: 'home.image', body: 'invalid' } as never,
        USER_ID
      )
    ).rejects.toThrow(BadRequestError);

    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.TEXT });
    mockSelect.mockReturnValueOnce(terminalSelect([block()]));
    await expect(
      service.createContentBlock(
        { contentTypeId: TYPE_ID, contentKey: 'home.hero.title' } as never,
        USER_ID
      )
    ).rejects.toThrow(ConflictError);

    const inserted = block({ id: OTHER_BLOCK_ID });
    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.TEXT });
    mockSelect.mockReturnValueOnce(terminalSelect([]));
    const values = insertResult([inserted]);
    mockSelect.mockReturnValueOnce(blockQuery([inserted]));
    await expect(
      service.createContentBlock(
        { contentTypeId: TYPE_ID, contentKey: 'home.hero.subtitle', body: '' } as never,
        USER_ID
      )
    ).resolves.toEqual(expect.objectContaining({ id: OTHER_BLOCK_ID }));
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        contentTypeId: TYPE_ID,
        contentKey: 'home.hero.subtitle',
        updatedBy: USER_ID,
      })
    );

    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.TEXT });
    mockSelect.mockReturnValueOnce(terminalSelect([]));
    insertResult([]);
    await expect(
      service.createContentBlock(
        { contentTypeId: TYPE_ID, contentKey: 'home.empty' } as never,
        USER_ID
      )
    ).rejects.toThrow(InternalServerError);

    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.TEXT });
    mockSelect.mockReturnValueOnce(terminalSelect([]));
    insertResult([{ id: OTHER_BLOCK_ID }]);
    mockSelect.mockReturnValueOnce(blockQuery([]));
    await expect(
      service.createContentBlock(
        { contentTypeId: TYPE_ID, contentKey: 'home.unhydrated' } as never,
        USER_ID
      )
    ).rejects.toThrow(InternalServerError);
  });

  it('updates blocks with effective types, duplicate protection, and response hydration', async () => {
    mockSelect.mockReturnValueOnce(blockQuery([block()]));
    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.IMAGE });
    await expect(
      service.updateContentBlock(BLOCK_ID, { body: 'not-valid' } as never, USER_ID)
    ).rejects.toThrow(BadRequestError);

    mockSelect.mockReturnValueOnce(blockQuery([block()]));
    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.TEXT });
    mockSelect.mockReturnValueOnce(terminalSelect([block({ id: OTHER_BLOCK_ID })]));
    await expect(
      service.updateContentBlock(BLOCK_ID, { contentKey: 'existing.key' } as never, USER_ID)
    ).rejects.toThrow(ConflictError);

    const updated = block({ body: 'https://cdn.example.test/image.png' });
    mockSelect.mockReturnValueOnce(blockQuery([block()]));
    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.IMAGE });
    mockSelect.mockReturnValueOnce(terminalSelect([block()]));
    const set = updateResult([updated]);
    mockSelect.mockReturnValueOnce(blockQuery([updated]));
    await expect(
      service.updateContentBlock(
        BLOCK_ID,
        {
          contentKey: 'home.hero.title',
          contentTypeId: TYPE_ID,
          body: updated.body,
          title: 'Updated',
          sortOrder: 4,
        } as never,
        USER_ID
      )
    ).resolves.toEqual(expect.objectContaining({ body: updated.body }));
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedBy: USER_ID,
        contentKey: 'home.hero.title',
        title: 'Updated',
      })
    );

    mockSelect.mockReturnValueOnce(blockQuery([block()]));
    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.TEXT });
    updateResult([]);
    await expect(
      service.updateContentBlock(BLOCK_ID, { title: 'Gone' } as never, USER_ID)
    ).rejects.toThrow(NotFoundError);

    mockSelect.mockReturnValueOnce(blockQuery([block()]));
    mockGetContentTypeById.mockResolvedValueOnce({ code: ContentTypeCode.TEXT });
    updateResult([{ id: BLOCK_ID }]);
    mockSelect.mockReturnValueOnce(blockQuery([]));
    await expect(
      service.updateContentBlock(BLOCK_ID, { title: 'Unhydrated' } as never, USER_ID)
    ).rejects.toThrow(InternalServerError);
  });

  it('soft deletes blocks and lists section counts', async () => {
    mockSelect.mockReturnValueOnce(blockQuery([block()]));
    const set = updateResult([]);
    await expect(service.deleteContentBlock(BLOCK_ID)).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith({ deletedAt: NOW });

    const sections = [{ prefix: 'home', count: 2 }];
    const builder = {
      from: vi.fn(),
      where: vi.fn(),
      groupBy: vi.fn(),
      orderBy: vi.fn(),
    };
    builder.from.mockReturnValue(builder);
    builder.where.mockReturnValue(builder);
    builder.groupBy.mockReturnValue(builder);
    builder.orderBy.mockResolvedValue(sections);
    mockSelect.mockReturnValueOnce(builder);
    await expect(service.listSections()).resolves.toEqual(sections);
  });
});
