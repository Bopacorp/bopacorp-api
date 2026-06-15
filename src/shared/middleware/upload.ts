import multer from 'multer';

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

export const uploadSinglePdf = pdfUpload.single('file');

const IMAGE_MIMETYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIMETYPES.has(file.mimetype)) {
      return cb(
        new multer.MulterError(
          'LIMIT_UNEXPECTED_FILE',
          'Only PNG, JPEG and WebP images are allowed'
        )
      );
    }
    cb(null, true);
  },
});

export const uploadSingleImage = imageUpload.single('image');
