import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockItems = vi.fn();
const mockCategories = vi.fn();
const mockSegments = vi.fn();

vi.mock('./public-catalog.service.js', () => ({
  listPublicCatalogItems: mockItems,
  listPublicCategories: mockCategories,
  listPublicSegments: mockSegments,
}));

const controller = await import('./public-catalog.controller.js');

function response() {
  return { json: vi.fn() } as unknown as Response;
}

describe('public catalog controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards filters and returns all public catalog envelopes', async () => {
    const query = { categorySlug: 'mobile' };
    const items = [{ id: 'item' }];
    const categories = [{ id: 'category' }];
    const segments = [{ id: 'segment' }];
    mockItems.mockResolvedValue(items);
    mockCategories.mockResolvedValue(categories);
    mockSegments.mockResolvedValue(segments);

    const itemsRes = response();
    await controller.listItems({ query } as unknown as Request, itemsRes);
    expect(mockItems).toHaveBeenCalledWith(query);
    expect(itemsRes.json).toHaveBeenCalledWith({ success: true, data: items });

    const categoriesRes = response();
    await controller.listCategories({} as Request, categoriesRes);
    expect(mockCategories).toHaveBeenCalledWith();
    expect(categoriesRes.json).toHaveBeenCalledWith({ success: true, data: categories });

    const segmentsRes = response();
    await controller.listSegments({} as Request, segmentsRes);
    expect(mockSegments).toHaveBeenCalledWith();
    expect(segmentsRes.json).toHaveBeenCalledWith({ success: true, data: segments });
  });
});
