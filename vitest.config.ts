import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'components/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    testTimeout: 15000,
    maxWorkers: 4,
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/unit.json' },
  },
});
