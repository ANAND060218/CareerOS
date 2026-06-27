import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/jobs': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
      '/ai': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
      '/applications': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
      '/resumes': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
      '/dashboard': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
      '/memory': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
    },
  },
});
