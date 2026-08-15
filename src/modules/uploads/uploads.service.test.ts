import { NotFoundError } from '@shared/errors/http-error.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockBuildImageKey = vi.fn();
const mockUploadImage = vi.fn();
const mockDeleteImage = vi.fn();
const mockGetPublicImageUrl = vi.fn();

vi.mock('@config/env.js', () => ({ env: { R2_PUBLIC_URL: 'https://cdn.example.test' } }));
vi.mock('@lib/db.js', () => ({
  db: {
    query: { contentBlocks: { findFirst: mockFindFirst } },
    update: mockUpdate,
  },
}));
vi.mock('@lib/storage.js', () => ({
  buildImageKey: mockBuildImageKey,
  uploadImage: mockUploadImage,
  deleteImage: mockDeleteImage,
  getPublicImageUrl: mockGetPublicImageUrl,
}));

const service = await import('./uploads.service.js');

const BLOCK_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function updateBuilder() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  mockUpdate.mockReturnValueOnce({ set });
  return set;
}

describe('uploads service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockBuildImageKey.mockReturnValue('landing/new-image.png');
    mockGetPublicImageUrl.mockReturnValue('https://cdn.example.test/landing/new-image.png');
    mockUploadImage.mockResolvedValue(undefined);
  });

  it('uploads a landing image without a content block', async () => {
    const file = {
      originalname: 'hero.png',
      buffer: Buffer.from('image'),
      mimetype: 'image/png',
    } as Express.Multer.File;
    await expect(service.uploadLandingImage(file, undefined, USER_ID)).resolves.toEqual({
      url: 'https://cdn.example.test/landing/new-image.png',
      key: 'landing/new-image.png',
      contentKey: undefined,
    });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUploadImage).toHaveBeenCalledWith(
      'landing/new-image.png',
      file.buffer,
      file.mimetype
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a missing content block before uploading', async () => {
    mockFindFirst.mockResolvedValueOnce(undefined);
    const file = {
      originalname: 'hero.png',
      buffer: Buffer.from('image'),
      mimetype: 'image/png',
    } as Express.Multer.File;
    await expect(service.uploadLandingImage(file, 'home.hero', USER_ID)).rejects.toThrow(
      NotFoundError
    );
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it('replaces old R2 images, updates the block, and ignores cleanup errors', async () => {
    const block = {
      id: BLOCK_ID,
      contentKey: 'home.hero',
      body: 'https://cdn.example.test/landing/old.png',
    };
    mockFindFirst.mockResolvedValueOnce(block).mockResolvedValueOnce(block);
    mockDeleteImage.mockRejectedValueOnce(new Error('cleanup failed'));
    const set = updateBuilder();
    const file = {
      originalname: 'hero.png',
      buffer: Buffer.from('image'),
      mimetype: 'image/png',
    } as Express.Multer.File;

    await expect(service.uploadLandingImage(file, 'home.hero', USER_ID)).resolves.toEqual(
      expect.objectContaining({ contentKey: 'home.hero' })
    );
    expect(mockDeleteImage).toHaveBeenCalledWith('landing/old.png');
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'https://cdn.example.test/landing/new-image.png',
        updatedBy: USER_ID,
      })
    );
  });

  it('does not delete foreign, empty, or unchanged previous image URLs', async () => {
    const file = {
      originalname: 'hero.png',
      buffer: Buffer.from('image'),
      mimetype: 'image/png',
    } as Express.Multer.File;
    const cases = [
      { id: '1', contentKey: 'foreign', body: 'https://other.example.test/old.png' },
      { id: '2', contentKey: 'empty', body: null },
      { id: '3', contentKey: 'same', body: 'https://cdn.example.test/landing/new-image.png' },
    ];
    for (const block of cases) {
      mockFindFirst.mockResolvedValueOnce(block).mockResolvedValueOnce(block);
      updateBuilder();
      await service.uploadLandingImage(file, block.contentKey, USER_ID);
    }
    expect(mockDeleteImage).not.toHaveBeenCalled();
  });
});
