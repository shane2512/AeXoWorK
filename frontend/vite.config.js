import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/client': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => {
          // Remove /api/client prefix, but keep the rest
          const newPath = path.replace(/^\/api\/client/, '');
          return newPath || '/';
        },
      },
      '/api/worker': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/worker/, ''),
      },
      '/api/verification': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/verification/, ''),
      },
      '/api/ipfs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ipfs/, '/api/ipfs'),
      },
      '/api/agents': {
        target: 'http://localhost:3008',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/agents/, '/api/marketplace/agents'),
      },
    },
  },
});

