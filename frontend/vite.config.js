import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const bypassHtml = (req, res, proxyOptions) => {
  if (req.headers.accept && req.headers.accept.indexOf('html') !== -1) {
    return '/index.html';
  }
};

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
        timeout: 300000,
        bypass: bypassHtml,
      },
      '/ai': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        timeout: 300000,
        bypass: bypassHtml,
      },
      '/applications': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/resumes': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/dashboard': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/memory': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/auth': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/resume-hub': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        bypass: bypassHtml,
      },
      '/events': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
        bypass: bypassHtml,
      },
    },
  },
});

