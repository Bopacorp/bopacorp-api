import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPublicBlocks = vi.fn();
vi.mock('./cms.service.js', () => ({ getPublicBlocks: mockGetPublicBlocks }));

const controller = await import('./cms.controller.js');

describe('cms controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the landing block envelope', async () => {
    const data = { blocks: { 'home.title': { body: 'Hello' } } };
    mockGetPublicBlocks.mockResolvedValue(data);
    const res = { json: vi.fn() } as unknown as Response;
    await controller.getLandingBlocks({} as Request, res);
    expect(mockGetPublicBlocks).toHaveBeenCalledWith();
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });
});
