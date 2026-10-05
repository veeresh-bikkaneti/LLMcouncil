import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000 },
  // The one large chunk is the WebLLM runtime, which is only fetched on first use.
  build: { target: 'es2022', chunkSizeWarningLimit: 7000 },
  test: { environment: 'node' },
});
