import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const db = drizzle(process.env.DIRECT_URL || process.env.DATABASE_URL!);
await migrate(db, { migrationsFolder: './drizzle' });
process.exit(0);
