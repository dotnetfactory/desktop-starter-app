import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { config as appConfig } from './app.config';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  // Inject app configuration into the renderer process at build time
  define: {
    '__APP_CONFIG__': JSON.stringify(appConfig),
  },
  build: {
    rollupOptions: {
      input: './index.html',
    },
  },
});
