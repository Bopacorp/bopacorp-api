import { env } from '@config/env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

const globalForDb = global as unknown as { db: PrismaClient };

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

export const db =
  globalForDb.db ||
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') globalForDb.db = db;
