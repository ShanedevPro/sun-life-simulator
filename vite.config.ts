import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GAME_BASE_PATH || '/',
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } }, chunkSizeWarningLimit: 1800 },
  server: { fs: { deny: ['.env', '.env.*', '**/.git/**', '**/story/references/**'] } },
});
