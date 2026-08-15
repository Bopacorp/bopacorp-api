import { categories } from '@db/schema/catalog.js';
import { ConflictError, InternalServerError, NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@lib/db.js', () => ({
  db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
}));

const service = await import('./categories.service.js');

const CATEGORY_ID = '11111111-1111-1111-1111-111111111111';
const PARENT_ID = '22222222-2222-2222-2222-222222222222';
const MISSING_ID = '33333333-3333-3333-3333-333333333333';
const NOW = new Date('2026-08-14T12:00:00.000Z');

function category(overrides: Record<string, unknown> = {}) {
  return {
    id: CATEGORY_ID,
    parentId: null,
    name: 'Mobile plans',
    slug: 'mobile-plans',
    description: 'Plans',
    sortOrder: 1,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function orderedSelect(result: unknown) {
  const builder = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockResolvedValue(result);
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

describe('categories service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it('lists categories with search, null-parent, and active filters', async () => {
    const rows = [category()];
    const builder = orderedSelect(rows);
    mockSelect.mockReturnValueOnce(builder);

    await expect(
      service.listCategories({ search: 'mobile', parentId: null, isActive: true } as never)
    ).resolves.toEqual(rows);
    expect(builder.from).toHaveBeenCalledWith(categories);

    const secondBuilder = orderedSelect([]);
    mockSelect.mockReturnValueOnce(secondBuilder);
    await expect(service.listCategories({ parentId: PARENT_ID } as never)).resolves.toEqual([]);
  });

  it('builds a tree with nested, root, and orphaned active categories', async () => {
    const rows = [
      category({ id: PARENT_ID, name: 'Parent', sortOrder: 1 }),
      category({ id: CATEGORY_ID, parentId: PARENT_ID, name: 'Child', sortOrder: 2 }),
      category({
        id: MISSING_ID,
        parentId: '44444444-4444-4444-4444-444444444444',
        name: 'Orphan',
      }),
    ];
    mockSelect.mockReturnValueOnce(orderedSelect(rows));

    await expect(service.getCategoryTree()).resolves.toEqual([
      expect.objectContaining({
        id: PARENT_ID,
        children: [expect.objectContaining({ id: CATEGORY_ID, children: [] })],
      }),
      expect.objectContaining({ id: MISSING_ID, children: [] }),
    ]);
  });

  it('gets categories and rejects missing records', async () => {
    mockSelect.mockReturnValueOnce(terminalSelect([category()]));
    await expect(service.getCategoryById(CATEGORY_ID)).resolves.toEqual(category());

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(service.getCategoryById(MISSING_ID)).rejects.toThrow(NotFoundError);
  });

  it('creates categories with optional parent validation and handles failed inserts', async () => {
    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(service.createCategory({ parentId: MISSING_ID } as never)).rejects.toThrow(
      NotFoundError
    );

    const parent = category({ id: PARENT_ID });
    mockSelect.mockReturnValueOnce(terminalSelect([parent]));
    const values = insertResult([category({ parentId: PARENT_ID })]);
    await expect(
      service.createCategory({ parentId: PARENT_ID, name: 'Child', slug: 'child' } as never)
    ).resolves.toEqual(category({ parentId: PARENT_ID }));
    expect(values).toHaveBeenCalledWith({ parentId: PARENT_ID, name: 'Child', slug: 'child' });

    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    });
    await expect(service.createCategory({ name: 'Empty' } as never)).rejects.toThrow(
      InternalServerError
    );
  });

  it('updates categories, validates parent changes, and disables records', async () => {
    mockSelect.mockReturnValueOnce(terminalSelect([category()]));
    await expect(
      service.updateCategory(CATEGORY_ID, { parentId: CATEGORY_ID } as never)
    ).rejects.toThrow(ConflictError);

    mockSelect.mockReturnValueOnce(terminalSelect([category()]));
    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(
      service.updateCategory(CATEGORY_ID, { parentId: MISSING_ID } as never)
    ).rejects.toThrow(NotFoundError);

    const updated = category({ parentId: null, name: 'Updated' });
    mockSelect.mockReturnValueOnce(terminalSelect([category()]));
    const set = updateResult([updated]);
    await expect(
      service.updateCategory(CATEGORY_ID, {
        parentId: null,
        name: 'Updated',
        isActive: false,
      } as never)
    ).resolves.toEqual(updated);
    expect(set).toHaveBeenCalledWith({
      updatedAt: NOW,
      parentId: null,
      name: 'Updated',
      isActive: false,
    });

    mockSelect.mockReturnValueOnce(terminalSelect([category()]));
    updateResult([]);
    await expect(service.updateCategory(CATEGORY_ID, { name: 'No row' } as never)).rejects.toThrow(
      NotFoundError
    );

    mockSelect.mockReturnValueOnce(terminalSelect([category()]));
    const disableSet = updateResult([]);
    await expect(service.disableCategory(CATEGORY_ID)).resolves.toBeUndefined();
    expect(disableSet).toHaveBeenCalledWith({ isActive: false, updatedAt: NOW });

    mockSelect.mockReturnValueOnce(terminalSelect([]));
    await expect(service.disableCategory(MISSING_ID)).rejects.toThrow(NotFoundError);
  });
});
