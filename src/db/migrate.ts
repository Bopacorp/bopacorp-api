import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// biome-ignore lint/complexity/useLiteralKeys: TS4111 requires bracket notation for index signatures
const connectionString = process.env['DIRECT_URL'] || process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL or DIRECT_URL must be set');
}

const db = drizzle(connectionString);
await migrate(db, { migrationsFolder: './drizzle' });
process.exit(0);
