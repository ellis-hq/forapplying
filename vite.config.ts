import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Only enable proxy when NOT running under vercel dev
// vercel dev handles /api routes via serverless functions
const isVercelDev = process.env.VERCEL_DEV === '1';

export default defineConfig({
  server: {
    // Let Vite use default host binding (localhost)
    // Only proxy /api to Express when running standalone (npm run dev)
    ...(isVercelDev ? {} : {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    }),
  },
  // Optimize dependency handling for pdfjs-dist which is a heavy ESM package
  optimizeDeps: {
    include: ['pdfjs-dist'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2000,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  }
});
