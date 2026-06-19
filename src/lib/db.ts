import { env } from '@config/env.js';
import * as schema from '@db/schema/index.js';
import { logger } from '@lib/logger.js';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

let pool: pg.Pool | null = null;
let drizzleInstance: NodePgDatabase<typeof schema> | null = null;

function createPool(): pg.Pool {
  const newPool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === 'production' ? 20 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 30_000,
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

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    drizzleInstance = null;
  }
}
