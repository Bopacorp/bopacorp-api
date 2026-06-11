import type { File } from 'multer';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        permissions: string[];
      };
      file?: File;
    }
  }
}

export {};
