import { UuidSchema } from '@bopacorp/shared/common';
import { z } from 'zod';

export const IdParamSchema = z.object({
  id: UuidSchema,
});
