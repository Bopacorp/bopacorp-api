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

const DOCUMENT_MIMETYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!DOCUMENT_MIMETYPES.has(file.mimetype)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Unsupported document file type'));
    }
    cb(null, true);
  },
});

export const uploadSingleDocument = documentUpload.single('file');
