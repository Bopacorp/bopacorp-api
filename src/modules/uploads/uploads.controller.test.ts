import { BadRequestError, UnauthorizedError } from '@shared/errors/http-error.js';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUploadLandingImage = vi.fn();
vi.mock('./uploads.service.js', () => ({ uploadLandingImage: mockUploadLandingImage }));

const controller = await import('./uploads.controller.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';

function response() {
  const res = { json: vi.fn(), status: vi.fn() } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
}

describe('uploads controller', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires a file and authentication before invoking the service', async () => {
    await expect(
      controller.uploadImage({ query: {} } as unknown as Request, response())
    ).rejects.toThrow(BadRequestError);

    const file = { originalname: 'x.png', buffer: Buffer.from('x'), mimetype: 'image/png' };
    await expect(
      controller.uploadImage({ query: {}, file } as unknown as Request, response())
    ).rejects.toThrow(UnauthorizedError);
    expect(mockUploadLandingImage).not.toHaveBeenCalled();
  });

  it('forwards the file, content key, and user and returns 201', async () => {
    const file = { originalname: 'x.png', buffer: Buffer.from('x'), mimetype: 'image/png' };
    const data = { url: 'https://cdn.example.test/x.png', key: 'x.png', contentKey: 'home.hero' };
    mockUploadLandingImage.mockResolvedValue(data);
    const res = response();
    await controller.uploadImage(
      { query: { contentKey: 'home.hero' }, file, user: { id: USER_ID } } as unknown as Request,
      res
    );
    expect(mockUploadLandingImage).toHaveBeenCalledWith(file, 'home.hero', USER_ID);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });
});
