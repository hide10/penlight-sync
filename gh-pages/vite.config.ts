import { defineConfig } from 'vite';

export default defineConfig({
  base: '/penlight-sync/',
  build: {
    outDir: 'dist',
  },
  server: {
    host: true,
  },
});
