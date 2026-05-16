import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { env } from './src/config/env.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/*',
  out: './drizzle',
  dbCredentials: {
    url: env.DIRECT_URL || env.DATABASE_URL,
  },
  schemaFilter: ['app_auth', 'core', 'catalog', 'employability'],
  verbose: true,
  strict: true,
});
