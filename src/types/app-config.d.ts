/**
 * Global type declaration for app configuration
 * This is injected at build time by Vite
 */

import type { AppConfig } from '../../app.config';

declare global {
  const __APP_CONFIG__: AppConfig;
}

export {};
