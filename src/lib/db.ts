import { env } from '@config/env.js';
import { logger } from '@lib/logger.js';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema/index.js';

let pool: pg.Pool | null = null;
let drizzleInstance: NodePgDatabase<typeof schema> | null = null;

function createPool(): pg.Pool {
  const newPool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === 'production' ? 20 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  newPool.on('error', (err) => {
    logger.error(err, 'Unexpected pool error, discarding pool');
    pool = null;
    drizzleInstance = null;
  });

  return newPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!drizzleInstance) {
    pool = createPool();
    drizzleInstance = drizzle({ client: pool, schema });
  }
  return drizzleInstance;
}

export const db = getDb();
