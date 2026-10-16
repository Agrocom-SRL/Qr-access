import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Los archivos comparten la base qr_access_testing: uno a la vez hasta tener bases por worker.
    fileParallelism: false,
  },
});
