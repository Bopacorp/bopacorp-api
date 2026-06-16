import { BadRequestError } from '@shared/errors/http-error.js';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new BadRequestError('Only image files are allowed (jpeg, png, webp, avif)'));
    }
    cb(null, true);
  },
});

export function handleImageUpload(req: Request, res: Response, next: NextFunction) {
  imageUpload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new BadRequestError('Image must be smaller than 5 MB'));
      }
      return next(new BadRequestError(err.message));
    }
    if (err) {
      return next(err);
    }
    next();
  });
}
