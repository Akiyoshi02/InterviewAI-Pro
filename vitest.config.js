import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['server/**', 'node_modules/**'],
  },
});

