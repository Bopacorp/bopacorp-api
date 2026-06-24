import { UuidSchema } from '@bopacorp/shared/common';
import { z } from 'zod';

export const IdParamSchema = z.object({
  id: UuidSchema,
});

export const IdWithSubResourceParamSchema = z.object({
  id: UuidSchema,
  attachmentId: UuidSchema,
});
