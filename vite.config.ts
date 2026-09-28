import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Editors/formatters may truncate then rewrite a file. Wait for the write
    // to settle so Vite never caches the intermediate empty module.
    watch: { awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 25 } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
