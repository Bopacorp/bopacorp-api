import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();

vi.mock('@lib/db.js', () => ({ db: { select: mockSelect } }));

const service = await import('./cms.service.js');

function builder(result: unknown) {
  const query = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockResolvedValue(result);
  return query;
}

describe('cms service', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns active landing blocks indexed by content key in sort order', async () => {
    const rows = [
      {
        id: '1',
        contentKey: 'home.title',
        contentTypeId: 'type',
        title: 'Title',
        body: 'First',
        sortOrder: 1,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: '2',
        contentKey: 'home.title',
        contentTypeId: 'type',
        title: 'Title updated',
        body: 'Last',
        sortOrder: 2,
        createdAt: null,
        updatedAt: null,
      },
    ];
    mockSelect.mockReturnValueOnce(builder(rows));
    await expect(service.getPublicBlocks()).resolves.toEqual({
      blocks: { 'home.title': rows[1] },
    });
  });

  it('returns an empty block map when no active blocks exist', async () => {
    mockSelect.mockReturnValueOnce(builder([]));
    await expect(service.getPublicBlocks()).resolves.toEqual({ blocks: {} });
  });
});
