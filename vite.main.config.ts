import { defineConfig } from 'vite';
import { config as appConfig } from './app.config';

// https://vitejs.dev/config
export default defineConfig({
  // Inject app configuration into the main process at build time
  // These values are replaced with actual values during the build
  define: {
    '__APP_CONFIG__': JSON.stringify(appConfig),
  },
  build: {
    // Don't minify to help with debugging native module issues
    minify: false,
    rollupOptions: {
      external: [
        // Native modules must be external - they can't be bundled by Vite
        // They will be resolved from node_modules at runtime
        'better-sqlite3',
      ],
    },
  },
  resolve: {
    // Ensure we're building for Node.js
    browserField: false,
    mainFields: ['module', 'main'],
  },
});
