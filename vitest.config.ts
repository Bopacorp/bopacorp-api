import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@config': resolve(__dirname, './src/config'),
      '@db': resolve(__dirname, './src/db'),
      '@lib': resolve(__dirname, './src/lib'),
      '@modules': resolve(__dirname, './src/modules'),
      '@shared': resolve(__dirname, './src/shared'),
    },
  },
  test: {
    environment: 'node',
  },
});
